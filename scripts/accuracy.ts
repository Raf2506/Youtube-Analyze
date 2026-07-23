import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(__dirname, "../.env.local") });

import fixtures from "../tests/fixtures/labelled-comments.json";
import { classifyComments } from "../src/lib/sentiment";
import type { RawComment, Sentiment } from "../src/lib/types";

async function main() {
  const comments: RawComment[] = fixtures.map((f, i) => ({
    id: String(i),
    author: "fixture",
    authorAvatar: null,
    text: f.text,
    likeCount: 0,
    publishedAt: new Date().toISOString(),
    replyCount: 0,
  }));

  const scored = await classifyComments(comments);

  const confusion: Record<Sentiment, Record<Sentiment, number>> = {
    positive: { positive: 0, negative: 0, neutral: 0 },
    negative: { positive: 0, negative: 0, neutral: 0 },
    neutral: { positive: 0, negative: 0, neutral: 0 },
  };

  let correct = 0;
  scored.forEach((s, i) => {
    const expected = fixtures[i].label as Sentiment;
    confusion[expected][s.sentiment]++;
    if (s.sentiment === expected) correct++;
  });

  console.log(`Accuracy: ${((correct / scored.length) * 100).toFixed(1)}% (${correct}/${scored.length})\n`);
  console.log("Confusion matrix (rows = expected, cols = predicted):");
  console.log("            positive  negative   neutral");
  for (const expected of ["positive", "negative", "neutral"] as Sentiment[]) {
    const row = confusion[expected];
    console.log(
      `${expected.padEnd(10)}  ${String(row.positive).padStart(8)}  ${String(row.negative).padStart(8)}  ${String(row.neutral).padStart(8)}`,
    );
  }
}

main();
