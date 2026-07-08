import type { ActionKey, ArticleContent } from "./types";

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_BASE_URL =
  process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

function buildPrompt(action: ActionKey, article: ArticleContent) {
  const commonContext = `You are an assistant that analyzes English-language articles and writes answers in Russian.
Return only Russian text.
Do not leave English words, headings, or bullet points in the final answer unless they are part of a URL or an unavoidable proper name.
If you mention the article title, translate or paraphrase it in Russian.

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
  const approximateParagraphs = Math.max(
    1,
    article.text.split(/\n\s*\n/).filter(Boolean).length,
  );
  const sentenceCount = sentences.length;
  const siteName = article.siteName || "неизвестного источника";
  const author = article.byline || "автор не указан";
  const depth =
    article.text.length > 12000
      ? "подробно"
      : article.text.length > 6000
        ? "достаточно развёрнуто"
        : "коротко";

  switch (action) {
    case "summary":
      return [
        `Материал с сайта ${siteName} успешно загружен и подготовлен к анализу. Текст статьи достаточно большой, поэтому приложение смогло извлечь содержимое и определить основной источник.`,
        `Сейчас ответ сформирован в резервном режиме без AI, поэтому вместо полноценного пересказа показывается краткая русскоязычная сводка по структуре материала.`,
        "",
        `- Автор: ${author}.`,
        `- Текст раскрывает тему ${depth} и содержит примерно ${sentenceCount} смысловых предложений.`,
        `- В статье найдено около ${approximateParagraphs} крупных смысловых блоков, пригодных для дальнейшего пересказа на русском языке.`,
      ].join("\n");
    case "theses":
      return [
        "Ключевые тезисы материала в резервном режиме:",
        "",
        `- Источник статьи: ${siteName}.`,
        `- Автор материала: ${author}.`,
        `- Текст успешно извлечён и готов для AI-обработки.`,
        `- Объём статьи позволяет получить краткий пересказ, тезисы и адаптацию под Telegram.`,
        `- Для содержательных тезисов на русском языке лучше использовать режим с подключённым AI.`,
      ].join("\n");
    case "telegram":
      return [
        "Нашёл интересный англоязычный материал и загрузил его в приложение.",
        "",
        `Источник: ${siteName}.`,
        `Автор: ${author}.`,
        "Сейчас доступен резервный русскоязычный шаблон без AI-пересказа.",
        "После подключения AI приложение сможет превратить статью в полноценный пост для Telegram с кратким хуком, тезисами и выводом.",
        "",
        "Готов продолжить обработку и выдать итоговый пост после AI-анализа.",
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
            "You analyze articles and write polished Russian-language answers only. All output must be in Russian.",
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
