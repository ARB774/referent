import type { ActionKey, ArticleContent } from "./types";

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_BASE_URL =
  process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

function buildPrompt(action: ActionKey, article: ArticleContent) {
  const commonContext = `You are an assistant that analyzes English-language articles and writes answers in Russian.

Article title: ${article.title}
Source URL: ${article.url}
Site: ${article.siteName ?? "unknown"}
Author: ${article.byline ?? "unknown"}

Article text:
${article.text.slice(0, 12000)}
`;

  switch (action) {
    case "summary":
      return `${commonContext}

Task:
- Explain what the article is about in Russian.
- Keep the answer clear and concise.
- Structure the answer in 2 short paragraphs and then add 3 bullet points with the key takeaways.
`;
    case "theses":
      return `${commonContext}

Task:
- Return the key theses of the article in Russian.
- Start with a 1 sentence overview.
- Then provide 5-7 bullet points with the main ideas and conclusions.
`;
    case "telegram":
      return `${commonContext}

Task:
- Write a Russian Telegram post based on the article.
- Tone: concise, lively, easy to read.
- Include a short hook, the main value, and a closing sentence.
- No markdown headings, but bullet points are allowed if they improve readability.
`;
  }
}

function sentenceSplit(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 40);
}

function localFallback(action: ActionKey, article: ArticleContent) {
  const sentences = sentenceSplit(article.text);
  const lead = sentences.slice(0, 6);
  const bullets = lead.slice(0, 5).map((sentence) => `- ${sentence}`);

  switch (action) {
    case "summary":
      return [
        `Статья «${article.title}» посвящена теме ${article.siteName ?? "источника"} и раскрывает основной контекст материала через ключевые аргументы автора.`,
        `Ниже приведён локальный fallback-результат без AI. Для полноценной AI-генерации добавьте OPENAI_API_KEY в переменные окружения.`,
        "",
        ...bullets.slice(0, 3),
      ].join("\n");
    case "theses":
      return [
        `Ключевые тезисы статьи «${article.title}»:`,
        "",
        ...bullets,
      ].join("\n");
    case "telegram":
      return [
        `Нашёл интересный материал: «${article.title}».`,
        "",
        "Главное из статьи:",
        ...bullets.slice(0, 4),
        "",
        "Если нужно, могу отдельно разобрать статью подробнее и превратить её в готовый контент.",
      ].join("\n");
  }
}

async function openAiCompletion(action: ActionKey, article: ArticleContent) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            "You analyze articles and write polished Russian-language answers.",
        },
        {
          role: "user",
          content: buildPrompt(action, article),
        },
      ],
    }),
    signal: AbortSignal.timeout(30000),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI provider error: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  return data.choices?.[0]?.message?.content?.trim() || null;
}

export async function generateAnalysis(action: ActionKey, article: ArticleContent) {
  try {
    const aiResult = await openAiCompletion(action, article);

    if (aiResult) {
      return {
        provider: "openai" as const,
        result: aiResult,
      };
    }
  } catch {
    // Fall through to a deterministic local response if the AI provider is not available.
  }

  return {
    provider: "local-fallback" as const,
    result: localFallback(action, article),
  };
}
