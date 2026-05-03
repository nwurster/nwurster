# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UIGen is an AI-powered React component generator with live preview. Users describe components in natural language; the app streams AI-generated code via tool calls that manipulate an in-memory virtual file system, then renders the result in an iframe.

## Development Commands

```bash
npm run setup       # First-time setup: install + prisma generate + db migrate
npm run dev         # Start dev server (Turbopack)
npm run build       # Production build
npm run test        # Run Vitest tests
npm run lint        # ESLint
npm run db:reset    # Force-reset the SQLite database
```

Run a single test file: `npx vitest run src/lib/__tests__/file-system.test.ts`

## Architecture

### AI Generation Pipeline

1. `ChatInterface` sends messages to `/api/chat` (route handler in `src/app/api/chat/route.ts`)
2. The route injects a system prompt with `cache: "ephemeral"` for prompt caching, then streams Claude responses via Vercel AI SDK
3. Claude calls two tools: `str_replace_editor` (targeted edits) and `file_manager` (create/delete/list operations)
4. Tool results update the virtual file system in `FileSystemContext`
5. If user is authenticated, files are serialized to JSON and saved to the `Project` DB record

### Virtual File System (`src/lib/file-system.ts`)

All file operations are in-memory — nothing touches disk. The FS implements create/read/update/delete with path-based access and JSON serialization for DB persistence. AI tools call into this via `src/lib/tools/`.

### Preview System (`src/components/preview/PreviewFrame.tsx`)

Detects the entry point (`App.jsx`, `index.jsx`, etc.), uses Babel standalone to transform JSX in-browser, and injects an import map pointing at `esm.sh` for external dependencies. Renders in a sandboxed iframe.

### Provider System (`src/lib/provider.ts`)

Returns a real `claude-haiku-4-5` model when `ANTHROPIC_API_KEY` is set; falls back to a `MockLanguageModel` that simulates multi-step generation. This lets the app run without API credentials.

### State Management

- `ChatContext` (`src/lib/contexts/chat-context.tsx`): message history, input, streaming state
- `FileSystemContext` (`src/lib/contexts/file-system-context.tsx`): virtual FS instance, selected file, refresh triggers

### Authentication

JWT in httpOnly cookies, bcrypt password hashing, server actions in `src/actions/`. Anonymous projects are stored with a null `userId`; they're linked to the user on sign-up via `anonWorkTracker`.

### Database

Prisma with SQLite. Two models:
- `User`: email + hashed password
- `Project`: `messages` (JSON string of chat history) + `data` (JSON string of virtual FS), optional `userId`

## Key Files

| File | Purpose |
|------|---------|
| `src/app/api/chat/route.ts` | Main AI streaming endpoint |
| `src/lib/file-system.ts` | In-memory virtual file system |
| `src/lib/provider.ts` | LLM provider (real or mock) |
| `src/lib/prompts/generation.tsx` | System prompt for component generation |
| `src/lib/tools/str-replace.ts` | AI tool: targeted string replacement |
| `src/lib/tools/file-manager.ts` | AI tool: create/delete/list files |
| `src/lib/transform/jsx-transformer.ts` | Babel JSX transformation for preview |
| `src/components/preview/PreviewFrame.tsx` | iframe-based live preview |
| `src/middleware.ts` | Auth middleware for protected routes |
| `node-compat.cjs` | Node 25+ Web Storage compatibility shim |

## Notes

- Path alias `@/*` maps to `src/*`
- Tailwind CSS v4 is used — configuration is in `postcss.config.mjs` and CSS files, not `tailwind.config.js`
- shadcn/ui components (style: `new-york`) live in `src/components/ui/`
- The `node-compat.cjs` shim must remain as it fixes a Web Storage API break in Node 25+
- Database schema is defined in `prisma/schema.prisma` — reference it for all DB model/field/relation details
- Use comments sparingly; only comment complex code where the reason is non-obvious
