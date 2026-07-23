import { GoogleGenAI } from "@google/genai";
import pLimit from "p-limit";
import { z } from "zod";
import { RawComment, ScoredComment, Sentiment, SentimentApiError } from "@/lib/types";

const MODEL = "gemini-3.5-flash-lite";
export const BATCH_SIZE = 40;
const CONCURRENCY = 4;
const TRUNCATE_LEN = 400;
const MAX_RETRIES = 3;

const SYSTEM_PROMPT = `You classify YouTube comments by sentiment toward the video or its
creator.

Labels:
- positive: praise, gratitude, enjoyment, enthusiasm, supportive agreement
- negative: criticism, disappointment, anger, mockery, complaints
- neutral: questions, factual statements, timestamps, off-topic chatter,
  no clear sentiment

Rules:
- Comments may be in any language, including mixed-language comments.
  Classify by meaning, not by language.
- Sarcasm carries its intended meaning, not its literal one.
- Emoji count as sentiment signal.
- Insults aimed at other commenters, not the video, are neutral.
- Never refuse to classify. Every input gets exactly one label.

Return ONLY a JSON array, no markdown fences, no preamble:
[{"id": 1, "sentiment": "positive", "confidence": 0.93}, ...]
confidence is 0-1, your certainty in the label.`;

const resultItemSchema = z.object({
  id: z.number(),
  sentiment: z.enum(["positive", "negative", "neutral"]),
  confidence: z.number().min(0).max(1).catch(0),
});
const resultArraySchema = z.array(resultItemSchema);

interface BatchItem {
  localId: number;
  comment: RawComment;
}

function truncate(text: string): string {
  return text.length > TRUNCATE_LEN ? text.slice(0, TRUNCATE_LEN) : text;
}

function buildUserPrompt(items: BatchItem[]): string {
  return items
    .map((item) => `${item.localId}. ${truncate(item.comment.text).replace(/\n+/g, " ")}`)
    .join("\n");
}

export function extractJsonArrayText(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("[");
  const end = candidate.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return candidate.trim();
  return candidate.slice(start, end + 1);
}

export function parseModelResponse(
  raw: string,
  validIds: Set<number>,
): Map<number, { sentiment: Sentiment; confidence: number }> {
  const result = new Map<number, { sentiment: Sentiment; confidence: number }>();

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonArrayText(raw));
  } catch {
    return result;
  }

  const validated = resultArraySchema.safeParse(parsed);
  if (!validated.success) return result;

  for (const entry of validated.data) {
    if (validIds.has(entry.id) && !result.has(entry.id)) {
      result.set(entry.id, { sentiment: entry.sentiment, confidence: entry.confidence });
    }
  }

  return result;
}

function isRetryableStatus(status: unknown): boolean {
  return typeof status === "number" && (status === 429 || status >= 500);
}

function errorStatus(err: unknown): number | undefined {
  const status = (err as { status?: number } | undefined)?.status;
  if (typeof status === "number") return status;
  const message = (err as { message?: string } | undefined)?.message ?? "";
  const match = message.match(/\b(429|500|502|503|504)\b/);
  return match ? Number(match[1]) : undefined;
}

function toSentimentApiError(err: unknown): SentimentApiError {
  const status = errorStatus(err);
  const message = (err as { message?: string } | undefined)?.message ?? "Sentiment classification failed.";

  if (status === 429) {
    return new SentimentApiError(
      "rateLimited",
      "The AI classifier hit its rate limit or quota. Try again shortly, or with fewer comments.",
    );
  }
  if (status === 401 || status === 403) {
    return new SentimentApiError("invalidKey", "The Gemini API key is invalid or unauthorized.");
  }
  return new SentimentApiError("unknown", message);
}

async function withBackoff<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryableStatus(errorStatus(err)) || attempt === MAX_RETRIES - 1) {
        throw toSentimentApiError(err);
      }
      await new Promise((r) => setTimeout(r, 2 ** attempt * 500));
    }
  }
  throw toSentimentApiError(lastErr);
}

async function classifyBatch(
  client: GoogleGenAI,
  items: BatchItem[],
): Promise<Map<number, { sentiment: Sentiment; confidence: number }>> {
  const response = await withBackoff(() =>
    client.models.generateContent({
      model: MODEL,
      contents: buildUserPrompt(items),
      config: {
        systemInstruction: SYSTEM_PROMPT,
        maxOutputTokens: Math.max(1000, items.length * 50),
        responseMimeType: "application/json",
      },
    }),
  );

  const raw = response.text ?? "";
  const validIds = new Set(items.map((i) => i.localId));

  return parseModelResponse(raw, validIds);
}

export async function classifyComments(
  comments: RawComment[],
  onBatch?: (scored: ScoredComment[]) => void,
  client: GoogleGenAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }),
): Promise<ScoredComment[]> {
  const limit = pLimit(CONCURRENCY);

  const batches: BatchItem[][] = [];
  for (let i = 0; i < comments.length; i += BATCH_SIZE) {
    batches.push(
      comments.slice(i, i + BATCH_SIZE).map((comment, idx) => ({
        localId: idx + 1,
        comment,
      })),
    );
  }

  const scored: ScoredComment[] = [];

  await Promise.all(
    batches.map((batch) =>
      limit(async () => {
        const resultMap = await classifyBatch(client, batch);
        const missing = batch.filter((item) => !resultMap.has(item.localId));

        if (missing.length > 0) {
          const retryMap = await classifyBatch(client, missing);
          for (const [id, value] of retryMap) resultMap.set(id, value);
        }

        const batchScored: ScoredComment[] = batch.map((item) => {
          const found = resultMap.get(item.localId);
          return {
            ...item.comment,
            sentiment: found?.sentiment ?? "neutral",
            confidence: found?.confidence ?? 0,
          };
        });

        scored.push(...batchScored);
        onBatch?.(batchScored);
      }),
    ),
  );

  return scored;
}
