import axios from "axios";
import fs from "fs";
import path from "path";
import { config } from "../config";

const GRAPH_API_BASE = `https://graph.facebook.com/${config.facebook.graphApiVersion}`;

interface PostResult {
  id: string;
  success: boolean;
  error?: string;
}

export async function publishTextPost(message: string, link?: string): Promise<PostResult> {
  const { pageId, pageAccessToken } = config.facebook;

  if (!pageId || !pageAccessToken) {
    return { id: "", success: false, error: "Facebook credentials not configured" };
  }

  try {
    const payload: Record<string, string> = {
      message,
      access_token: pageAccessToken,
    };
    if (link) {
      payload.link = link;
    }

    const response = await axios.post(
      `${GRAPH_API_BASE}/${pageId}/feed`,
      payload
    );

    console.log(`  Posted to Facebook: ${response.data.id}`);
    return { id: response.data.id, success: true };
  } catch (err: any) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error(`  Facebook post error: ${errorMsg}`);
    return { id: "", success: false, error: errorMsg };
  }
}

export async function publishVideoReel(
  videoPath: string,
  description: string
): Promise<PostResult> {
  const { pageId, pageAccessToken } = config.facebook;

  if (!pageId || !pageAccessToken) {
    return { id: "", success: false, error: "Facebook credentials not configured" };
  }

  if (!fs.existsSync(videoPath)) {
    return { id: "", success: false, error: `Video file not found: ${videoPath}` };
  }

  try {
    // Step 1: Initialize upload
    console.log("  Step 1: Initializing video upload...");
    const initResponse = await axios.post(
      `${GRAPH_API_BASE}/${pageId}/video_reels`,
      {
        upload_phase: "start",
        access_token: pageAccessToken,
      }
    );

    const videoId = initResponse.data.video_id;
    console.log(`  Got video_id: ${videoId}`);

    // Step 2: Upload video binary
    console.log("  Step 2: Uploading video file...");
    const fileBuffer = fs.readFileSync(videoPath);
    const fileSize = fs.statSync(videoPath).size;

    await axios.post(
      `https://rupload.facebook.com/video-upload/${config.facebook.graphApiVersion}/${videoId}`,
      fileBuffer,
      {
        headers: {
          Authorization: `OAuth ${pageAccessToken}`,
          "Content-Type": "application/octet-stream",
          file_size: fileSize.toString(),
        },
      }
    );

    // Step 3: Publish the reel
    console.log("  Step 3: Publishing reel...");
    const publishResponse = await axios.post(
      `${GRAPH_API_BASE}/${pageId}/video_reels`,
      {
        upload_phase: "finish",
        video_id: videoId,
        description,
        access_token: pageAccessToken,
      }
    );

    const postId = publishResponse.data.id || videoId;
    console.log(`  Reel published: ${postId}`);
    return { id: postId, success: true };
  } catch (err: any) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error(`  Facebook video error: ${errorMsg}`);
    return { id: "", success: false, error: errorMsg };
  }
}

export async function verifyPageToken(): Promise<boolean> {
  const { pageAccessToken } = config.facebook;

  if (!pageAccessToken) {
    console.error("  No Facebook page access token configured");
    return false;
  }

  try {
    const response = await axios.get(`${GRAPH_API_BASE}/me`, {
      params: { access_token: pageAccessToken },
    });
    console.log(`  Facebook token valid for page: ${response.data.name} (${response.data.id})`);
    return true;
  } catch (err: any) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error(`  Facebook token invalid: ${errorMsg}`);
    return false;
  }
}
