import cron from "node-cron";
import { config } from "./config";
import { runFullPipeline } from "./pipeline";
import { getDb, closeDb } from "./db/database";

async function main(): Promise<void> {
  console.log("WPPartner — WooCommerce Changelog Facebook Poster");
  console.log("==================================================\n");

  // Initialize database
  getDb();
  console.log(`Database initialized at: ${config.db.path}`);

  // Validate config
  if (!config.anthropicApiKey) {
    console.warn("WARNING: ANTHROPIC_API_KEY not set. Content generation will fail.");
  }
  if (!config.facebook.pageId || !config.facebook.pageAccessToken) {
    console.warn("WARNING: Facebook credentials not set. Publishing will fail.");
  }

  // Run once immediately
  console.log("\nRunning initial pipeline...\n");
  await runFullPipeline();

  // Schedule recurring runs
  console.log(`\nScheduling cron: "${config.cron.schedule}"`);
  cron.schedule(config.cron.schedule, async () => {
    console.log(`\nCron triggered at ${new Date().toISOString()}`);
    try {
      await runFullPipeline();
    } catch (err: any) {
      console.error(`Pipeline error: ${err.message}`);
    }
  });

  console.log("WPPartner is running. Press Ctrl+C to stop.\n");

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\nShutting down...");
    closeDb();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("\nShutting down...");
    closeDb();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  closeDb();
  process.exit(1);
});
