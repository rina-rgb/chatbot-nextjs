# Chatbot Setup Guide

## Quick Setup Steps

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Set Up Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Database Configuration
POSTGRES_URL="postgresql://username:password@localhost:5432/chatbot_db"

# Authentication (required even with mock auth)
AUTH_SECRET="your-secret-key-here-make-it-long-and-random"

# AI Provider API Keys
# For xAI (default provider)
XAI_API_KEY="your-xai-api-key-here"

# Alternative providers (uncomment if using different providers)
# OPENAI_API_KEY="your-openai-api-key-here"
# ANTHROPIC_API_KEY="your-anthropic-api-key"

# Optional: Vercel Blob for file uploads
# BLOB_READ_WRITE_TOKEN="your-vercel-blob-token"

# Optional: Redis for resumable streams
# REDIS_URL="redis://localhost:6379"

# Development settings
NODE_ENV="development"
```

### 3. Set Up Database

#### Option A: Local PostgreSQL

1. Install PostgreSQL locally
2. Create a database: `createdb chatbot_db`
3. Update `POSTGRES_URL` in `.env.local`

#### Option B: Neon (Cloud PostgreSQL)

1. Go to [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string to `POSTGRES_URL`

#### Option C: Supabase

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Copy the connection string to `POSTGRES_URL`

### 4. Get AI API Key

#### For xAI (Default)

1. Go to [x.ai](https://x.ai)
2. Sign up and get your API key
3. Add to `XAI_API_KEY` in `.env.local`

#### Alternative: OpenAI

1. Go to [platform.openai.com](https://platform.openai.com)
2. Get your API key
3. Uncomment `OPENAI_API_KEY` in `.env.local`
4. Update `lib/ai/providers.ts` to use OpenAI instead of xAI

### 5. Run Database Migrations

```bash
pnpm db:migrate
```

### 6. Start Development Server

```bash
pnpm dev
```

## Current Status

✅ **Authentication Disabled** - No login required for MVP development
✅ **Mock User Session** - All API routes work with mock guest user
✅ **Database Schema** - Ready for chat history and user data
✅ **AI Integration** - Configured for xAI (can be changed to other providers)

## Troubleshooting

### Database Connection Issues

- Ensure PostgreSQL is running
- Check your `POSTGRES_URL` format
- Try: `pnpm db:studio` to view database

### AI Provider Issues

- Verify your API key is correct
- Check API key permissions
- Try switching to a different provider

### Development Server Issues

- Clear `.next` cache: `rm -rf .next`
- Restart the server: `pnpm dev`

## Next Steps

1. **Test the chat functionality** - Try sending a message
2. **Customize the AI model** - Modify `lib/ai/providers.ts`
3. **Add your own features** - Build on top of the existing structure
4. **Re-enable authentication** - When ready, follow `AUTH_DISABLED.md`

## File Structure Overview

- `app/(chat)/` - Main chat interface
- `lib/ai/` - AI provider configuration
- `lib/db/` - Database schema and queries
- `components/` - React components
- `middleware.ts` - Authentication middleware (currently disabled)
- `lib/mock-auth.ts` - Mock authentication for development
