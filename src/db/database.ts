import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { config } from "../config";

let db: Database.Database;

export interface PluginRow {
  slug: string;
  name: string;
  active_installs: number;
  last_updated: string | null;
  homepage: string | null;
}

export interface ChangelogRow {
  id: number;
  plugin_slug: string;
  version: string;
  changelog_html: string | null;
  changelog_text: string | null;
  detected_at: string;
}

export interface PostRow {
  id: number;
  changelog_id: number;
  post_type: "text" | "video" | "reel";
  content: string;
  video_path: string | null;
  facebook_post_id: string | null;
  status: "pending" | "posted" | "failed";
  scheduled_at: string | null;
  posted_at: string | null;
  error_message: string | null;
}

export function getDb(): Database.Database {
  if (!db) {
    const dbDir = path.dirname(config.db.path);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    db = new Database(config.db.path);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");

    const schemaPath = path.join(__dirname, "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf-8");
    db.exec(schema);
  }
  return db;
}

export function upsertPlugin(plugin: PluginRow): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO plugins (slug, name, active_installs, last_updated, homepage)
    VALUES (@slug, @name, @active_installs, @last_updated, @homepage)
    ON CONFLICT(slug) DO UPDATE SET
      name = @name,
      active_installs = @active_installs,
      last_updated = @last_updated,
      homepage = @homepage
  `).run(plugin);
}

export function insertChangelog(
  pluginSlug: string,
  version: string,
  changelogHtml: string,
  changelogText: string
): number | null {
  const db = getDb();
  try {
    const result = db.prepare(`
      INSERT INTO changelogs (plugin_slug, version, changelog_html, changelog_text)
      VALUES (?, ?, ?, ?)
    `).run(pluginSlug, version, changelogHtml, changelogText);
    return result.lastInsertRowid as number;
  } catch (err: any) {
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return null; // Already tracked
    }
    throw err;
  }
}

export function getUnpostedChangelogs(limit: number = 10): Array<ChangelogRow & { plugin_name: string; plugin_homepage: string | null }> {
  const db = getDb();
  return db.prepare(`
    SELECT c.*, p.name as plugin_name, p.homepage as plugin_homepage
    FROM changelogs c
    JOIN plugins p ON c.plugin_slug = p.slug
    WHERE c.id NOT IN (SELECT changelog_id FROM posts WHERE status IN ('posted', 'pending'))
    ORDER BY c.detected_at DESC
    LIMIT ?
  `).all(limit) as any;
}

export function insertPost(post: {
  changelog_id: number;
  post_type: "text" | "video" | "reel";
  content: string;
  video_path?: string;
  scheduled_at?: string;
}): number {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO posts (changelog_id, post_type, content, video_path, scheduled_at)
    VALUES (@changelog_id, @post_type, @content, @video_path, @scheduled_at)
  `).run({
    ...post,
    video_path: post.video_path || null,
    scheduled_at: post.scheduled_at || null,
  });
  return result.lastInsertRowid as number;
}

export function getPendingPosts(): PostRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM posts
    WHERE status = 'pending'
      AND (scheduled_at IS NULL OR scheduled_at <= datetime('now'))
    ORDER BY created_at ASC
  `).all() as PostRow[];
}

export function markPostStatus(
  postId: number,
  status: "posted" | "failed",
  facebookPostId?: string,
  errorMessage?: string
): void {
  const db = getDb();
  db.prepare(`
    UPDATE posts SET
      status = ?,
      facebook_post_id = ?,
      posted_at = CASE WHEN ? = 'posted' THEN datetime('now') ELSE posted_at END,
      error_message = ?
    WHERE id = ?
  `).run(status, facebookPostId || null, status, errorMessage || null, postId);
}

export function getPostsCountToday(): number {
  const db = getDb();
  const row = db.prepare(`
    SELECT COUNT(*) as count FROM posts
    WHERE status = 'posted'
      AND posted_at >= date('now')
  `).get() as { count: number };
  return row.count;
}

export function closeDb(): void {
  if (db) {
    db.close();
  }
}
