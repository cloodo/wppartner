import { getDb, closeDb } from "./db/database";
import {
  runScrapeAndDetect,
  runScrapeSpecificPlugins,
  runContentGeneration,
  runPublish,
  runTestPipeline,
} from "./pipeline";

const command = process.argv[2];
const extraArgs = process.argv.slice(3);

async function main(): Promise<void> {
  // Initialize database
  getDb();

  switch (command) {
    case "scrape":
      console.log("Running scraper...\n");
      if (extraArgs.length > 0) {
        // Scrape specific plugins: npm run scrape -- woocommerce jetpack
        await runScrapeSpecificPlugins(extraArgs);
      } else {
        await runScrapeAndDetect();
      }
      break;

    case "generate":
      console.log("Running content generator...\n");
      await runContentGeneration();
      break;

    case "post":
      console.log("Running publisher...\n");
      await runPublish();
      break;

    case "test":
      // Test with 3 plugins (or custom slugs): npm run test -- slug1 slug2
      await runTestPipeline(extraArgs.length > 0 ? extraArgs : undefined);
      break;

    default:
      console.log(`
WPPartner CLI — WooCommerce Changelog Facebook Poster

Usage:
  npm run dev                     Full pipeline with cron scheduler
  npm run scrape                  Scrape top 100 WooCommerce plugins
  npm run scrape -- slug1 slug2   Scrape specific plugins by slug
  npm run generate                Generate AI content for new changelogs
  npm run post                    Publish pending posts to Facebook
  npm run test                    Test with 3 default plugins (scrape + generate)
  npm run test -- slug1 slug2     Test with custom plugin slugs

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
