import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(__dirname, "../.env.local") });

import { extractVideoId } from "../src/lib/youtube-url";
import { fetchComments, getVideoMeta } from "../src/lib/youtube-client";
import { YoutubeApiError } from "../src/lib/types";

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error("Usage: npm run probe -- <youtube-url>");
    process.exit(1);
  }

  const videoId = extractVideoId(input);
  if (!videoId) {
    console.error(`Could not extract a video ID from: ${input}`);
    process.exit(1);
  }

  try {
    const meta = await getVideoMeta(videoId);
    console.log(`Title: ${meta.title}`);
    console.log(`Channel: ${meta.channelTitle}`);
    console.log(`Total comments: ${meta.totalCommentCount}`);

    const comments = await fetchComments(videoId, 5);
    console.log(`\nFetched ${comments.length} comments:\n`);
    for (const c of comments) {
      console.log(`- [${c.author}] (${c.likeCount} likes) ${c.text.slice(0, 120)}`);
    }
  } catch (err) {
    if (err instanceof YoutubeApiError) {
      console.error(`[${err.code}] ${err.message}`);
      process.exit(1);
    }
    throw err;
  }
}

main();
