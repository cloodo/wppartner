import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runFullServerlessPipeline } from "../../src/serverless-pipeline";

export const maxDuration = 300;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = req.headers["authorization"];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn("Unauthorized cron attempt");
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    console.log(`Full pipeline started at ${new Date().toISOString()}`);
    const result = await runFullServerlessPipeline();

    console.log("Pipeline complete:", JSON.stringify(result, null, 2));
    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (err: any) {
    console.error("Pipeline error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
