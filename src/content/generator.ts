import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config";
import {
  buildPostPrompt,
  buildVideoScriptPrompt,
  detectPostStyle,
} from "./prompts";

export interface VideoSlide {
  text: string;
  duration: number;
}

export interface GeneratedContent {
  postText: string;
  videoSlides: VideoSlide[];
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: config.anthropicApiKey });
  }
  return client;
}

export async function generatePostContent(params: {
  pluginName: string;
  version: string;
  changes: string[];
  pluginUrl?: string;
}): Promise<GeneratedContent> {
  const { pluginName, version, changes, pluginUrl } = params;
  const style = detectPostStyle(version, changes);

  console.log(`  Generating content for ${pluginName} v${version} (style: ${style})`);

  const [postText, videoSlides] = await Promise.all([
    generatePost(pluginName, version, changes, pluginUrl, style),
    generateVideoScript(pluginName, version, changes),
  ]);

  return { postText, videoSlides };
}

async function generatePost(
  pluginName: string,
  version: string,
  changes: string[],
  pluginUrl: string | undefined,
  style: ReturnType<typeof detectPostStyle>
): Promise<string> {
  const prompt = buildPostPrompt({ pluginName, version, changes, style, pluginUrl });
  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock?.text || "";
}

async function generateVideoScript(
  pluginName: string,
  version: string,
  changes: string[]
): Promise<VideoSlide[]> {
  const prompt = buildVideoScriptPrompt({ pluginName, version, changes });
  const anthropic = getClient();

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock?.text) return getDefaultSlides(pluginName, version);

    const parsed = JSON.parse(textBlock.text);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as VideoSlide[];
    }
  } catch (err: any) {
    console.error(`  Error generating video script: ${err.message}`);
  }

  return getDefaultSlides(pluginName, version);
}

function getDefaultSlides(pluginName: string, version: string): VideoSlide[] {
  return [
    { text: `${pluginName} v${version}`, duration: 3 },
    { text: "New update just dropped!", duration: 3 },
    { text: "Check the changelog for details", duration: 4 },
    { text: "Update now! Link in comments", duration: 3 },
  ];
}
