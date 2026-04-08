import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateContent } from "../src/serverless-pipeline";

export const maxDuration = 300;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const limit = parseInt(req.query.limit as string) || 10;

  try {
    console.log(`Generating content for up to ${limit} changelogs...`);
    const result = await generateContent(limit);

    return res.status(200).json({
      success: true,
      message: `Generated ${result.generated} post(s)`,
      ...result,
    });
  } catch (err: any) {
    console.error("Generate error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
