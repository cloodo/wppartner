import * as cheerio from "cheerio";

export interface ChangelogEntry {
  version: string;
  date?: string;
  changes: string[];
  rawHtml: string;
}

/**
 * Parse changelog from HTML (as returned by WordPress.org Plugin Info API).
 *
 * Supports multiple formats:
 * - <h4>Version - Date</h4> + <ul><li>...</li></ul>  (most common)
 * - <h3>Version</h3> + <ul>...</ul>
 * - <p><strong>Version</strong></p> + <ul>...</ul>
 */
export function parseChangelog(html: string): ChangelogEntry[] {
  if (!html || html.trim().length === 0) return [];

  const $ = cheerio.load(html);
  const entries: ChangelogEntry[] = [];

  // WooCommerce changelogs typically use <h4> for version headers
  // Some plugins use <h3> or <p><strong>
  const versionHeaders = $("h4, h3");

  if (versionHeaders.length > 0) {
    versionHeaders.each((_, header) => {
      const headerText = $(header).text().trim();
      const parsed = parseVersionHeader(headerText);
      if (!parsed) return;

      // Collect all list items until the next version header
      const changes: string[] = [];
      let rawHtml = $.html(header);
      let next = $(header).next();

      while (next.length > 0 && !next.is("h4, h3")) {
        rawHtml += $.html(next);
        if (next.is("ul, ol")) {
          next.find("li").each((_, li) => {
            const text = $(li).text().trim();
            if (text) changes.push(text);
          });
        } else if (next.is("p")) {
          const text = next.text().trim();
          if (text) changes.push(text);
        }
        next = next.next();
      }

      entries.push({
        version: parsed.version,
        date: parsed.date,
        changes,
        rawHtml,
      });
    });
  } else {
    // Fallback: try to parse <p><strong>version</strong></p> pattern
    $("p").each((_, p) => {
      const strong = $(p).find("strong").first();
      if (!strong.length) return;

      const headerText = strong.text().trim();
      const parsed = parseVersionHeader(headerText);
      if (!parsed) return;

      const changes: string[] = [];
      let rawHtml = $.html(p);
      let next = $(p).next();

      while (next.length > 0) {
        const nextStrong = next.find("strong").first();
        if (nextStrong.length && parseVersionHeader(nextStrong.text().trim())) break;

        rawHtml += $.html(next);
        if (next.is("ul, ol")) {
          next.find("li").each((_, li) => {
            const text = $(li).text().trim();
            if (text) changes.push(text);
          });
        }
        next = next.next();
      }

      entries.push({
        version: parsed.version,
        date: parsed.date,
        changes,
        rawHtml,
      });
    });
  }

  return entries;
}

/**
 * Parse changelog from WordPress readme.txt plain text format.
 *
 * Format:
 *   = 9.6.0 - 2025-01-14 =
 *   * Add - New product collection block
 *   * Fix - Checkout race condition
 *
 *   = 9.5.2 =
 *   * Fix - Security patch
 */
export function parseChangelogFromReadme(text: string): ChangelogEntry[] {
  if (!text || text.trim().length === 0) return [];

  const entries: ChangelogEntry[] = [];
  const lines = text.split("\n");
  let currentEntry: ChangelogEntry | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Version header: = 1.2.3 = or = 1.2.3 - 2024-01-01 =
    const versionMatch = trimmed.match(/^=\s*(.+?)\s*=$/);
    if (versionMatch) {
      if (currentEntry) {
        entries.push(currentEntry);
      }

      const parsed = parseVersionHeader(versionMatch[1]);
      if (parsed) {
        currentEntry = {
          version: parsed.version,
          date: parsed.date,
          changes: [],
          rawHtml: `<h4>${versionMatch[1]}</h4>`,
        };
      } else {
        currentEntry = null;
      }
      continue;
    }

    // List item: * Change description or - Change description
    const itemMatch = trimmed.match(/^[*\-]\s+(.+)$/);
    if (itemMatch && currentEntry) {
      currentEntry.changes.push(itemMatch[1]);
      currentEntry.rawHtml += `\n<li>${itemMatch[1]}</li>`;
      continue;
    }
  }

  // Push the last entry
  if (currentEntry) {
    entries.push(currentEntry);
  }

  return entries;
}

/**
 * Parse version string from various header formats:
 *   "9.0.0 - 2024-06-12"
 *   "Version 9.0.0"
 *   "v2.1.3 (2024-01-15)"
 *   "2.1.3"
 *   "9.0.0 2024-06-12"
 */
function parseVersionHeader(text: string): { version: string; date?: string } | null {
  const versionPattern = /v?(\d+\.\d+(?:\.\d+)?(?:\.\d+)?)/i;
  const match = text.match(versionPattern);

  if (!match) return null;

  const version = match[1];

  // Try to extract date in various formats
  const datePattern = /(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/;
  const dateMatch = text.match(datePattern);

  return {
    version,
    date: dateMatch ? dateMatch[1] : undefined,
  };
}

export function getLatestEntry(entries: ChangelogEntry[]): ChangelogEntry | null {
  return entries.length > 0 ? entries[0] : null;
}

export function changelogToPlainText(entry: ChangelogEntry): string {
  const lines: string[] = [];
  lines.push(`Version ${entry.version}${entry.date ? ` (${entry.date})` : ""}`);
  lines.push("");
  for (const change of entry.changes) {
    lines.push(`• ${change}`);
  }
  return lines.join("\n");
}
