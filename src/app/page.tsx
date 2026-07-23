"use client";

import Image from "next/image";
import { useAnalysis } from "@/lib/use-analysis";
import { UrlForm } from "@/components/UrlForm";
import { SummaryPanel } from "@/components/SummaryPanel";
import { CommentList } from "@/components/CommentList";

export default function Home() {
  const { state, video, comments, summary, progress, error, start, reset } = useAnalysis();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center gap-8 px-4 py-12 sm:px-6">
      <header className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 sm:text-3xl">
          YouTube Comment Sentiment Analyzer
        </h1>
        <p className="max-w-lg text-sm text-zinc-500 dark:text-zinc-400">
          Paste a video URL and get every comment labelled positive, negative,
          or neutral — in any language.
        </p>
      </header>

      <UrlForm onSubmit={start} disabled={state === "loading"} />

      {state === "error" && error && (
        <div
          role="alert"
          className="w-full max-w-2xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {error}
          <button
            onClick={reset}
            className="ml-2 font-medium underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            Try again
          </button>
        </div>
      )}

      {(state === "loading" || state === "results") && video && (
        <div className="flex w-full max-w-2xl items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          {video.thumbnail && (
            <Image
              src={video.thumbnail}
              alt=""
              width={120}
              height={68}
              unoptimized
              className="h-[68px] w-[120px] flex-shrink-0 rounded-md object-cover"
            />
          )}
          <div className="min-w-0">
            <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
              {video.title}
            </p>
            <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
              {video.channelTitle}
            </p>
          </div>
        </div>
      )}

      {state === "loading" && (
        <div className="w-full max-w-2xl">
          <div
            role="progressbar"
            aria-valuenow={progress.total === 0 ? 0 : Math.round((progress.classified / progress.total) * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
          >
            <div
              className="h-full bg-indigo-500 motion-safe:transition-all motion-safe:duration-300"
              style={{
                width: `${
                  progress.total === 0 ? 8 : Math.max(8, Math.round((progress.classified / progress.total) * 100))
                }%`,
              }}
            />
          </div>
          <p className="mt-2 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {progress.classified > 0
              ? `Classified ${progress.classified} of ${progress.total}`
              : progress.fetched > 0
                ? `Fetched ${progress.fetched} comments…`
                : "Fetching video…"}
          </p>
        </div>
      )}

      {state === "results" && summary && video && (
        <div className="flex w-full flex-col gap-6">
          <SummaryPanel summary={summary} />
          <CommentList comments={comments} videoId={video.id} />
        </div>
      )}
    </div>
  );
}
