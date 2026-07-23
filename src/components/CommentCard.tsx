import type { ScoredComment } from "@/lib/types";

const SENTIMENT_STYLE: Record<
  ScoredComment["sentiment"],
  { label: string; badgeClass: string; icon: string }
> = {
  positive: {
    label: "Positive",
    badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    icon: "▲",
  },
  negative: {
    label: "Negative",
    badgeClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300",
    icon: "▼",
  },
  neutral: {
    label: "Neutral",
    badgeClass: "bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300",
    icon: "●",
  },
};

export function CommentCard({ comment }: { comment: ScoredComment }) {
  const style = SENTIMENT_STYLE[comment.sentiment];

  return (
    <div className="flex gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
      {comment.authorAvatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={comment.authorAvatar}
          alt=""
          width={36}
          height={36}
          className="h-9 w-9 flex-shrink-0 rounded-full"
        />
      ) : (
        <div className="h-9 w-9 flex-shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-700" aria-hidden />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {comment.author}
          </span>
          <span
            className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${style.badgeClass}`}
          >
            <span aria-hidden>{style.icon}</span>
            {style.label}
          </span>
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-700 dark:text-zinc-300">
          {comment.text}
        </p>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          {comment.likeCount.toLocaleString()} likes
        </p>
      </div>
    </div>
  );
}
