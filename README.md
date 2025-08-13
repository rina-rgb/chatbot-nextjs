<div align="center">
  <h1>WET Therapist Training Chatbot</h1>
  <p>Next.js + AI SDK app for therapist training with AI consultant feedback and voice transcription.</p>
</div>

---

## Features

- AI-first chat UX built with Next.js App Router
- AI Consultant sidebar with graded notes (latest note highlighted, history below)
- Voice input with Gemini-based speech-to-text (server-side)
- Authentication (Auth.js) with production middleware
- Data persistence (Neon Postgres, Vercel Blob)
- Tailwind + shadcn/ui + Radix primitives

## Preview
The chat interface powered by Next.js looks something like this:

Firt welcome screen
<img width="1463" height="1143" alt="Screenshot 2025-08-13 at 1 08 27 PM" src="https://github.com/user-attachments/assets/ac1e4c2d-5e11-49be-ae6b-4106b58db94f" />

After an interaction
<img width="1455" height="1168" alt="Screenshot 2025-08-13 at 1 20 13 PM" src="https://github.com/user-attachments/assets/7be40b1f-2535-443a-9a9a-794afc318555" />

## Quickstart

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000

## Credits

- Based on the Vercel AI Chatbot template and AI SDK
- Uses Next.js, Tailwind, shadcn/ui, Radix, Neon Postgres, Vercel Blob, and Auth.js

## License

MIT (see `LICENSE`)
