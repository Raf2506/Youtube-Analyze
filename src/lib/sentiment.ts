import Anthropic from "@anthropic-ai/sdk";
import pLimit from "p-limit";
import { z } from "zod";
import { RawComment, ScoredComment, Sentiment } from "@/lib/types";

const MODEL = "claude-haiku-4-5-20251001";
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

async function withBackoff<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = (err as { status?: number } | undefined)?.status;
      if (!isRetryableStatus(status) || attempt === MAX_RETRIES - 1) throw err;
      await new Promise((r) => setTimeout(r, 2 ** attempt * 500));
    }
  }
  throw lastErr;
}

async function classifyBatch(
  client: Anthropic,
  items: BatchItem[],
): Promise<Map<number, { sentiment: Sentiment; confidence: number }>> {
  const response = await withBackoff(() =>
    client.messages.create({
      model: MODEL,
      max_tokens: Math.max(1000, items.length * 50),
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(items) }],
    }),
  );

  const textBlock = response.content.find((block) => block.type === "text");
  const raw = textBlock && "text" in textBlock ? textBlock.text : "";
  const validIds = new Set(items.map((i) => i.localId));

  return parseModelResponse(raw, validIds);
}

export async function classifyComments(
  comments: RawComment[],
  onBatch?: (scored: ScoredComment[]) => void,
  client: Anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
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
        let resultMap = await classifyBatch(client, batch);
        let missing = batch.filter((item) => !resultMap.has(item.localId));

        if (missing.length > 0) {
          const retryMap = await classifyBatch(client, missing);
          for (const [id, value] of retryMap) resultMap.set(id, value);
          missing = batch.filter((item) => !resultMap.has(item.localId));
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
