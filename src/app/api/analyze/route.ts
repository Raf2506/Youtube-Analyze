import { NextRequest } from "next/server";
import { z } from "zod";
import { extractVideoId } from "@/lib/youtube-url";
import { fetchComments, getVideoMeta } from "@/lib/youtube-client";
import { classifyComments } from "@/lib/sentiment";
import { AnalysisSummary, ScoredComment, SentimentApiError, YoutubeApiError } from "@/lib/types";
import { clientIp, isRateLimited } from "@/lib/rate-limit";
import { cacheKey, getCached, setCached } from "@/lib/cache";

export const dynamic = "force-dynamic";

const MAX_COMMENTS_CEILING = 500;
const DEFAULT_MAX_COMMENTS = 500;

const bodySchema = z.object({
  url: z.string().min(1),
  maxComments: z.number().int().positive().optional(),
});

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function summarize(comments: ScoredComment[]): AnalysisSummary {
  const total = comments.length;
  const positive = comments.filter((c) => c.sentiment === "positive").length;
  const negative = comments.filter((c) => c.sentiment === "negative").length;
  const neutral = total - positive - negative;
  const averageConfidence =
    total === 0 ? 0 : comments.reduce((sum, c) => sum + c.confidence, 0) / total;
  return { total, positive, negative, neutral, averageConfidence };
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request.headers);
  if (isRateLimited(ip)) {
    return Response.json(
      { code: "rateLimited", message: "Too many requests. Try again in a minute." },
      { status: 429 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json(
      { code: "invalidBody", message: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { code: "invalidBody", message: "Expected { url, maxComments? }." },
      { status: 400 },
    );
  }

  const videoId = extractVideoId(parsed.data.url);
  if (!videoId) {
    return Response.json(
      { code: "invalidUrl", message: "Couldn't recognize that as a YouTube video URL or ID." },
      { status: 400 },
    );
  }

  const maxComments = Math.min(
    parsed.data.maxComments ?? DEFAULT_MAX_COMMENTS,
    MAX_COMMENTS_CEILING,
  );

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(sseEvent(event, data)));

      const key = cacheKey(videoId, maxComments);

      try {
        const cached = getCached(key);
        if (cached) {
          send("meta", { video: cached.video });
          send("batch", { comments: cached.comments });
          send("done", { summary: cached.summary });
          return;
        }

        const video = await getVideoMeta(videoId);
        send("meta", { video });

        let classified = 0;
        const comments = await fetchComments(videoId, maxComments, (fetched) => {
          send("progress", { fetched, classified, total: maxComments });
        });

        if (comments.length === 0) {
          const summary = summarize([]);
          setCached(key, { video, comments: [], summary });
          send("done", { summary });
          return;
        }

        const scored = await classifyComments(comments, (batch) => {
          classified += batch.length;
          send("progress", {
            fetched: comments.length,
            classified,
            total: comments.length,
          });
          send("batch", { comments: batch });
        });

        const summary = summarize(scored);
        setCached(key, { video, comments: scored, summary });
        send("done", { summary });
      } catch (err) {
        if (err instanceof YoutubeApiError || err instanceof SentimentApiError) {
          send("error", { code: err.code, message: err.message });
        } else {
          console.error(err);
          send("error", {
            code: "unknown",
            message: "Something went wrong analysing this video.",
          });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
