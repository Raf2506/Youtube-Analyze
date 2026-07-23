"use client";

import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ScoredComment, Sentiment } from "@/lib/types";
import { CommentCard } from "@/components/CommentCard";

type Filter = "all" | Sentiment;
type Sort = "likes" | "newest" | "confidence";

function toCsv(comments: ScoredComment[]): string {
  const header = ["author", "text", "likeCount", "publishedAt", "sentiment", "confidence"];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = comments.map((c) =>
    [c.author, c.text, String(c.likeCount), c.publishedAt, c.sentiment, String(c.confidence)]
      .map(escape)
      .join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

function downloadCsv(comments: ScoredComment[], videoId: string) {
  const blob = new Blob([toCsv(comments)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${videoId}-sentiment.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function CommentList({
  comments,
  videoId,
}: {
  comments: ScoredComment[];
  videoId: string;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("likes");
  const parentRef = useRef<HTMLDivElement>(null);

  const counts = useMemo(() => {
    const c = { all: comments.length, positive: 0, negative: 0, neutral: 0 };
    for (const comment of comments) c[comment.sentiment]++;
    return c;
  }, [comments]);

  const filtered = useMemo(() => {
    const base = filter === "all" ? comments : comments.filter((c) => c.sentiment === filter);
    const sorted = [...base];
    if (sort === "likes") sorted.sort((a, b) => b.likeCount - a.likeCount);
    else if (sort === "newest") sorted.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    else if (sort === "confidence") sorted.sort((a, b) => b.confidence - a.confidence);
    return sorted;
  }, [comments, filter, sort]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 110,
    overscan: 8,
  });

  return (
    <div className="w-full rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-3 border-b border-zinc-100 p-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(["all", "positive", "negative", "neutral"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`rounded-full border px-3 py-1 text-sm font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                filter === f
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {f} · {counts[f]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm text-zinc-500 dark:text-zinc-400">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="ml-2 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="likes">Likes</option>
              <option value="newest">Newest</option>
              <option value="confidence">Confidence</option>
            </select>
          </label>
          <button
            onClick={() => downloadCsv(filtered, videoId)}
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div ref={parentRef} className="h-[32rem] overflow-y-auto">
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((virtualRow) => (
            <div
              key={virtualRow.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <CommentCard comment={filtered[virtualRow.index]} />
            </div>
          ))}
        </div>
        {filtered.length === 0 && (
          <p className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No comments match this filter.
          </p>
        )}
      </div>
    </div>
  );
}
