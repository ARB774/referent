import type { ActionKey, ArticleContent } from "./types";

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_BASE_URL =
  process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

function buildPrompt(action: ActionKey, article: ArticleContent) {
  const commonContext = `You analyze English-language articles and write polished answers in Russian.
Return only Russian text.
Do not leave English headings or bullet points in the final answer unless they are part of a title or URL.

Article date: ${article.date ?? "unknown"}
Article title: ${article.title}
Source URL: ${article.url}

Article text:
${article.content.slice(0, 12000)}
`;

  switch (action) {
    case "summary":
      return `${commonContext}

Task:
- Кратко объясни, о чем статья.
- Дай 2 коротких абзаца и 3 ключевых пункта.
`;
    case "theses":
      return `${commonContext}

Task:
- Сформулируй главные тезисы статьи на русском языке.
- Начни с 1 короткого вводного предложения.
- Затем дай 5-7 пунктов с основными идеями и выводами.
`;
    case "telegram":
      return `${commonContext}

Task:
- Подготовь короткий пост для Telegram на русском языке.
- Добавь короткий хук, основную мысль и финальную фразу.
- Сделай текст живым и удобным для чтения.
`;
  }
}

function localFallback(action: ActionKey, article: ArticleContent) {
  const dateLine = article.date ? `Дата публикации: ${article.date}.` : "Дата публикации не найдена.";

  switch (action) {
    case "summary":
      return [
        `Статья "${article.title}" успешно загружена и распознана.`,
        `${dateLine} Сейчас ответ сформирован в резервном режиме без OpenAI.`,
        "",
        `- Основной текст статьи извлечён.`,
        `- Доступен URL источника: ${article.url}.`,
        `- Для полноценной краткой выжимки нужен активный OpenAI API key.`,
      ].join("\n");
    case "theses":
      return [
        `Основные тезисы для статьи "${article.title}" пока показаны в резервном режиме.`,
        "",
        `- ${dateLine}`,
        `- Контент статьи извлечён и готов к AI-обработке.`,
        `- После подключения OpenAI здесь появятся содержательные тезисы на русском языке.`,
      ].join("\n");
    case "telegram":
      return [
        `Материал "${article.title}" подготовлен к адаптации под Telegram.`,
        "",
        `- ${dateLine}`,
        `- Источник: ${article.url}`,
        `- После подключения OpenAI приложение сможет собрать полноценный пост для Telegram.`,
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
