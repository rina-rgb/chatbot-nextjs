import { type NextRequest, NextResponse } from 'next/server';
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

export const runtime = 'edge';

interface MessagePart {
  type: string;
  text?: string;
  state?: string;
}

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  parts?: MessagePart[];
  content?: string;
  metadata?: {
    createdAt: string;
  };
}

interface ConsultantResponse {
  title: string;
  summary: string;
  details: string;
  priority: 'green' | 'yellow' | 'red';
}

const consultantSystemPrompt = `You are a supportive WET consultant for therapist training. Provide balanced, constructive feedback based on research findings.

STRUCTURE YOUR RESPONSE AS JSON:
{
  "title": "Brief, actionable title (max 3 words). Meaningful and concise.",
  "summary": "One sentence summary of the main point, if needed. If no summary is needed, leave this blank. Concise and no more than 10 words",
  "details": "Detailed explanation with specific guidance, if needed. If no details are needed, leave this blank. Bold the most important parts. Use markdown formatting for emphasis. Prefer bullet points over paragraphs. Prefer concise and no more than 50 words",
  "priority": "green|yellow|red"
}

PRIORITY LEVELS:
- GREEN: Therapist is doing WET therapy well or exceeding expectations. Positive feedback for WET-aligned behaviors, good therapeutic techniques, proper boundary setting, cultural responsiveness, or effective trauma processing.
- YELLOW: Minor WET technique adjustments needed. Therapist is generally on track but could improve specific WET skills, timing, or approach. Small refinements to enhance effectiveness.
- RED: Critical WET therapy issues that need immediate attention:
  * Therapist going off-topic (non-therapeutic conversations like "do you know NextJS" or "can you do math")
  * Boundary violations or inappropriate responses
  * Missing core WET techniques when needed
  * Harmful therapeutic approaches
  * Ignoring patient safety concerns

CONTEXT vs FOCUS:
- USE full conversation history as context to understand:
  * Progress and improvement patterns
  * Previous interventions and their effectiveness
  * Patient's response patterns and preferences
  * Overall session flow and therapeutic alliance
- FOCUS feedback on the MOST RECENT exchange to provide:
  * Specific guidance for the therapist's next move
  * Immediate actionable steps
  * Current interaction analysis

FOCUS ON:
- The MOST RECENT exchange between therapist and patient
- WET-specific techniques (exposure therapy, trauma narrative, treatment rationale)
- Cultural responsiveness in WET delivery
- Next most-important WET skill to implement
- Specific, actionable guidance for the therapist's next move
- Acknowledging what the therapist is doing well in the current interaction
- Ensuring the conversation stays focused on WET therapy and trauma processing
- Proper therapeutic boundaries and professional conduct

AVOID:
- Overly critical or negative feedback
- Multiple directions at once
- Overly formal or verbose language
- Excessive praise or ingratiating comments
- Basic therapeutic techniques (unless clearly inappropriate)
- Guidance that contradicts WET principles
- Repeating feedback about previous exchanges
- Giving feedback on past interactions (use them only for context)

RED FLAG TRIGGERS (immediate red priority):
- Therapist asking non-therapeutic questions (e.g., "do you know NextJS?", "can you do math?")
- Therapist engaging in casual conversation unrelated to WET therapy
- Therapist making inappropriate personal comments or boundary violations
- Therapist ignoring patient's trauma symptoms or safety concerns
- Therapist using non-evidence-based approaches that contradict WET principles

BALANCE:
- Provide constructive guidance while acknowledging progress
- Focus on next steps rather than dwelling on what went wrong
- Give clear direction on whether to address feedback immediately or move forward
- Ensure feedback aligns with WET approach and principles
- Focus on the therapist's immediate next move based on the patient's latest response

Use the full conversation as context to understand progress, but provide feedback focused on the most recent exchange.`;

export async function POST(req: NextRequest) {
  const {
    conversationHistory,
    memorySummary,
  }: { conversationHistory: ConversationMessage[]; memorySummary?: string } =
    await req.json();

  // Format the conversation history for the consultant
  const conversationLines = conversationHistory
    .map((msg: ConversationMessage) => {
      const role = msg.role === 'user' ? 'Therapist' : 'Patient';
      let content = '';

      // Handle different message formats
      if (msg.parts && Array.isArray(msg.parts)) {
        // Extract text from parts array
        content = msg.parts
          .filter((p: MessagePart) => p?.type === 'text' && p?.text)
          .map((p: MessagePart) => p.text)
          .join('\n');
      } else if (msg.content) {
        // Fallback to direct content
        content = msg.content;
      }

      return { role, content };
    })
    .filter((line) => line.content.trim()); // Only include lines with actual content

  // Highlight the most recent exchange (last 2 messages if they exist)
  const conversationText = conversationLines
    .map((line, index) => {
      const isRecent = index >= conversationLines.length - 2;
      const prefix = isRecent ? '*** MOST RECENT EXCHANGE ***\n' : '';
      return `${prefix}${line.role}: ${line.content}`;
    })
    .join('\n\n');

  const { text } = await generateText({
    model: google('gemini-2.0-flash'),
    messages: [
      { role: 'system' as const, content: consultantSystemPrompt },
      ...(memorySummary
        ? [
            {
              role: 'system' as const,
              content: `Session memory: ${memorySummary}`,
            },
          ]
        : []),
      {
        role: 'user' as const,
        content: `Conversation context:\n\n${conversationText}\n\nINSTRUCTIONS: Use the full conversation as context to understand progress and patterns, but provide feedback focused on the MOST RECENT exchange. Give specific guidance for the therapist's next move based on the patient's latest response. Do not repeat feedback about previous exchanges - use them only for context. 

CRITICAL: The therapist is training in WET (Written Exposure Therapy) for trauma treatment. If the therapist goes off-topic (e.g., asks about programming, math, or engages in non-therapeutic conversation), immediately flag this as RED priority. Focus feedback on WET-specific techniques, trauma processing, and therapeutic boundaries. Respond with valid JSON only.`,
      },
    ],
    temperature: 0.7,
  });

  try {
    // Clean the response - remove any markdown formatting
    const cleanedText = text
      ?.replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    const parsed: ConsultantResponse = JSON.parse(cleanedText || '{}');

    return NextResponse.json({
      consultantNote: {
        title: parsed.title || 'Feedback',
        summary: parsed.summary || 'General feedback',
        details: parsed.details || '',
        priority: parsed.priority || 'green',
      },
    });
  } catch (error) {
    console.error('JSON parsing error:', error);
    console.error('Raw text that failed to parse:', text);

    // Fallback if JSON parsing fails
    return NextResponse.json({
      consultantNote: {
        title: 'Feedback',
        summary: text || 'General feedback',
        details: '',
        priority: 'green',
      },
    });
  }
}
