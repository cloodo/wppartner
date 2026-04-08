import type { VercelRequest, VercelResponse } from "@vercel/node";
import axios from "axios";
import * as cheerio from "cheerio";
import * as crypto from "crypto";

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
}

/**
 * Get a Google access token from a service account JSON key.
 * Uses built-in Node.js crypto — no external packages needed.
 */
async function getGoogleAccessToken(credentials: {
  client_email: string;
  private_key: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" })
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: credentials.client_email,
      scope:
        "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  ).toString("base64url");

  const sign = crypto.createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  const signature = sign.sign(credentials.private_key, "base64url");

  const jwt = `${header}.${payload}.${signature}`;

  const tokenResponse = await axios.post(
    "https://oauth2.googleapis.com/token",
    new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }).toString(),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  return tokenResponse.data.access_token;
}

async function createGoogleSheet(
  accessToken: string,
  data: WooLogData
): Promise<string> {
  // Create a new spreadsheet
  const createResponse = await axios.post(
    "https://sheets.googleapis.com/v4/spreadsheets",
    {
      properties: {
        title: `WooLog - WooCommerce Changelogs (${new Date().toISOString().split("T")[0]})`,
      },
      sheets: [
        {
          properties: {
            title: "Changelogs",
            gridProperties: { frozenRowCount: 1 },
          },
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  const spreadsheetId = createResponse.data.spreadsheetId;

  // Build row data
  const rows: string[][] = [
    ["Version", "Date", "Change", "Plugin", "Active Installs", "Fetched At"],
  ];

  for (const entry of data.changelogs) {
    for (let i = 0; i < entry.changes.length; i++) {
      rows.push([
        i === 0 ? `v${entry.version}` : "",
        i === 0 ? entry.date || "N/A" : "",
        entry.changes[i],
        i === 0 ? data.pluginName : "",
        i === 0 ? data.activeInstalls.toLocaleString() : "",
        i === 0 ? new Date().toISOString() : "",
      ]);
    }
  }

  // Write data to the sheet
  await axios.put(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Changelogs!A1?valueInputOption=RAW`,
    { values: rows },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  // Format header row (bold + background color)
  await axios.post(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId: 0,
              startRowIndex: 0,
              endRowIndex: 1,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.498, green: 0.329, blue: 0.702 },
                textFormat: {
                  foregroundColor: { red: 1, green: 1, blue: 1 },
                  bold: true,
                },
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat)",
          },
        },
        {
          autoResizeDimensions: {
            dimensions: {
              sheetId: 0,
              dimension: "COLUMNS",
              startIndex: 0,
              endIndex: 6,
            },
          },
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  // Make it publicly viewable (anyone with the link)
  await axios.post(
    `https://www.googleapis.com/drive/v3/files/${spreadsheetId}/permissions`,
    {
      role: "reader",
      type: "anyone",
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}

async function fetchWooCommerceChangelogs(): Promise<WooLogData> {
  const params = new URLSearchParams({
    action: "plugin_information",
    "request[slug]": "woocommerce",
    "request[fields][sections]": "1",
    "request[fields][active_installs]": "1",
    "request[fields][last_updated]": "1",
  });

  const url = `https://api.wordpress.org/plugins/info/1.2/?${params.toString()}`;

  let data: any;
  try {
    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        "User-Agent": "WooLog/1.0 (WooCommerce Changelog Tracker)",
        Accept: "application/json",
      },
    });
    data = response.data;
  } catch {
    const fallbackUrl =
      "https://api.wordpress.org/plugins/info/1.0/woocommerce.json";
    const response = await axios.get(fallbackUrl, {
      timeout: 30000,
      headers: {
        "User-Agent": "WooLog/1.0",
        Accept: "application/json",
      },
    });
    data = response.data;
  }

  const changelogHtml: string = data.sections?.changelog || "";
  const $ = cheerio.load(changelogHtml);
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
      }
      next = next.next();
    }

    entries.push({
      version: versionMatch[1],
      date: dateMatch ? dateMatch[1] : undefined,
      changes,
    });
  });

  return {
    pluginName: data.name || "WooCommerce",
    pluginVersion: data.version || "unknown",
    activeInstalls: data.active_installs || 0,
    lastUpdated: data.last_updated || "",
    changelogs: entries.slice(0, 3),
  };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Check for Google credentials
  const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!credentialsJson) {
    return res.status(400).json({
      error:
        "GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set. Please add your Google service account JSON key to Vercel environment variables.",
      setup: {
        steps: [
          "1. Go to Google Cloud Console > IAM & Admin > Service Accounts",
          "2. Create a service account with Google Sheets API + Google Drive API enabled",
          "3. Download the JSON key file",
          "4. In Vercel project settings, add GOOGLE_SERVICE_ACCOUNT_KEY with the JSON content",
        ],
      },
    });
  }

  try {
    const credentials = JSON.parse(credentialsJson);

    // Fetch changelog data
    const data = await fetchWooCommerceChangelogs();

    // Get Google access token
    const accessToken = await getGoogleAccessToken(credentials);

    // Create and populate Google Sheet
    const sheetUrl = await createGoogleSheet(accessToken, data);

    return res.json({
      success: true,
      url: sheetUrl,
      message: "Google Sheet created successfully",
      changelogs: data.changelogs.length,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err.message || "Failed to create Google Sheet",
    });
  }
}
