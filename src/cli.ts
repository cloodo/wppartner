import { config } from "./config";
import { getDb, closeDb } from "./db/database";
import { runScrapeAndDetect, runContentGeneration, runPublish } from "./pipeline";

const command = process.argv[2];

async function main(): Promise<void> {
  // Initialize database
  getDb();

  switch (command) {
    case "scrape":
      console.log("Running scraper...\n");
      await runScrapeAndDetect();
      break;

    case "generate":
      console.log("Running content generator...\n");
      await runContentGeneration();
      break;

    case "post":
      console.log("Running publisher...\n");
      await runPublish();
      break;

    default:
      console.log(`
WPPartner CLI — WooCommerce Changelog Facebook Poster

Usage:
  npm run dev          Run the full pipeline with cron scheduler
  npm run scrape       Scrape plugins and detect new changelogs
  npm run generate     Generate AI content for new changelogs
  npm run post         Publish pending posts to Facebook

Configuration:
  Copy .env.example to .env and fill in your API keys.
      `);
      break;
  }

  closeDb();
}

main().catch((err) => {
  console.error("Error:", err);
  closeDb();
  process.exit(1);
});
