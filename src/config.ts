import dotenv from "dotenv";
import path from "path";

dotenv.config();

export const config = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  facebook: {
    pageId: process.env.FACEBOOK_PAGE_ID || "",
    pageAccessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "",
    graphApiVersion: "v25.0",
  },
  cron: {
    schedule: process.env.CRON_SCHEDULE || "0 */6 * * *",
    maxPostsPerDay: parseInt(process.env.MAX_POSTS_PER_DAY || "4", 10),
    postIntervalHours: parseInt(process.env.POST_INTERVAL_HOURS || "3", 10),
  },
  db: {
    path: process.env.DB_PATH || path.join(process.cwd(), "data", "wppartner.db"),
  },
  video: {
    outputDir: process.env.VIDEO_OUTPUT_DIR || path.join(process.cwd(), "data", "videos"),
  },
  wordpress: {
    apiBase: "https://api.wordpress.org/plugins/info/1.2/",
    pluginsPerPage: 100,
    maxPages: 2,
  },
} as const;
