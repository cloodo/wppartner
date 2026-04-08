import {
  fetchWooCommercePlugins,
  fetchPluginDetails,
  type WPPluginInfo,
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

// Default test plugins — 3 popular WooCommerce plugins for quick testing
const TEST_PLUGIN_SLUGS = [
  "woocommerce",
  "woocommerce-payments",
  "woo-gutenberg-products-block",
];

/**
 * Scrape only specific plugins by slug (for testing or targeted monitoring).
 */
export async function runScrapeSpecificPlugins(slugs: string[]): Promise<number> {
  console.log(`\n=== Scraping ${slugs.length} Specific Plugin(s) ===`);

  const plugins: WPPluginInfo[] = [];
  for (const slug of slugs) {
    console.log(`\n  Fetching: ${slug}...`);
    const details = await fetchPluginDetails(slug);
    if (details) {
      plugins.push(details);
    } else {
      console.log(`    Could not fetch ${slug}, skipping.`);
    }
  }

  console.log(`\nFetched ${plugins.length} plugin(s)`);
  return processPlugins(plugins);
}

export async function runScrapeAndDetect(): Promise<number> {
  console.log("\n=== Scraping WooCommerce Plugins ===");

  const plugins = await fetchWooCommercePlugins();
  console.log(`Found ${plugins.length} WooCommerce plugins`);

  return processPlugins(plugins);
}

async function processPlugins(plugins: WPPluginInfo[]): Promise<number> {
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

    // If we already have sections.changelog from fetchPluginDetails, use it directly.
    // Otherwise fetch full details.
    let changelog = plugin.sections?.changelog;
    if (!changelog) {
      console.log(`\n  Checking: ${plugin.name} (${plugin.slug})...`);
      const details = await fetchPluginDetails(plugin.slug);

      if (!details?.sections?.changelog) {
        console.log(`    No changelog found, skipping.`);
        continue;
      }
      changelog = details.sections.changelog;
    } else {
      console.log(`\n  Processing: ${plugin.name} (${plugin.slug})...`);
    }

    // Parse the changelog HTML
    const entries = parseChangelog(changelog);
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

/**
 * Test pipeline: scrape 3 plugins → generate AI posts → show results.
 * No Facebook posting — just generates content and displays it.
 */
export async function runTestPipeline(slugs?: string[]): Promise<void> {
  const targetSlugs = slugs && slugs.length > 0 ? slugs : TEST_PLUGIN_SLUGS;

  console.log("========================================");
  console.log("  WPPartner — TEST MODE");
  console.log(`  Plugins: ${targetSlugs.join(", ")}`);
  console.log("========================================");

  // Step 1: Scrape specific plugins
  const newCount = await runScrapeSpecificPlugins(targetSlugs);

  // Step 2: Generate content
  if (newCount > 0) {
    await runContentGeneration();
  } else {
    console.log("\n  No new changelogs — trying to generate for existing unposted ones...");
    await runContentGeneration();
  }

  // Step 3: Show generated posts (don't actually publish to Facebook)
  const unposted = getUnpostedChangelogs(10);
  if (unposted.length > 0) {
    console.log("\n========================================");
    console.log("  PREVIEW — Generated Posts:");
    console.log("========================================\n");
  }

  console.log("========================================");
  console.log("  Test complete! Run 'npm run post' to publish to Facebook.");
  console.log("========================================");
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
