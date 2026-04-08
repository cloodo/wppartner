# WPPartner

Broadcasting new changelogs of WordPress and WooCommerce plugins to Facebook Pages — automatically, with AI-generated viral posts and short videos.

## What It Does

1. **Scrapes** the top 100 WooCommerce plugins from WordPress.org
2. **Detects** new changelog versions (tracks what's already been posted)
3. **Generates** engaging Facebook post copy using Claude AI
4. **Creates** short vertical videos (9:16 Reels) using FFmpeg
5. **Publishes** text posts and video Reels to your Facebook Page
6. **Runs on a schedule** (every 6 hours by default)

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your API keys:

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Your Claude API key from console.anthropic.com |
| `FACEBOOK_PAGE_ID` | Your Facebook Page ID |
| `FACEBOOK_PAGE_ACCESS_TOKEN` | Never-expiring Page Access Token |

### 3. Run

```bash
# Full pipeline with cron scheduler
npm run dev

# Or run individual steps:
npm run scrape      # Scrape plugins, detect new changelogs
npm run generate    # Generate AI content for new changelogs
npm run post        # Publish pending posts to Facebook
```

## Getting a Facebook Page Access Token

1. Go to [developers.facebook.com](https://developers.facebook.com) and create a Business app
2. Add the **Facebook Login** product
3. Request these permissions: `pages_manage_posts`, `pages_read_engagement`, `publish_video`
4. Generate a **User Access Token** with the permissions above
5. Exchange for a **long-lived token**: `GET /oauth/access_token?grant_type=fb_exchange_token&client_id={APP_ID}&client_secret={APP_SECRET}&fb_exchange_token={SHORT_TOKEN}`
6. Get the **Page Access Token**: `GET /me/accounts?access_token={LONG_LIVED_USER_TOKEN}`
7. The Page Access Token from step 6 never expires

## Architecture

```
src/
├── index.ts              # Entry point + cron scheduler
├── cli.ts                # CLI commands (scrape/generate/post)
├── config.ts             # Environment configuration
├── pipeline.ts           # Main pipeline orchestration
├── scraper/
│   ├── wordpress-api.ts  # WordPress.org Plugin API client
│   └── changelog-parser.ts # HTML changelog parser
├── content/
│   ├── generator.ts      # Claude AI content generation
│   └── prompts.ts        # Prompt templates for different post styles
├── video/
│   └── creator.ts        # FFmpeg video generation
├── publisher/
│   ├── facebook.ts       # Facebook Graph API client
│   └── queue.ts          # Post queue management
└── db/
    ├── database.ts       # SQLite database layer
    └── schema.sql        # Database schema
```

## Configuration

| Variable | Default | Description |
|---|---|---|
| `CRON_SCHEDULE` | `0 */6 * * *` | How often to check for updates (every 6 hours) |
| `MAX_POSTS_PER_DAY` | `4` | Maximum Facebook posts per day |
| `POST_INTERVAL_HOURS` | `3` | Hours between posts |
| `DB_PATH` | `./data/wppartner.db` | SQLite database location |
| `VIDEO_OUTPUT_DIR` | `./data/videos` | Generated video output directory |

## Post Styles

The AI detects the update type and adjusts the writing style:

- **Breaking Update** — Major version changes (e.g., v9.0.0). Urgent, exciting tone.
- **New Feature** — Updates that add new functionality. Enthusiastic, benefit-focused.
- **Quick Tip** — Patches and fixes. Helpful, keep-your-store-running tone.

## Requirements

- **Node.js** 20+
- **FFmpeg** (optional, for video generation)
- **Claude API key** (for AI content generation)
- **Facebook Page + App** (for publishing)

## License

MIT
