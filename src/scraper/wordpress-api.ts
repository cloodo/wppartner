import axios from "axios";
import { config } from "../config";

export interface WPPluginInfo {
  slug: string;
  name: string;
  version: string;
  active_installs: number;
  last_updated: string;
  homepage: string;
  download_link?: string;
  author?: string;
  requires?: string;
  tested?: string;
  requires_php?: string;
  rating?: number;
  num_ratings?: number;
  sections?: {
    changelog?: string;
    description?: string;
  };
}

interface QueryPluginsResponse {
  info: { page: number; pages: number; results: number };
  plugins: WPPluginInfo[];
}

const HTTP_HEADERS = {
  "User-Agent": "WPPartner/1.0 (WooCommerce Changelog Monitor)",
  Accept: "application/json",
};

export async function fetchWooCommercePlugins(): Promise<WPPluginInfo[]> {
  const allPlugins: WPPluginInfo[] = [];
  const seen = new Set<string>();

  // Strategy 1: Search by "woocommerce" keyword
  console.log("  Strategy 1: Searching by keyword 'woocommerce'...");
  const searchResults = await queryPlugins({ search: "woocommerce" });
  for (const p of searchResults) {
    if (!seen.has(p.slug)) {
      seen.add(p.slug);
      allPlugins.push(p);
    }
  }
  console.log(`    Found ${searchResults.length} plugins by keyword`);

  // Strategy 2: Search by tag "woocommerce"
  console.log("  Strategy 2: Searching by tag 'woocommerce'...");
  const tagResults = await queryPlugins({ tag: "woocommerce" });
  for (const p of tagResults) {
    if (!seen.has(p.slug)) {
      seen.add(p.slug);
      allPlugins.push(p);
    }
  }
  console.log(`    Found ${tagResults.length} by tag, ${allPlugins.length} total unique`);

  // Sort by active installs (most popular first) and take top 100
  allPlugins.sort((a, b) => (b.active_installs || 0) - (a.active_installs || 0));
  return allPlugins.slice(0, 100);
}

async function queryPlugins(
  params: { search?: string; tag?: string; browse?: string }
): Promise<WPPluginInfo[]> {
  const allPlugins: WPPluginInfo[] = [];

  for (let page = 1; page <= config.wordpress.maxPages; page++) {
    const url = buildQueryUrl(params, page);
    console.log(`    Fetching page ${page}: ${url.substring(0, 120)}...`);

    try {
      const response = await axios.get<QueryPluginsResponse>(url, {
        timeout: 30000,
        headers: HTTP_HEADERS,
      });
      const plugins = response.data.plugins || [];

      if (plugins.length === 0) break;
      allPlugins.push(...plugins);

      if (page >= response.data.info.pages) break;

      // Be respectful — 1 second between requests
      await sleep(1000);
    } catch (err: any) {
      console.error(`    Error fetching page ${page}: ${err.message}`);
      break;
    }
  }

  return allPlugins;
}

/**
 * Fetch full plugin details via the Plugin Info API.
 * Requests sections (changelog!), active_installs, icons, and other fields
 * that default to false.
 */
export async function fetchPluginDetails(slug: string): Promise<WPPluginInfo | null> {
  const params = new URLSearchParams({
    action: "plugin_information",
    "request[slug]": slug,
    // Fields that default to FALSE — must explicitly request
    "request[fields][sections]": "1",
    "request[fields][active_installs]": "1",
    "request[fields][downloaded]": "1",
    "request[fields][description]": "1",
    "request[fields][icons]": "1",
    "request[fields][banners]": "1",
    // Fields that default to TRUE — keep them
    "request[fields][short_description]": "1",
    "request[fields][rating]": "1",
    "request[fields][ratings]": "1",
    "request[fields][num_ratings]": "1",
    "request[fields][requires]": "1",
    "request[fields][tested]": "1",
    "request[fields][requires_php]": "1",
    "request[fields][last_updated]": "1",
    "request[fields][homepage]": "1",
    "request[fields][download_link]": "1",
    "request[fields][tags]": "1",
  });

  const url = `${config.wordpress.apiBase}?${params.toString()}`;

  try {
    const response = await axios.get<WPPluginInfo>(url, {
      timeout: 30000,
      headers: HTTP_HEADERS,
    });
    return response.data;
  } catch (err: any) {
    console.error(`    API failed for ${slug}: ${err.message}`);

    // Fallback: try SVN readme.txt
    console.log(`    Trying SVN fallback for ${slug}...`);
    return fetchPluginFromSvn(slug);
  }
}

/**
 * Fallback: Fetch changelog directly from WordPress.org SVN repository.
 * Files are publicly accessible via HTTP at:
 *   https://plugins.svn.wordpress.org/{slug}/trunk/readme.txt
 *   https://plugins.svn.wordpress.org/{slug}/trunk/changelog.txt
 */
export async function fetchPluginFromSvn(slug: string): Promise<WPPluginInfo | null> {
  const svnBase = `https://plugins.svn.wordpress.org/${slug}/trunk`;

  // Try changelog.txt first (some plugins have a separate file)
  let changelogText = await fetchSvnFile(`${svnBase}/changelog.txt`);

  // Fall back to readme.txt
  let readmeText: string | null = null;
  if (!changelogText) {
    readmeText = await fetchSvnFile(`${svnBase}/readme.txt`);
    if (readmeText) {
      changelogText = extractChangelogFromReadme(readmeText);
    }
  }

  if (!changelogText) {
    console.log(`    SVN fallback also failed for ${slug}`);
    return null;
  }

  // Parse the readme.txt header for metadata
  const name = readmeText ? parseReadmeField(readmeText, "Plugin Name") || slug : slug;
  const version = readmeText ? parseReadmeField(readmeText, "Stable tag") || "unknown" : "unknown";
  const requires = readmeText ? parseReadmeField(readmeText, "Requires at least") : undefined;
  const tested = readmeText ? parseReadmeField(readmeText, "Tested up to") : undefined;
  const requiresPhp = readmeText ? parseReadmeField(readmeText, "Requires PHP") : undefined;

  // Convert plain text changelog to simple HTML for our parser
  const changelogHtml = convertReadmeChangelogToHtml(changelogText);

  return {
    slug,
    name,
    version,
    active_installs: 0,
    last_updated: "",
    homepage: `https://wordpress.org/plugins/${slug}/`,
    requires,
    tested,
    requires_php: requiresPhp,
    sections: {
      changelog: changelogHtml,
    },
  };
}

async function fetchSvnFile(url: string): Promise<string | null> {
  try {
    const response = await axios.get<string>(url, {
      timeout: 15000,
      headers: { "User-Agent": HTTP_HEADERS["User-Agent"] },
      responseType: "text",
    });
    return response.data;
  } catch {
    return null;
  }
}

/**
 * Extract the == Changelog == section from a WordPress readme.txt
 */
function extractChangelogFromReadme(readme: string): string | null {
  const changelogMatch = readme.match(
    /==\s*Changelog\s*==([\s\S]*?)(?:==\s*[A-Z]|$)/i
  );
  return changelogMatch ? changelogMatch[1].trim() : null;
}

/**
 * Parse a field from WordPress readme.txt header
 * Format: "Field Name: value"
 */
function parseReadmeField(readme: string, field: string): string | undefined {
  const pattern = new RegExp(`^${field}\\s*:\\s*(.+)$`, "im");
  const match = readme.match(pattern);
  return match ? match[1].trim() : undefined;
}

/**
 * Convert WordPress readme.txt changelog format to HTML.
 *
 * Input format:
 *   = 9.6.0 - 2025-01-14 =
 *   * Add - New product collection block
 *   * Fix - Checkout race condition
 *
 * Output format:
 *   <h4>9.6.0 - 2025-01-14</h4>
 *   <ul><li>Add - New product collection block</li>...</ul>
 */
function convertReadmeChangelogToHtml(text: string): string {
  const lines = text.split("\n");
  let html = "";
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Version header: = 1.2.3 = or = 1.2.3 - 2024-01-01 =
    const versionMatch = trimmed.match(/^=\s*(.+?)\s*=$/);
    if (versionMatch) {
      if (inList) {
        html += "</ul>\n";
        inList = false;
      }
      html += `<h4>${versionMatch[1]}</h4>\n`;
      continue;
    }

    // List item: * Change description or - Change description
    const itemMatch = trimmed.match(/^[*\-]\s+(.+)$/);
    if (itemMatch) {
      if (!inList) {
        html += "<ul>\n";
        inList = true;
      }
      html += `<li>${itemMatch[1]}</li>\n`;
      continue;
    }
  }

  if (inList) {
    html += "</ul>\n";
  }

  return html;
}

function buildQueryUrl(
  params: { search?: string; tag?: string; browse?: string },
  page: number
): string {
  const qs = new URLSearchParams({
    action: "query_plugins",
    "request[per_page]": config.wordpress.pluginsPerPage.toString(),
    "request[page]": page.toString(),
    // Explicitly request fields that default to false
    "request[fields][active_installs]": "1",
    "request[fields][icons]": "1",
    "request[fields][short_description]": "1",
    "request[fields][last_updated]": "1",
    "request[fields][rating]": "1",
    "request[fields][num_ratings]": "1",
  });

  if (params.search) qs.set("request[search]", params.search);
  if (params.tag) qs.set("request[tag]", params.tag);
  if (params.browse) qs.set("request[browse]", params.browse);

  return `${config.wordpress.apiBase}?${qs.toString()}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
