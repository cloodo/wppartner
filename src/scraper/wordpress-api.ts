import axios from "axios";
import { config } from "../config";

export interface WPPluginInfo {
  slug: string;
  name: string;
  version: string;
  active_installs: number;
  last_updated: string;
  homepage: string;
  sections?: {
    changelog?: string;
    description?: string;
  };
}

interface QueryPluginsResponse {
  info: { page: number; pages: number; results: number };
  plugins: WPPluginInfo[];
}

export async function fetchWooCommercePlugins(): Promise<WPPluginInfo[]> {
  const allPlugins: WPPluginInfo[] = [];
  const seen = new Set<string>();

  // Strategy 1: Search by "woocommerce" keyword
  const searchResults = await queryPlugins({ search: "woocommerce" });
  for (const p of searchResults) {
    if (!seen.has(p.slug)) {
      seen.add(p.slug);
      allPlugins.push(p);
    }
  }

  // Strategy 2: Search by tag "woocommerce"
  const tagResults = await queryPlugins({ tag: "woocommerce" });
  for (const p of tagResults) {
    if (!seen.has(p.slug)) {
      seen.add(p.slug);
      allPlugins.push(p);
    }
  }

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
    console.log(`  Fetching: ${url}`);

    try {
      const response = await axios.get<QueryPluginsResponse>(url, { timeout: 30000 });
      const plugins = response.data.plugins || [];

      if (plugins.length === 0) break;
      allPlugins.push(...plugins);

      if (page >= response.data.info.pages) break;

      // Be respectful — 1 second between requests
      await sleep(1000);
    } catch (err: any) {
      console.error(`  Error fetching page ${page}: ${err.message}`);
      break;
    }
  }

  return allPlugins;
}

export async function fetchPluginDetails(slug: string): Promise<WPPluginInfo | null> {
  const params = new URLSearchParams({
    action: "plugin_information",
    "request[slug]": slug,
    "request[fields][sections]": "1",
    "request[fields][active_installs]": "1",
  });

  const url = `${config.wordpress.apiBase}?${params.toString()}`;

  try {
    const response = await axios.get<WPPluginInfo>(url, { timeout: 30000 });
    return response.data;
  } catch (err: any) {
    console.error(`  Error fetching details for ${slug}: ${err.message}`);
    return null;
  }
}

function buildQueryUrl(
  params: { search?: string; tag?: string; browse?: string },
  page: number
): string {
  const qs = new URLSearchParams({
    action: "query_plugins",
    "request[per_page]": config.wordpress.pluginsPerPage.toString(),
    "request[page]": page.toString(),
    "request[fields][active_installs]": "1",
  });

  if (params.search) qs.set("request[search]", params.search);
  if (params.tag) qs.set("request[tag]", params.tag);
  if (params.browse) qs.set("request[browse]", params.browse);

  return `${config.wordpress.apiBase}?${qs.toString()}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
