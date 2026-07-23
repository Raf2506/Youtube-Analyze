import type { AnalysisResult } from "@/lib/types";

const TTL_MS = 60 * 60 * 1000;

const store = new Map<string, { result: AnalysisResult; expiresAt: number }>();

export function cacheKey(videoId: string, maxComments: number): string {
  return `${videoId}:${maxComments}`;
}

export function getCached(key: string): AnalysisResult | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.result;
}

export function setCached(key: string, result: AnalysisResult): void {
  store.set(key, { result, expiresAt: Date.now() + TTL_MS });
}
