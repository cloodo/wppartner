import { config } from "../config";
import {
  getPendingPosts,
  markPostStatus,
  getPostsCountToday,
  type PostRow,
} from "../db/database";
import { publishTextPost, publishVideoReel } from "./facebook";

export async function processPostQueue(): Promise<void> {
  const todayCount = getPostsCountToday();
  if (todayCount >= config.cron.maxPostsPerDay) {
    console.log(`  Daily post limit reached (${todayCount}/${config.cron.maxPostsPerDay}). Skipping.`);
    return;
  }

  const pendingPosts = getPendingPosts();
  if (pendingPosts.length === 0) {
    console.log("  No pending posts to publish.");
    return;
  }

  const remainingSlots = config.cron.maxPostsPerDay - todayCount;
  const postsToProcess = pendingPosts.slice(0, remainingSlots);

  console.log(`  Processing ${postsToProcess.length} pending post(s)...`);

  for (const post of postsToProcess) {
    await publishPost(post);

    // Wait between posts to avoid rate limiting
    if (postsToProcess.indexOf(post) < postsToProcess.length - 1) {
      const waitMs = config.cron.postIntervalHours * 60 * 60 * 1000;
      console.log(`  Waiting ${config.cron.postIntervalHours}h before next post...`);
      await sleep(waitMs);
    }
  }
}

async function publishPost(post: PostRow): Promise<void> {
  console.log(`  Publishing post #${post.id} (type: ${post.post_type})...`);

  try {
    let result;

    if (post.post_type === "video" || post.post_type === "reel") {
      if (!post.video_path) {
        markPostStatus(post.id, "failed", undefined, "No video path");
        return;
      }
      result = await publishVideoReel(post.video_path, post.content);
    } else {
      result = await publishTextPost(post.content);
    }

    if (result.success) {
      markPostStatus(post.id, "posted", result.id);
      console.log(`  Post #${post.id} published successfully.`);
    } else {
      markPostStatus(post.id, "failed", undefined, result.error);
      console.error(`  Post #${post.id} failed: ${result.error}`);
    }
  } catch (err: any) {
    markPostStatus(post.id, "failed", undefined, err.message);
    console.error(`  Post #${post.id} error: ${err.message}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
