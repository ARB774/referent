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

  const { JSDOM } = await import("jsdom");
  const readabilityModule = await import("@mozilla/readability");
  const Readability =
    (readabilityModule as { Readability?: typeof import("@mozilla/readability").Readability })
      .Readability ??
    (readabilityModule as { default?: { Readability?: typeof import("@mozilla/readability").Readability } })
      .default?.Readability;

  if (!Readability) {
    throw new Error(
      "Не удалось инициализировать парсер статьи (Readability). Попробуйте ещё раз.",
    );
  }

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
  const dom = new JSDOM(html, { url: url.toString() });
  const reader = new Readability(dom.window.document);
  const parsed = reader.parse();

  if (!parsed?.textContent) {
    throw new Error(
      "Не удалось извлечь текст статьи. Попробуйте другую страницу.",
    );
  }

  const text = normalizeWhitespace(parsed.textContent);

  if (text.length < 400) {
    throw new Error(
      "Извлечённого текста слишком мало для анализа. Нужна полноценная статья.",
    );
  }

  return {
    title: normalizeWhitespace(
      parsed.title || dom.window.document.title || url.hostname,
    ),
    text,
    excerpt: extractExcerpt(text),
    byline: parsed.byline ? normalizeWhitespace(parsed.byline) : undefined,
    siteName: parsed.siteName
      ? normalizeWhitespace(parsed.siteName)
      : url.hostname.replace(/^www\./, ""),
    url: url.toString(),
  };
}
