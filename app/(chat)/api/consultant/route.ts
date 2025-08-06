import { NextRequest, NextResponse } from 'next/server';
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

export const runtime = 'edge';

function consultantSystem() {
  return `
You are a supportive WET consultant for therapist training. Provide balanced, constructive feedback based on research findings.

STRUCTURE YOUR RESPONSE AS JSON:
{
  "title": "Brief, actionable title (max 3 words). Meaningful and concise.",
  "summary": "One sentence summary of the main point, if needed. If no summary is needed, leave this blank. Concise and no more than 10 words",
  "details": "Detailed explanation with specific guidance, if needed. If no details are needed, leave this blank. Bold the most important parts. Use markdown formatting for emphasis. Prefer bullet points over paragraphs. Prefer concise and no more than 50 words",
  "priority": "green|yellow|red"
}

PRIORITY LEVELS:
- GREEN: Positive feedback, encouragement, doing great, no details needed.
- YELLOW: Pause and reflect, minor adjustment needed
- RED: Warning, important issue that needs attention

FOCUS ON:
- WET-specific techniques (exposure therapy, trauma narrative, treatment rationale)
- Cultural responsiveness in WET delivery
- Next most-important WET skill to implement
- Specific, actionable guidance
- Acknowledging what the therapist is doing well

AVOID:
- Overly critical or negative feedback
- Multiple directions at once
- Overly formal or verbose language
- Excessive praise or ingratiating comments
- Basic therapeutic techniques (unless clearly inappropriate)
- Guidance that contradicts WET principles

BALANCE:
- Provide constructive guidance while acknowledging progress
- Focus on next steps rather than dwelling on what went wrong
- Give clear direction on whether to address feedback immediately or move forward
- Ensure feedback aligns with WET approach and principles

Analyze the FULL conversation context and provide supportive WET guidance.
`;
}

export async function POST(req: NextRequest) {
  const { conversationHistory, memorySummary } = await req.json();

  // Format the conversation history for the consultant
  const conversationText = conversationHistory
    .map((msg: any) => {
      const role = msg.role === 'user' ? 'Therapist' : 'Patient';
      const content =
        msg.parts
          ?.filter((p: any) => p?.type === 'text')
          .map((p: any) => p.text)
          .join('\n') ||
        msg.content ||
        '';
      return `${role}: ${content}`;
    })
    .join('\n\n');

  const { text } = await generateText({
    model: google('gemini-2.0-flash'),
    messages: [
      { role: 'system' as const, content: consultantSystem() },
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
        content: `Full conversation context:\n\n${conversationText}\n\nProvide WET consultant feedback based on this entire conversation. Respond with valid JSON only.`,
      },
    ],
    temperature: 0.2,
  });

  console.log('Raw AI response:', text);

  try {
    // Clean the response - remove any markdown formatting
    const cleanedText = text
      ?.replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    const parsed = JSON.parse(cleanedText || '{}');

    console.log('Parsed response:', parsed);

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
