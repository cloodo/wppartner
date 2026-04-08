import { sql } from "@vercel/postgres";

export async function initDb(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS plugins (
      slug TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      active_installs INTEGER DEFAULT 0,
      last_updated TEXT,
      homepage TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS changelogs (
      id SERIAL PRIMARY KEY,
      plugin_slug TEXT NOT NULL,
      version TEXT NOT NULL,
      changelog_html TEXT,
      changelog_text TEXT,
      detected_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(plugin_slug, version)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      changelog_id INTEGER NOT NULL,
      post_type TEXT NOT NULL CHECK(post_type IN ('text', 'video', 'reel')),
      content TEXT NOT NULL,
      video_path TEXT,
      facebook_post_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'posted', 'failed')),
      scheduled_at TIMESTAMP,
      posted_at TIMESTAMP,
      error_message TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_changelogs_plugin ON changelogs(plugin_slug)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status)`;
}

export async function upsertPlugin(plugin: {
  slug: string;
  name: string;
  active_installs: number;
  last_updated: string | null;
  homepage: string | null;
}): Promise<void> {
  await sql`
    INSERT INTO plugins (slug, name, active_installs, last_updated, homepage)
    VALUES (${plugin.slug}, ${plugin.name}, ${plugin.active_installs}, ${plugin.last_updated}, ${plugin.homepage})
    ON CONFLICT(slug) DO UPDATE SET
      name = EXCLUDED.name,
      active_installs = EXCLUDED.active_installs,
      last_updated = EXCLUDED.last_updated,
      homepage = EXCLUDED.homepage
  `;
}

export async function insertChangelog(
  pluginSlug: string,
  version: string,
  changelogHtml: string,
  changelogText: string
): Promise<number | null> {
  try {
    const result = await sql`
      INSERT INTO changelogs (plugin_slug, version, changelog_html, changelog_text)
      VALUES (${pluginSlug}, ${version}, ${changelogHtml}, ${changelogText})
      RETURNING id
    `;
    return result.rows[0].id;
  } catch (err: any) {
    if (err.message?.includes("duplicate key") || err.code === "23505") {
      return null; // Already tracked
    }
    throw err;
  }
}

export async function getUnpostedChangelogs(limit: number = 10) {
  const result = await sql`
    SELECT c.*, p.name as plugin_name, p.homepage as plugin_homepage
    FROM changelogs c
    JOIN plugins p ON c.plugin_slug = p.slug
    WHERE c.id NOT IN (SELECT changelog_id FROM posts WHERE status IN ('posted', 'pending'))
    ORDER BY c.detected_at DESC
    LIMIT ${limit}
  `;
  return result.rows;
}

export async function insertPost(post: {
  changelog_id: number;
  post_type: "text" | "video" | "reel";
  content: string;
  video_path?: string;
  scheduled_at?: string;
}): Promise<number> {
  const result = await sql`
    INSERT INTO posts (changelog_id, post_type, content, video_path, scheduled_at)
    VALUES (${post.changelog_id}, ${post.post_type}, ${post.content}, ${post.video_path || null}, ${post.scheduled_at || null})
    RETURNING id
  `;
  return result.rows[0].id;
}

export async function getPendingPosts() {
  const result = await sql`
    SELECT * FROM posts
    WHERE status = 'pending'
      AND (scheduled_at IS NULL OR scheduled_at <= NOW())
    ORDER BY created_at ASC
  `;
  return result.rows;
}

export async function markPostStatus(
  postId: number,
  status: "posted" | "failed",
  facebookPostId?: string,
  errorMessage?: string
): Promise<void> {
  await sql`
    UPDATE posts SET
      status = ${status},
      facebook_post_id = ${facebookPostId || null},
      posted_at = CASE WHEN ${status} = 'posted' THEN NOW() ELSE posted_at END,
      error_message = ${errorMessage || null}
    WHERE id = ${postId}
  `;
}

export async function getPostsCountToday(): Promise<number> {
  const result = await sql`
    SELECT COUNT(*) as count FROM posts
    WHERE status = 'posted'
      AND posted_at >= CURRENT_DATE
  `;
  return parseInt(result.rows[0].count, 10);
}
