import { describe, expect, it, vi } from "vitest";
import { cacheKey, getCached, setCached } from "@/lib/cache";
import type { AnalysisResult } from "@/lib/types";

function makeResult(id: string): AnalysisResult {
  return {
    video: { id, title: "t", channelTitle: "c", thumbnail: "", totalCommentCount: 1 },
    comments: [],
    summary: { total: 0, positive: 0, negative: 0, neutral: 0, averageConfidence: 0 },
  };
}

describe("cache", () => {
  it("returns null for a miss", () => {
    expect(getCached(cacheKey("missing", 500))).toBeNull();
  });

  it("returns a stored value before it expires", () => {
    const key = cacheKey("abc", 500);
    setCached(key, makeResult("abc"));
    expect(getCached(key)?.video.id).toBe("abc");
  });

  it("expires entries past the TTL", () => {
    const key = cacheKey("xyz", 500);
    vi.useFakeTimers();
    try {
      setCached(key, makeResult("xyz"));
      vi.advanceTimersByTime(60 * 60 * 1000 + 1);
      expect(getCached(key)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keys by videoId and maxComments independently", () => {
    setCached(cacheKey("v", 100), makeResult("v-100"));
    setCached(cacheKey("v", 500), makeResult("v-500"));
    expect(getCached(cacheKey("v", 100))?.video.id).toBe("v-100");
    expect(getCached(cacheKey("v", 500))?.video.id).toBe("v-500");
  });
});
