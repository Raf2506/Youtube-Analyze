import { describe, expect, it, vi } from "vitest";
import {
  classifyComments,
  extractJsonArrayText,
  parseModelResponse,
} from "@/lib/sentiment";
import type { RawComment } from "@/lib/types";

function makeComment(id: string, text: string): RawComment {
  return {
    id,
    author: "author",
    authorAvatar: null,
    text,
    likeCount: 0,
    publishedAt: new Date().toISOString(),
    replyCount: 0,
  };
}

function textResponse(json: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(json) }] };
}

describe("extractJsonArrayText", () => {
  it("strips markdown code fences", () => {
    const raw = '```json\n[{"id":1,"sentiment":"positive","confidence":0.9}]\n```';
    expect(extractJsonArrayText(raw)).toBe(
      '[{"id":1,"sentiment":"positive","confidence":0.9}]',
    );
  });

  it("strips preamble text before the array", () => {
    const raw = 'Here you go:\n[{"id":1,"sentiment":"neutral","confidence":0.5}]';
    expect(JSON.parse(extractJsonArrayText(raw))).toEqual([
      { id: 1, sentiment: "neutral", confidence: 0.5 },
    ]);
  });
});

describe("parseModelResponse", () => {
  it("maps valid entries by id, ignoring unknown ids", () => {
    const raw = JSON.stringify([
      { id: 1, sentiment: "positive", confidence: 0.9 },
      { id: 2, sentiment: "negative", confidence: 0.8 },
      { id: 99, sentiment: "neutral", confidence: 0.1 },
    ]);
    const result = parseModelResponse(raw, new Set([1, 2, 3]));
    expect(result.get(1)).toEqual({ sentiment: "positive", confidence: 0.9 });
    expect(result.get(2)).toEqual({ sentiment: "negative", confidence: 0.8 });
    expect(result.has(3)).toBe(false);
    expect(result.has(99)).toBe(false);
  });

  it("returns an empty map for malformed JSON", () => {
    const result = parseModelResponse("not json at all", new Set([1]));
    expect(result.size).toBe(0);
  });

  it("returns an empty map when the shape fails validation", () => {
    const result = parseModelResponse(
      JSON.stringify([{ id: 1, sentiment: "happy", confidence: 0.9 }]),
      new Set([1]),
    );
    expect(result.size).toBe(0);
  });
});

describe("classifyComments", () => {
  it("retries only the ids missing from the first response, then succeeds", async () => {
    const comments = [makeComment("a", "great video"), makeComment("b", "terrible")];

    const create = vi
      .fn()
      // first call: model only returns id 1, omits id 2
      .mockResolvedValueOnce(
        textResponse([{ id: 1, sentiment: "positive", confidence: 0.9 }]),
      )
      // retry call: only asked about the missing item (local id 2)
      .mockResolvedValueOnce(
        textResponse([{ id: 2, sentiment: "negative", confidence: 0.7 }]),
      );

    const fakeClient = { messages: { create } } as never;

    const scored = await classifyComments(comments, undefined, fakeClient);

    expect(create).toHaveBeenCalledTimes(2);
    expect(scored.find((c) => c.id === "a")?.sentiment).toBe("positive");
    expect(scored.find((c) => c.id === "b")?.sentiment).toBe("negative");
    expect(scored.find((c) => c.id === "b")?.confidence).toBe(0.7);
  });

  it("falls back to neutral/confidence 0 when a comment fails twice", async () => {
    const comments = [makeComment("a", "hello")];

    const create = vi
      .fn()
      .mockResolvedValueOnce(textResponse([]))
      .mockResolvedValueOnce(textResponse([]));

    const fakeClient = { messages: { create } } as never;

    const scored = await classifyComments(comments, undefined, fakeClient);

    expect(create).toHaveBeenCalledTimes(2);
    expect(scored[0].sentiment).toBe("neutral");
    expect(scored[0].confidence).toBe(0);
  });

  it("invokes onBatch as each batch resolves", async () => {
    const comments = [makeComment("a", "nice")];
    const create = vi
      .fn()
      .mockResolvedValueOnce(
        textResponse([{ id: 1, sentiment: "positive", confidence: 1 }]),
      );
    const fakeClient = { messages: { create } } as never;

    const onBatch = vi.fn();
    await classifyComments(comments, onBatch, fakeClient);

    expect(onBatch).toHaveBeenCalledTimes(1);
    expect(onBatch.mock.calls[0][0][0].sentiment).toBe("positive");
  });
});
