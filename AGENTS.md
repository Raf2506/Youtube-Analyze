<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# YouTube Comment Sentiment Analyzer

Paste a YouTube URL, get every comment labelled positive/negative/neutral, plus a summary.

## Rules
- API keys (`YOUTUBE_API_KEY`, `ANTHROPIC_API_KEY`) are read only in `src/app/api/**` and `src/lib/**`. Never in components, never `NEXT_PUBLIC_`.
- All shared types live in `src/lib/types.ts`. Don't redefine them locally.
- No `any`. Use `unknown` and narrow.
- Every external API call: try/catch, typed error, backoff on 429/5xx.
- Sentiment classification must map results back to comments by numbered id, never by array order. Missing ids get retried once, then `neutral`/`confidence: 0`.
- Test `lib/` changes with `npx tsx scripts/probe.ts <url>` before touching the UI.
- Small commits, one phase at a time.

## Commands
- dev: `npm run dev`
- test: `npm test`
- probe: `npm run probe -- <youtube-url>`
- accuracy: `npm run accuracy`
