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
import * as db from "./db/vercel-db";
import { generatePostContent } from "./content/generator";
import { publishTextPost, publishVideoReel } from "./publisher/facebook";

/**
 * Scrape top WooCommerce plugins and detect new changelogs.
 * Designed for serverless: batched, async, returns results.
 */
export async function scrapePlugins(slugs?: string[]): Promise<{
  total: number;
  newChangelogs: number;
  plugins: string[];
}> {
  await db.initDb();

  let plugins: WPPluginInfo[];

  if (slugs && slugs.length > 0) {
    // Fetch specific plugins
    plugins = [];
    for (const slug of slugs) {
      const details = await fetchPluginDetails(slug);
      if (details) plugins.push(details);
    }
  } else {
    // Fetch top 100 WooCommerce plugins
    plugins = await fetchWooCommercePlugins();
  }

  let newChangelogs = 0;
  const processed: string[] = [];

  for (const plugin of plugins) {
    await db.upsertPlugin({
      slug: plugin.slug,
      name: plugin.name,
      active_installs: plugin.active_installs || 0,
      last_updated: plugin.last_updated || null,
      homepage: plugin.homepage || null,
    });

    // Get changelog
    let changelog = plugin.sections?.changelog;
    if (!changelog) {
      const details = await fetchPluginDetails(plugin.slug);
      if (!details?.sections?.changelog) continue;
      changelog = details.sections.changelog;
    }

    const entries = parseChangelog(changelog);
    const latest = getLatestEntry(entries);
    if (!latest) continue;

    const changelogId = await db.insertChangelog(
      plugin.slug,
      latest.version,
      latest.rawHtml,
      changelogToPlainText(latest)
    );

    if (changelogId !== null) {
      newChangelogs++;
      processed.push(`${plugin.name} v${latest.version}`);
    }
  }

  return { total: plugins.length, newChangelogs, plugins: processed };
}

/**
 * Generate AI content for unposted changelogs.
 */
export async function generateContent(limit: number = 10): Promise<{
  generated: number;
  posts: string[];
}> {
  await db.initDb();

  const unposted = await db.getUnpostedChangelogs(limit);
  if (unposted.length === 0) {
    return { generated: 0, posts: [] };
  }

  let generated = 0;
  const posts: string[] = [];

  for (const changelog of unposted) {
    const changes = changelog.changelog_text
      ? changelog.changelog_text.split("\n").filter((l: string) => l.startsWith("•")).map((l: string) => l.slice(2))
      : [];

    if (changes.length === 0) continue;

    try {
      const content = await generatePostContent({
        pluginName: changelog.plugin_name,
        version: changelog.version,
        changes,
        pluginUrl: changelog.plugin_homepage || undefined,
      });

      await db.insertPost({
        changelog_id: changelog.id,
        post_type: "text",
        content: content.postText,
      });

      generated++;
      posts.push(`${changelog.plugin_name} v${changelog.version}`);
    } catch (err: any) {
      console.error(`Content generation failed for ${changelog.plugin_slug}: ${err.message}`);
    }
  }

  return { generated, posts };
}

/**
 * Publish pending posts to Facebook.
 */
export async function publishPosts(maxPosts: number = 4): Promise<{
  published: number;
  failed: number;
  results: Array<{ plugin: string; status: string; facebookId?: string; error?: string }>;
}> {
  await db.initDb();

  const todayCount = await db.getPostsCountToday();
  if (todayCount >= maxPosts) {
    return { published: 0, failed: 0, results: [{ plugin: "", status: "skipped", error: `Daily limit reached (${todayCount}/${maxPosts})` }] };
  }

  const pending = await db.getPendingPosts();
  if (pending.length === 0) {
    return { published: 0, failed: 0, results: [] };
  }

  const remaining = maxPosts - todayCount;
  const toProcess = pending.slice(0, remaining);

  let published = 0;
  let failed = 0;
  const results: Array<{ plugin: string; status: string; facebookId?: string; error?: string }> = [];

  for (const post of toProcess) {
    try {
      const result = await publishTextPost(post.content);

      if (result.success) {
        await db.markPostStatus(post.id, "posted", result.id);
        published++;
        results.push({ plugin: `Post #${post.id}`, status: "posted", facebookId: result.id });
      } else {
        await db.markPostStatus(post.id, "failed", undefined, result.error);
        failed++;
        results.push({ plugin: `Post #${post.id}`, status: "failed", error: result.error });
      }
    } catch (err: any) {
      await db.markPostStatus(post.id, "failed", undefined, err.message);
      failed++;
      results.push({ plugin: `Post #${post.id}`, status: "failed", error: err.message });
    }
  }

  return { published, failed, results };
}

/**
 * Full pipeline: scrape → generate → publish.
 */
export async function runFullServerlessPipeline(): Promise<{
  scrape: Awaited<ReturnType<typeof scrapePlugins>>;
  generate: Awaited<ReturnType<typeof generateContent>>;
  publish: Awaited<ReturnType<typeof publishPosts>>;
}> {
  const scrape = await scrapePlugins();
  const generate = await generateContent();
  const publish = await publishPosts();

  return { scrape, generate, publish };
}
