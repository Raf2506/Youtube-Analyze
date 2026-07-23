# YouTube Comment Sentiment Analyzer

Paste a YouTube video URL and get every comment labelled **positive / negative
/ neutral**, plus a summary breakdown — multilingual, sarcasm-aware, powered
by an LLM rather than a keyword list.

```
paste URL  →  extract video ID  →  fetch comments (YouTube Data API v3)
           →  batch  →  classify (Gemini Flash-Lite)  →  aggregate  →  stream to UI
```

## Setup

1. Get a [YouTube Data API v3 key](https://console.cloud.google.com/) (enable
   "YouTube Data API v3", create a restricted API key — free, no card needed).
2. Get a [Gemini API key](https://aistudio.google.com/apikey) (Google AI Studio).
3. Copy `.env.local.example` to `.env.local` and fill in both keys.
4. `npm install`
5. `npm run dev` → http://localhost:3000

## Commands

```bash
npm run dev        # dev server
npm run build      # production build
npm test           # unit tests (vitest)
npm run probe -- <youtube-url>   # CLI: print video title + first 5 comments
npm run accuracy   # run the 50-comment labelled fixture through the classifier,
                    # print accuracy % and a confusion matrix
```

## Architecture

- `src/lib/types.ts` — shared types, single source of truth.
- `src/lib/youtube-url.ts` — parses every supported YouTube URL shape (watch,
  youtu.be, shorts, embed, m.youtube.com, bare 11-char ID) into a video ID.
- `src/lib/youtube-client.ts` — YouTube Data API client: video metadata,
  paginated top-level comment fetch, typed errors for disabled comments,
  missing videos, and quota exhaustion.
- `src/lib/sentiment.ts` — batches comments (40/request), sends them to Gemini
  as a numbered list, and maps results back **by id**, never by array order
  or count. Missing ids get retried once; anything still missing is marked
  `neutral` with `confidence: 0` rather than dropped. Concurrency capped at 4
  batches in flight (`p-limit`), exponential backoff on 429/5xx.
- `src/app/api/analyze/route.ts` — `POST { url, maxComments? }`, streams
  Server-Sent Events (`meta` → `progress` → `batch` → `done` / `error`) so a
  10-30 second analysis shows live progress instead of hanging. Per-IP rate
  limited (5 req/min) and results are cached in-memory for an hour, keyed by
  `videoId:maxComments`.
- `src/lib/use-analysis.ts` — client hook that parses the SSE stream
  (`EventSource` doesn't support POST bodies, so this reads the fetch
  response stream directly).
- `src/components/` — `UrlForm`, `SummaryPanel` (stacked-bar summary),
  `CommentList` (virtualized, filterable, sortable, CSV export),
  `CommentCard`.

## Design notes

- **Why an LLM, not a rules engine.** Comments are multilingual (Malay,
  English, Mandarin, Tamil, heavy code-switching), sarcastic, and emoji-heavy.
  Keyword/VADER-style scoring handles none of that well, and cost at this
  scale is negligible (well under $0.05 per 500-comment analysis with Gemini
  Flash-Lite).
- **Palette.** Amber (positive) / indigo (negative) / zinc (neutral) instead
  of the default red/green, since red-green is the most common colorblindness
  axis. Every sentiment is also labelled with text, not color alone.
- **Sampling, not censusing.** Large videos are capped at `maxComments`
  (default and hard ceiling: 500). The UI should be read as "analysed the N
  most relevant comments," not "analysed every comment."

## Known limits / next steps

- Top-level comments only (no replies) — replies roughly triple volume and
  skew conversational rather than opinion-bearing.
- Cache is in-memory and per-process; swap for a persisted store (e.g. a
  Postgres/Supabase table) before running multiple instances or across
  redeploys.
- Vercel Hobby serverless functions cap at 60s — a 500-comment analysis can
  approach that. Lower `maxComments` for a Hobby-tier deploy, or move to a
  background job + polling if you need the full 500.
