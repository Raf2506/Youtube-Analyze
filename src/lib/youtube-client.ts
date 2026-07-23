import { RawComment, VideoMeta, YoutubeApiError } from "@/lib/types";

const API_BASE = "https://www.googleapis.com/youtube/v3";
const MAX_RESULTS_PER_PAGE = 100;

function apiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY is not set");
  return key;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    );
}

async function youtubeFetch(path: string, params: Record<string, string>) {
  const url = new URL(`${API_BASE}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("key", apiKey());

  const res = await fetch(url.toString());
  const body = await res.json();

  if (!res.ok) {
    const reason: string | undefined = body?.error?.errors?.[0]?.reason;
    if (reason === "commentsDisabled") {
      throw new YoutubeApiError(
        "commentsDisabled",
        "Comments are disabled on this video.",
      );
    }
    if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
      throw new YoutubeApiError(
        "quotaExceeded",
        "Daily limit reached. Try again after midnight Pacific time.",
      );
    }
    if (res.status === 400 && reason === "keyInvalid") {
      throw new YoutubeApiError("invalidKey", "YouTube API key is invalid.");
    }
    throw new YoutubeApiError(
      "unknown",
      body?.error?.message ?? `YouTube API error (${res.status})`,
    );
  }

  return body;
}

export async function getVideoMeta(id: string): Promise<VideoMeta> {
  const body = await youtubeFetch("videos", {
    part: "snippet,statistics",
    id,
  });

  const item = body.items?.[0];
  if (!item) {
    throw new YoutubeApiError(
      "videoNotFound",
      "Couldn't find that video. Check the link.",
    );
  }

  return {
    id,
    title: decodeEntities(item.snippet?.title ?? ""),
    channelTitle: decodeEntities(item.snippet?.channelTitle ?? ""),
    thumbnail:
      item.snippet?.thumbnails?.high?.url ??
      item.snippet?.thumbnails?.default?.url ??
      "",
    totalCommentCount: Number(item.statistics?.commentCount ?? 0),
  };
}

export async function fetchComments(
  id: string,
  maxComments: number,
  onPage?: (fetched: number) => void,
): Promise<RawComment[]> {
  const comments: RawComment[] = [];
  let pageToken: string | undefined;

  do {
    const body = await youtubeFetch("commentThreads", {
      part: "snippet",
      videoId: id,
      maxResults: String(Math.min(MAX_RESULTS_PER_PAGE, maxComments - comments.length)),
      order: "relevance",
      textFormat: "plainText",
      ...(pageToken ? { pageToken } : {}),
    });

    for (const item of body.items ?? []) {
      const snippet = item.snippet?.topLevelComment?.snippet;
      if (!snippet) continue;
      comments.push({
        id: item.snippet?.topLevelComment?.id ?? item.id,
        author: decodeEntities(snippet.authorDisplayName ?? "Unknown"),
        authorAvatar: snippet.authorProfileImageUrl ?? null,
        text: decodeEntities(snippet.textDisplay ?? ""),
        likeCount: Number(snippet.likeCount ?? 0),
        publishedAt: snippet.publishedAt ?? new Date().toISOString(),
        replyCount: Number(item.snippet?.totalReplyCount ?? 0),
      });
    }

    pageToken = body.nextPageToken;
    onPage?.(Math.min(comments.length, maxComments));
  } while (pageToken && comments.length < maxComments);

  return comments.slice(0, maxComments);
}
