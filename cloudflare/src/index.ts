import * as cheerio from "cheerio";

interface ChangelogEntry {
  version: string;
  date?: string;
  changes: string[];
}

interface WooLogData {
  pluginName: string;
  pluginVersion: string;
  activeInstalls: number;
  lastUpdated: string;
  changelogs: ChangelogEntry[];
  fetchedAt: string;
}

async function fetchWooCommerceChangelogs(): Promise<WooLogData> {
  const params = new URLSearchParams({
    action: "plugin_information",
    "request[slug]": "woocommerce",
    "request[fields][sections]": "1",
    "request[fields][active_installs]": "1",
    "request[fields][last_updated]": "1",
    "request[fields][downloaded]": "1",
    "request[fields][homepage]": "1",
  });

  const apiUrl = `https://api.wordpress.org/plugins/info/1.2/?${params.toString()}`;
  let data: any;

  try {
    const res = await fetch(apiUrl, {
      headers: { "User-Agent": "WooLog/1.0 (CF Worker)" },
    });
    if (!res.ok) throw new Error(`API v1.2 returned ${res.status}`);
    data = await res.json();
  } catch {
    const fallbackRes = await fetch(
      "https://api.wordpress.org/plugins/info/1.0/woocommerce.json",
      { headers: { "User-Agent": "WooLog/1.0 (CF Worker)" } }
    );
    if (!fallbackRes.ok) throw new Error("WordPress.org API unavailable");
    data = await fallbackRes.json();
  }

  const changelogHtml: string = data.sections?.changelog || "";
  const changelogs = parseChangelogHtml(changelogHtml);

  return {
    pluginName: data.name || "WooCommerce",
    pluginVersion: data.version || "unknown",
    activeInstalls: data.active_installs || 0,
    lastUpdated: data.last_updated || "",
    changelogs: changelogs.slice(0, 3),
    fetchedAt: new Date().toISOString(),
  };
}

function parseChangelogHtml(html: string): ChangelogEntry[] {
  if (!html || html.trim().length === 0) return [];

  const $ = cheerio.load(html);
  const entries: ChangelogEntry[] = [];
  const headers = $("h4, h3");

  headers.each((_, header) => {
    const text = $(header).text().trim();
    const versionMatch = text.match(/v?(\d+\.\d+(?:\.\d+)?)/i);
    if (!versionMatch) return;

    const dateMatch = text.match(/(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/);
    const changes: string[] = [];
    let next = $(header).next();

    while (next.length > 0 && !next.is("h4, h3")) {
      if (next.is("ul, ol")) {
        next.find("li").each((_, li) => {
          const t = $(li).text().trim();
          if (t) changes.push(t);
        });
      } else if (next.is("p")) {
        const t = next.text().trim();
        if (t) changes.push(t);
      }
      next = next.next();
    }

    entries.push({
      version: versionMatch[1],
      date: dateMatch ? dateMatch[1] : undefined,
      changes,
    });
  });

  return entries;
}

function toCsv(data: WooLogData): string {
  const rows: string[] = ["Version,Date,Change"];
  for (const entry of data.changelogs) {
    for (const change of entry.changes) {
      const escaped = change.replace(/"/g, '""');
      rows.push(`"${entry.version}","${entry.date || "N/A"}","${escaped}"`);
    }
  }
  return rows.join("\n");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(0) + "K";
  return n.toString();
}

function renderHtml(data: WooLogData): string {
  const changelogCards = data.changelogs
    .map(
      (entry) => `
    <div class="changelog-card">
      <div class="version-header">
        <span class="version">v${entry.version}</span>
        <span class="date">${entry.date || "N/A"}</span>
      </div>
      <ul class="changes">
        ${entry.changes.map((c) => `<li>${escapeHtml(c)}</li>`).join("\n        ")}
      </ul>
    </div>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WooLog - WooCommerce Changelog Tracker</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f23; color: #e0e0e0; padding: 2rem; min-height: 100vh; }
    .container { max-width: 900px; margin: 0 auto; }
    h1 { color: #fff; font-size: 2.2rem; margin-bottom: 0.3rem; }
    h1 span { color: #7f54b3; }
    .subtitle { color: #888; margin-bottom: 2rem; font-size: 0.95rem; }
    .plugin-info { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .info-card { background: #1a1a2e; border-radius: 12px; padding: 1.2rem; text-align: center; }
    .info-card .value { font-size: 1.5rem; font-weight: bold; color: #7f54b3; }
    .info-card .label { color: #888; font-size: 0.8rem; margin-top: 0.2rem; }
    .actions { display: flex; gap: 0.8rem; margin-bottom: 2rem; flex-wrap: wrap; }
    .btn { padding: 0.7rem 1.4rem; border-radius: 8px; cursor: pointer; font-size: 0.9rem; border: none; font-weight: 500; text-decoration: none; display: inline-flex; align-items: center; gap: 0.4rem; }
    .btn-secondary { background: #1a1a2e; color: #e0e0e0; border: 1px solid #333; }
    .btn-secondary:hover { background: #252540; }
    .changelog-card { background: #1a1a2e; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.2rem; border-left: 4px solid #7f54b3; }
    .version-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .version { font-size: 1.3rem; font-weight: bold; color: #fff; }
    .date { color: #7f54b3; font-size: 0.9rem; }
    .changes { list-style: none; }
    .changes li { padding: 0.4rem 0; padding-left: 1.2rem; position: relative; color: #ccc; font-size: 0.9rem; line-height: 1.5; }
    .changes li::before { content: "\\2022"; position: absolute; left: 0; color: #7f54b3; font-weight: bold; }
    .footer { text-align: center; color: #555; font-size: 0.8rem; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #1a1a2e; }
    .badge { display: inline-block; background: #f48120; color: #fff; font-size: 0.7rem; padding: 0.2rem 0.5rem; border-radius: 4px; margin-left: 0.5rem; vertical-align: middle; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Woo<span>Log</span> <span class="badge">Cloudflare Workers</span></h1>
    <p class="subtitle">Latest 3 WooCommerce changelogs from WordPress.org API</p>

    <div class="plugin-info">
      <div class="info-card">
        <div class="value">${escapeHtml(data.pluginName)}</div>
        <div class="label">Plugin</div>
      </div>
      <div class="info-card">
        <div class="value">v${escapeHtml(data.pluginVersion)}</div>
        <div class="label">Latest Version</div>
      </div>
      <div class="info-card">
        <div class="value">${formatNumber(data.activeInstalls)}+</div>
        <div class="label">Active Installs</div>
      </div>
      <div class="info-card">
        <div class="value">${escapeHtml(data.lastUpdated.split(" ")[0] || "N/A")}</div>
        <div class="label">Last Updated</div>
      </div>
    </div>

    <div class="actions">
      <a href="?format=json" class="btn btn-secondary" target="_blank">JSON</a>
      <a href="?format=csv" class="btn btn-secondary" target="_blank">CSV</a>
    </div>

    ${changelogCards}

    <div class="footer">
      WooLog on Cloudflare Workers &mdash; Data from WordPress.org Plugin API &mdash; ${escapeHtml(data.fetchedAt)}
    </div>
  </div>
</body>
</html>`;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const format = url.searchParams.get("format");

    try {
      const data = await fetchWooCommerceChangelogs();

      if (format === "json") {
        return new Response(JSON.stringify(data, null, 2), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      }

      if (format === "csv") {
        return new Response(toCsv(data), {
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": "attachment; filename=woolog-changelog.csv",
          },
        });
      }

      return new Response(renderHtml(data), {
        headers: { "Content-Type": "text/html;charset=UTF-8" },
      });
    } catch (err: any) {
      const msg = err.message || "Unknown error";

      if (format === "json") {
        return new Response(JSON.stringify({ error: msg }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(
        `<!DOCTYPE html><html><head><title>WooLog Error</title>
        <style>body{font-family:sans-serif;background:#0f0f23;color:#e0e0e0;padding:2rem;text-align:center;}
        .error{background:#2d1b1b;border:1px solid #5c2626;color:#ff6b6b;padding:2rem;border-radius:12px;max-width:600px;margin:2rem auto;}</style>
        </head><body><h1>WooLog</h1><div class="error"><h3>Error</h3><p>${escapeHtml(msg)}</p></div></body></html>`,
        { status: 500, headers: { "Content-Type": "text/html;charset=UTF-8" } }
      );
    }
  },
};
