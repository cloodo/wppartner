import {
  fetchWooCommercePlugins,
  fetchPluginDetails,
} from "./scraper/wordpress-api";
import {
  parseChangelog,
  getLatestEntry,
  changelogToPlainText,
} from "./scraper/changelog-parser";
import {
  upsertPlugin,
  insertChangelog,
  getUnpostedChangelogs,
  insertPost,
} from "./db/database";
import { generatePostContent } from "./content/generator";
import { createVideo, checkFfmpegAvailable } from "./video/creator";
import { processPostQueue } from "./publisher/queue";

export async function runScrapeAndDetect(): Promise<number> {
  console.log("\n=== Scraping WooCommerce Plugins ===");

  const plugins = await fetchWooCommercePlugins();
  console.log(`Found ${plugins.length} WooCommerce plugins`);

  let newChangelogs = 0;

  for (const plugin of plugins) {
    // Save plugin to DB
    upsertPlugin({
      slug: plugin.slug,
      name: plugin.name,
      active_installs: plugin.active_installs || 0,
      last_updated: plugin.last_updated || null,
      homepage: plugin.homepage || null,
    });

    // Fetch full details with changelog
    console.log(`\n  Checking: ${plugin.name} (${plugin.slug})...`);
    const details = await fetchPluginDetails(plugin.slug);

    if (!details?.sections?.changelog) {
      console.log(`    No changelog found, skipping.`);
      continue;
    }

    // Parse the changelog HTML
    const entries = parseChangelog(details.sections.changelog);
    const latest = getLatestEntry(entries);

    if (!latest) {
      console.log(`    Could not parse changelog, skipping.`);
      continue;
    }

    // Try to insert — returns null if already tracked
    const changelogId = insertChangelog(
      plugin.slug,
      latest.version,
      latest.rawHtml,
      changelogToPlainText(latest)
    );

    if (changelogId !== null) {
      console.log(`    NEW: v${latest.version} detected!`);
      newChangelogs++;
    } else {
      console.log(`    v${latest.version} already tracked.`);
    }

    // Rate limit: wait 500ms between API calls
    await sleep(500);
  }

  console.log(`\n=== Scrape complete. ${newChangelogs} new changelog(s) detected. ===\n`);
  return newChangelogs;
}

export async function runContentGeneration(): Promise<number> {
  console.log("\n=== Generating Content for New Changelogs ===");

  const unposted = getUnpostedChangelogs(10);
  if (unposted.length === 0) {
    console.log("  No new changelogs to generate content for.");
    return 0;
  }

  const hasFfmpeg = checkFfmpegAvailable();
  if (!hasFfmpeg) {
    console.log("  FFmpeg not found — skipping video generation. Install FFmpeg for video support.");
  }

  let generated = 0;

  for (const changelog of unposted) {
    console.log(`\n  Generating for: ${changelog.plugin_name} v${changelog.version}`);

    const changes = changelog.changelog_text
      ? changelog.changelog_text.split("\n").filter((l) => l.startsWith("•")).map((l) => l.slice(2))
      : [];

    if (changes.length === 0) {
      console.log("    No changes to summarize, skipping.");
      continue;
    }

    try {
      const content = await generatePostContent({
        pluginName: changelog.plugin_name,
        version: changelog.version,
        changes,
        pluginUrl: changelog.plugin_homepage || undefined,
      });

      // Create text post
      insertPost({
        changelog_id: changelog.id,
        post_type: "text",
        content: content.postText,
      });

      // Create video post if FFmpeg is available
      if (hasFfmpeg && content.videoSlides.length > 0) {
        try {
          const videoFilename = `${changelog.plugin_slug}-${changelog.version}`;
          const videoPath = await createVideo(content.videoSlides, videoFilename);

          insertPost({
            changelog_id: changelog.id,
            post_type: "reel",
            content: content.postText,
            video_path: videoPath,
          });
        } catch (videoErr: any) {
          console.error(`    Video creation failed: ${videoErr.message}`);
        }
      }

      generated++;
      console.log(`    Content generated successfully.`);
    } catch (err: any) {
      console.error(`    Content generation failed: ${err.message}`);
    }
  }

  console.log(`\n=== Content generation complete. ${generated} post(s) created. ===\n`);
  return generated;
}

export async function runPublish(): Promise<void> {
  console.log("\n=== Publishing Posts to Facebook ===");
  await processPostQueue();
  console.log("=== Publishing complete. ===\n");
}

export async function runFullPipeline(): Promise<void> {
  console.log("========================================");
  console.log("  WPPartner — Full Pipeline Run");
  console.log(`  ${new Date().toISOString()}`);
  console.log("========================================");

  // Step 1: Scrape and detect new changelogs
  const newCount = await runScrapeAndDetect();

  // Step 2: Generate content for new changelogs
  if (newCount > 0) {
    await runContentGeneration();
  }

  // Step 3: Publish pending posts
  await runPublish();

  console.log("========================================");
  console.log("  Pipeline complete!");
  console.log("========================================");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
