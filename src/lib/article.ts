import type { CheerioAPI } from "cheerio";

import type { ArticleContent } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (compatible; ReferentAI/1.0; +https://referent-zeta.vercel.app)";

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function safeHostname(value: string) {
  return value.replace(/^www\./, "");
}

function extractExcerpt(text: string) {
  const excerpt = normalizeWhitespace(text).slice(0, 280);
  return excerpt.length < text.length ? `${excerpt}...` : excerpt;
}

// #region debug-point A:reporting
async function reportDebug(
  msg: string,
  data: Record<string, unknown> = {},
) {
  let debugUrl = "http://127.0.0.1:7777/event";
  let sessionId = "vercel-build-fail";

  try {
    const fs = await import("node:fs/promises");
    const envText = await fs.readFile(".dbg/vercel-build-fail.env", "utf8");
    debugUrl =
      envText.match(/^DEBUG_SERVER_URL=(.+)$/m)?.[1]?.trim() || debugUrl;
    sessionId =
      envText.match(/^DEBUG_SESSION_ID=(.+)$/m)?.[1]?.trim() || sessionId;
  } catch {}

  try {
    await fetch(debugUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId,
        runId: "post-fix",
        hypothesisId: "A",
        location: "src/lib/article.ts:fetchArticle",
        msg: `[DEBUG] ${msg}`,
        data,
        ts: Date.now(),
      }),
      cache: "no-store",
    });
  } catch {}
}
// #endregion

function firstNonEmpty(values: Array<string | undefined>) {
  for (const value of values) {
    const normalized = normalizeWhitespace(value ?? "");

    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function extractDate($: CheerioAPI) {
  const selectors = [
    'meta[property="article:published_time"]',
    'meta[property="og:published_time"]',
    'meta[name="publish-date"]',
    'meta[name="publication_date"]',
    'meta[name="pubdate"]',
    'meta[name="date"]',
    'meta[itemprop="datePublished"]',
    'time[datetime]',
    '[itemprop="datePublished"]',
    ".post-date",
    ".entry-date",
    ".article-date",
    ".published",
    ".date",
  ];

  for (const selector of selectors) {
    const element = $(selector).first();
    const value = firstNonEmpty([
      element.attr("content"),
      element.attr("datetime"),
      element.text(),
    ]);

    if (value) {
      return value;
    }
  }

  return null;
}

function extractMainContent($: CheerioAPI, url: URL) {
  const selectors = [
    "article",
    '[itemprop="articleBody"]',
    "#mw-content-text",
    ".mw-parser-output",
    ".post-content",
    ".entry-content",
    ".article-content",
    ".story-content",
    ".main-content",
    ".post",
    ".content",
    "main",
    "body",
  ];

  let bestText = "";

  for (const selector of selectors) {
    $(selector).each((_, element) => {
      const text = normalizeWhitespace($(element).text());

      if (text.length > bestText.length) {
        bestText = text;
      }
    });

    if (bestText.length >= 400) {
      return bestText;
    }
  }

  if (bestText.length < 200) {
    throw new Error(
      `Не удалось извлечь основной контент статьи с ${safeHostname(url.hostname)}.`,
    );
  }

  return bestText;
}

function assertAllowedUrl(urlString: string) {
  let parsed: URL;

  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error("Укажите корректный URL статьи.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Поддерживаются только http и https ссылки.");
  }

  return parsed;
}

export async function fetchArticle(urlString: string): Promise<ArticleContent> {
  const url = assertAllowedUrl(urlString);

  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      "accept-language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Не удалось загрузить статью: HTTP ${response.status}.`);
  }

  const html = await response.text();
  const cheerioModule = await import("cheerio");
  const $ = cheerioModule.load(html);

  $("script, style, noscript, svg, iframe").remove();
  $("header, footer, nav, aside").remove();
  $(
    ".navbox, .infobox, .sidebar, .toc, .references, .reference, .mw-editsection, .metadata, .advert, .ads, .social-share, .related, .recommended, .newsletter, form",
  ).remove();

  const title =
    firstNonEmpty([
      $('meta[property="og:title"]').attr("content"),
      $('meta[name="twitter:title"]').attr("content"),
      $("h1").first().text(),
      $("title").text(),
      url.hostname,
    ]) || url.hostname;

  const date = extractDate($);
  const content = extractMainContent($, url);

  // #region debug-point A:extracted-article
  await reportDebug("Extracted parsed article", {
    hostname: safeHostname(url.hostname),
    hasDate: Boolean(date),
    titleLength: title.length,
    contentLength: content.length,
  });
  // #endregion

  return {
    date,
    title,
    content,
    excerpt: extractExcerpt(content),
    url: url.toString(),
  };
}
