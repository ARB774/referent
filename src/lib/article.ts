import type { ArticleContent } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (compatible; ReferentAI/1.0; +https://referent-zeta.vercel.app)";

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function extractExcerpt(text: string) {
  const excerpt = normalizeWhitespace(text).slice(0, 280);
  return excerpt.length < text.length ? `${excerpt}...` : excerpt;
}

function safeHostname(value: string) {
  return value.replace(/^www\./, "");
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

  const title =
    normalizeWhitespace(
      $('meta[property="og:title"]').attr("content") ||
        $('meta[name="twitter:title"]').attr("content") ||
        $("title").text() ||
        url.hostname,
    ) || url.hostname;

  const siteName = normalizeWhitespace(
    $('meta[property="og:site_name"]').attr("content") || safeHostname(url.hostname),
  );

  const byline = normalizeWhitespace(
    $('meta[name="author"]').attr("content") ||
      $('[itemprop="author"]').first().text() ||
      "",
  );

  const metaDescription = normalizeWhitespace(
    $('meta[property="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") ||
      "",
  );

  $("script, style, noscript, svg, iframe").remove();
  $("header, footer, nav, aside").remove();

  const candidate =
    $("article").first().length
      ? $("article").first()
      : $("main").first().length
        ? $("main").first()
        : $("body");

  const text = normalizeWhitespace(candidate.text());

  if (text.length < 400) {
    throw new Error(
      "Извлечённого текста слишком мало для анализа. Нужна полноценная статья.",
    );
  }

  return {
    title,
    text,
    excerpt: metaDescription || extractExcerpt(text),
    byline: byline || undefined,
    siteName: siteName || safeHostname(url.hostname),
    url: url.toString(),
  };
}
