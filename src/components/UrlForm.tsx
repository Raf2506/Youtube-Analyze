"use client";

import { useState } from "react";

const EXAMPLE_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

export function UrlForm({
  onSubmit,
  disabled,
}: {
  onSubmit: (url: string) => void;
  disabled: boolean;
}) {
  const [url, setUrl] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (url.trim()) onSubmit(url.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl">
      <label htmlFor="video-url" className="sr-only">
        YouTube video URL
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="video-url"
          type="text"
          autoFocus
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a YouTube video URL…"
          disabled={disabled}
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <button
          type="submit"
          disabled={disabled || !url.trim()}
          className="rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white transition-colors hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Analyze
        </button>
      </div>
      <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
        Paste a link, get every comment labelled positive, negative, or
        neutral.{" "}
        <button
          type="button"
          onClick={() => !disabled && onSubmit(EXAMPLE_URL)}
          disabled={disabled}
          className="font-medium text-indigo-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-indigo-400"
        >
          Try an example
        </button>
      </p>
    </form>
  );
}
