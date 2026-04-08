import type { VercelRequest, VercelResponse } from "@vercel/node";
import { scrapePlugins } from "../src/serverless-pipeline";

export const maxDuration = 300; // 5 minutes max (Pro plan)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Optional: pass specific slugs via query param
  // e.g., /api/scrape?slugs=woocommerce,elementor,contact-form-7
  const slugsParam = req.query.slugs as string | undefined;
  const slugs = slugsParam ? slugsParam.split(",").map((s) => s.trim()) : undefined;

  try {
    console.log(`Scrape started: ${slugs ? slugs.join(", ") : "top 100 WooCommerce plugins"}`);
    const result = await scrapePlugins(slugs);

    return res.status(200).json({
      success: true,
      message: `Scraped ${result.total} plugins, ${result.newChangelogs} new changelog(s)`,
      ...result,
    });
  } catch (err: any) {
    console.error("Scrape error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
