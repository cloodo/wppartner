export const POST_STYLE_BREAKING = "breaking_update";
export const POST_STYLE_TIP = "quick_tip";
export const POST_STYLE_FEATURE = "new_feature";

export type PostStyle = typeof POST_STYLE_BREAKING | typeof POST_STYLE_TIP | typeof POST_STYLE_FEATURE;

export function detectPostStyle(version: string, changes: string[]): PostStyle {
  const isMajor = version.match(/^\d+\.0(\.0)?$/) !== null;
  const hasNewFeature = changes.some(
    (c) =>
      c.toLowerCase().includes("add") ||
      c.toLowerCase().includes("new") ||
      c.toLowerCase().includes("introduce")
  );

  if (isMajor) return POST_STYLE_BREAKING;
  if (hasNewFeature) return POST_STYLE_FEATURE;
  return POST_STYLE_TIP;
}

export function buildPostPrompt(params: {
  pluginName: string;
  version: string;
  changes: string[];
  style: PostStyle;
  pluginUrl?: string;
}): string {
  const { pluginName, version, changes, style, pluginUrl } = params;
  const changeList = changes.slice(0, 15).map((c) => `- ${c}`).join("\n");

  const styleInstructions: Record<PostStyle, string> = {
    [POST_STYLE_BREAKING]: `This is a MAJOR version update. Write with excitement and urgency.
Use a hook like "🚨 BREAKING: ${pluginName} just dropped a massive update..." or "Big news for WooCommerce store owners!"
Emphasize what's new and why it matters for store owners.`,

    [POST_STYLE_TIP]: `This is a maintenance/patch update. Write it as a helpful tip.
Use a hook like "Quick tip for ${pluginName} users..." or "Did you know? ${pluginName} just fixed..."
Focus on reliability and keeping stores running smoothly.`,

    [POST_STYLE_FEATURE]: `This is a feature update. Write with enthusiasm about the new capabilities.
Use a hook like "New feature alert! ${pluginName} now lets you..." or "${pluginName} just got even better..."
Highlight the new feature and how it benefits store owners.`,
  };

  return `You are a social media expert for a WordPress/WooCommerce news page. Create an engaging Facebook post about a plugin update.

PLUGIN: ${pluginName}
VERSION: ${version}
${pluginUrl ? `URL: ${pluginUrl}` : ""}

CHANGELOG:
${changeList}

STYLE: ${styleInstructions[style]}

REQUIREMENTS:
1. Start with an attention-grabbing hook (first line is crucial for engagement)
2. Summarize the 3-5 most important changes in plain, non-technical language that store owners understand
3. Explain WHY each change matters (e.g., "faster checkout = more sales")
4. End with a clear call-to-action (update now, save this, share with fellow store owners)
5. Add 3-5 relevant hashtags at the end (#WooCommerce #WordPress #eCommerce etc.)
6. Keep the entire post under 300 words
7. Use line breaks for readability
8. Use emojis sparingly but effectively (2-4 max)
9. Do NOT use markdown formatting — this is for Facebook (plain text only)
10. Make it feel human and helpful, not robotic or spammy

Return ONLY the Facebook post text, nothing else.`;
}

export function buildVideoScriptPrompt(params: {
  pluginName: string;
  version: string;
  changes: string[];
}): string {
  const { pluginName, version, changes } = params;
  const changeList = changes.slice(0, 10).map((c) => `- ${c}`).join("\n");

  return `Create a video script for a 20-second vertical video about a WooCommerce plugin update.

PLUGIN: ${pluginName}
VERSION: ${version}

CHANGELOG:
${changeList}

The video will show text slides over a background. Return a JSON array of slides, each with:
- "text": The text to show (max 15 words per slide)
- "duration": How long to show it in seconds (2-5 seconds each)

Format: exactly 4-6 slides that together tell a compelling story about this update.
Total duration should be 15-25 seconds.

Example format:
[
  {"text": "${pluginName} v${version} is here!", "duration": 3},
  {"text": "Key highlight goes here", "duration": 4},
  {"text": "Another important change", "duration": 4},
  {"text": "Update now! Link in comments", "duration": 3}
]

Return ONLY the JSON array, no other text.`;
}
