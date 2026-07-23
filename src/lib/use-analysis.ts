"use client";

import { useCallback, useRef, useState } from "react";
import type { AnalysisSummary, ScoredComment, VideoMeta } from "@/lib/types";

export type AnalysisState = "empty" | "loading" | "results" | "error";

interface Progress {
  fetched: number;
  classified: number;
  total: number;
}

export function useAnalysis() {
  const [state, setState] = useState<AnalysisState>("empty");
  const [video, setVideo] = useState<VideoMeta | null>(null);
  const [comments, setComments] = useState<ScoredComment[]>([]);
  const [summary, setSummary] = useState<AnalysisSummary | null>(null);
  const [progress, setProgress] = useState<Progress>({ fetched: 0, classified: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState("empty");
    setVideo(null);
    setComments([]);
    setSummary(null);
    setProgress({ fetched: 0, classified: 0, total: 0 });
    setError(null);
  }, []);

  const start = useCallback(async (url: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState("loading");
    setVideo(null);
    setComments([]);
    setSummary(null);
    setProgress({ fetched: 0, classified: 0, total: 0 });
    setError(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Request failed. Please try again.");
        setState("error");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          if (!part.trim()) continue;
          const eventMatch = part.match(/^event: (.+)$/m);
          const dataMatch = part.match(/^data: (.+)$/m);
          if (!eventMatch || !dataMatch) continue;

          const event = eventMatch[1];
          const data = JSON.parse(dataMatch[1]);

          if (event === "meta") {
            setVideo(data.video);
          } else if (event === "progress") {
            setProgress(data);
          } else if (event === "batch") {
            setComments((prev) => [...prev, ...data.comments]);
          } else if (event === "done") {
            setSummary(data.summary);
            setState("results");
          } else if (event === "error") {
            setError(data.message);
            setState("error");
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError("Connection lost. Please try again.");
      setState("error");
    }
  }, []);

  return { state, video, comments, summary, progress, error, start, reset };
}
