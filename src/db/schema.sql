CREATE TABLE IF NOT EXISTS plugins (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  active_installs INTEGER DEFAULT 0,
  last_updated TEXT,
  homepage TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS changelogs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plugin_slug TEXT NOT NULL,
  version TEXT NOT NULL,
  changelog_html TEXT,
  changelog_text TEXT,
  detected_at TEXT DEFAULT (datetime('now')),
  UNIQUE(plugin_slug, version),
  FOREIGN KEY (plugin_slug) REFERENCES plugins(slug)
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  changelog_id INTEGER NOT NULL,
  post_type TEXT NOT NULL CHECK(post_type IN ('text', 'video', 'reel')),
  content TEXT NOT NULL,
  video_path TEXT,
  facebook_post_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'posted', 'failed')),
  scheduled_at TEXT,
  posted_at TEXT,
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (changelog_id) REFERENCES changelogs(id)
);

CREATE INDEX IF NOT EXISTS idx_changelogs_plugin ON changelogs(plugin_slug);
CREATE INDEX IF NOT EXISTS idx_changelogs_detected ON changelogs(detected_at);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled ON posts(scheduled_at);
