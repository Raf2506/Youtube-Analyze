export type Sentiment = "positive" | "negative" | "neutral";

export interface RawComment {
  id: string;
  author: string;
  authorAvatar: string | null;
  text: string;
  likeCount: number;
  publishedAt: string;
  replyCount: number;
}

export interface ScoredComment extends RawComment {
  sentiment: Sentiment;
  confidence: number;
}

export interface VideoMeta {
  id: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  totalCommentCount: number;
}

export interface AnalysisSummary {
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  averageConfidence: number;
}

export interface AnalysisResult {
  video: VideoMeta;
  comments: ScoredComment[];
  summary: AnalysisSummary;
}

export type YoutubeErrorCode =
  | "commentsDisabled"
  | "videoNotFound"
  | "quotaExceeded"
  | "invalidKey"
  | "unknown";

export class YoutubeApiError extends Error {
  code: YoutubeErrorCode;

  constructor(code: YoutubeErrorCode, message: string) {
    super(message);
    this.name = "YoutubeApiError";
    this.code = code;
  }
}

export type SentimentErrorCode = "rateLimited" | "invalidKey" | "unknown";

export class SentimentApiError extends Error {
  code: SentimentErrorCode;

  constructor(code: SentimentErrorCode, message: string) {
    super(message);
    this.name = "SentimentApiError";
    this.code = code;
  }
}

export type AnalyzeSseEvent =
  | { event: "meta"; data: { video: VideoMeta } }
  | {
      event: "progress";
      data: { fetched: number; classified: number; total: number };
    }
  | { event: "batch"; data: { comments: ScoredComment[] } }
  | { event: "done"; data: { summary: AnalysisSummary } }
  | { event: "error"; data: { code: string; message: string } };
