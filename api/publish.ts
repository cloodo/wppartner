import type { VercelRequest, VercelResponse } from "@vercel/node";
import { publishPosts } from "../src/serverless-pipeline";

export const maxDuration = 60;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log("Publishing pending posts to Facebook...");
    const result = await publishPosts();

    return res.status(200).json({
      success: true,
      message: `Published ${result.published}, failed ${result.failed}`,
      ...result,
    });
  } catch (err: any) {
    console.error("Publish error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
