import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "@vercel/postgres";
import { initDb } from "../src/db/vercel-db";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await initDb();

  let stats = { plugins: 0, changelogs: 0, posts: 0, posted: 0, pending: 0 };

  try {
    const [pluginCount, changelogCount, postStats] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM plugins`,
      sql`SELECT COUNT(*) as count FROM changelogs`,
      sql`SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'posted') as posted,
            COUNT(*) FILTER (WHERE status = 'pending') as pending
          FROM posts`,
    ]);

    stats = {
      plugins: parseInt(pluginCount.rows[0].count),
      changelogs: parseInt(changelogCount.rows[0].count),
      posts: parseInt(postStats.rows[0].total),
      posted: parseInt(postStats.rows[0].posted),
      pending: parseInt(postStats.rows[0].pending),
    };
  } catch {
    // Tables may not exist yet
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WPPartner Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f23; color: #e0e0e0; padding: 2rem; }
    h1 { color: #fff; margin-bottom: 0.5rem; font-size: 1.8rem; }
    .subtitle { color: #888; margin-bottom: 2rem; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .stat { background: #1a1a2e; border-radius: 12px; padding: 1.5rem; text-align: center; }
    .stat .number { font-size: 2rem; font-weight: bold; color: #e94560; }
    .stat .label { color: #888; font-size: 0.85rem; margin-top: 0.3rem; }
    .actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .action { background: #1a1a2e; border-radius: 12px; padding: 1.5rem; }
    .action h3 { color: #fff; margin-bottom: 0.5rem; }
    .action p { color: #888; font-size: 0.85rem; margin-bottom: 1rem; }
    button { background: #e94560; color: #fff; border: none; padding: 0.7rem 1.5rem; border-radius: 8px; cursor: pointer; font-size: 0.9rem; width: 100%; }
    button:hover { background: #c73e55; }
    button:disabled { background: #555; cursor: not-allowed; }
    .result { margin-top: 1rem; padding: 1rem; background: #0d1117; border-radius: 8px; font-family: monospace; font-size: 0.8rem; white-space: pre-wrap; display: none; max-height: 300px; overflow-y: auto; }
    .test-input { width: 100%; padding: 0.5rem; margin-bottom: 0.5rem; background: #0d1117; border: 1px solid #333; border-radius: 6px; color: #e0e0e0; font-size: 0.85rem; }
  </style>
</head>
<body>
  <h1>WPPartner</h1>
  <p class="subtitle">WooCommerce Changelog Facebook Poster</p>

  <div class="stats">
    <div class="stat"><div class="number">${stats.plugins}</div><div class="label">Plugins Tracked</div></div>
    <div class="stat"><div class="number">${stats.changelogs}</div><div class="label">Changelogs</div></div>
    <div class="stat"><div class="number">${stats.posted}</div><div class="label">Posts Published</div></div>
    <div class="stat"><div class="number">${stats.pending}</div><div class="label">Posts Pending</div></div>
  </div>

  <div class="actions">
    <div class="action">
      <h3>Scrape Plugins</h3>
      <p>Fetch WooCommerce plugins and detect new changelogs.</p>
      <input type="text" class="test-input" id="slugs" placeholder="Optional: woocommerce,elementor (leave empty for top 100)">
      <button onclick="runAction('/api/scrape', 'scrape-result', document.getElementById('slugs').value ? '?slugs=' + document.getElementById('slugs').value : '')">Run Scraper</button>
      <div class="result" id="scrape-result"></div>
    </div>

    <div class="action">
      <h3>Generate AI Posts</h3>
      <p>Create viral Facebook posts using Claude AI.</p>
      <button onclick="runAction('/api/generate', 'generate-result')">Generate Content</button>
      <div class="result" id="generate-result"></div>
    </div>

    <div class="action">
      <h3>Publish to Facebook</h3>
      <p>Post pending content to your Facebook Page.</p>
      <button onclick="runAction('/api/publish', 'publish-result')">Publish Posts</button>
      <div class="result" id="publish-result"></div>
    </div>
  </div>

  <script>
    async function runAction(url, resultId, params = '') {
      const btn = event.target;
      const resultDiv = document.getElementById(resultId);
      btn.disabled = true;
      btn.textContent = 'Running...';
      resultDiv.style.display = 'block';
      resultDiv.textContent = 'Processing...';

      try {
        const res = await fetch(url + params);
        const data = await res.json();
        resultDiv.textContent = JSON.stringify(data, null, 2);
      } catch (err) {
        resultDiv.textContent = 'Error: ' + err.message;
      } finally {
        btn.disabled = false;
        btn.textContent = btn.textContent.replace('Running...', 'Run Again');
      }
    }
  </script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html");
  return res.status(200).send(html);
}
