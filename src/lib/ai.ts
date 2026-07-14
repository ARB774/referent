import type { ActionKey, ArticleContent } from "./types";

const DEFAULT_MODEL =
  process.env.OPENROUTER_MODEL ||
  process.env.OPENAI_MODEL ||
  "openai/gpt-4o-mini";
const ILLUSTRATION_PROMPT_MODEL =
  process.env.OPENROUTER_ILLUSTRATION_PROMPT_MODEL || DEFAULT_MODEL;
const TRANSLATE_MODEL =
  process.env.OPENROUTER_TRANSLATE_MODEL || "deepseek/deepseek-v4-flash";
const OPENROUTER_BASE_URL =
  process.env.OPENROUTER_BASE_URL ||
  process.env.OPENAI_BASE_URL ||
  "https://openrouter.ai/api/v1";
const OPENROUTER_SITE_URL =
  process.env.OPENROUTER_SITE_URL || "https://referent-zeta.vercel.app";
const OPENROUTER_APP_NAME =
  process.env.OPENROUTER_APP_NAME || "Referent AI";
const HUGGINGFACE_BASE_URL =
  process.env.HUGGINGFACE_BASE_URL ||
  "https://router.huggingface.co/hf-inference/models";
const HUGGINGFACE_IMAGE_MODEL =
  process.env.HUGGINGFACE_IMAGE_MODEL ||
  "black-forest-labs/FLUX.1-schnell";

// #region debug-point A:reporting
async function reportDebug(
  runId: "pre-fix" | "post-fix",
  hypothesisId: "A" | "B" | "C" | "D" | "E",
  location: string,
  msg: string,
  data: Record<string, unknown> = {},
) {
  let debugUrl = "http://127.0.0.1:7777/event";
  let sessionId = "illustration-fetch-failed";

  try {
    const fs = await import("node:fs/promises");
    const envText = await fs.readFile(".dbg/illustration-fetch-failed.env", "utf8");
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
        runId,
        hypothesisId,
        location,
        msg: `[DEBUG] ${msg}`,
        data,
        ts: Date.now(),
      }),
      cache: "no-store",
    });
  } catch {}
}
// #endregion

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
- Начни пост с короткого заголовка в Markdown и выдели его болдом: **Заголовок**
- Добавь короткий хук, основную мысль и финальную фразу.
- Сделай текст живым и удобным для чтения.
- В конце поста отдельной строкой добавь активную ссылку на источник (чистый URL): ${article.url}
`;
    case "translate":
      return `${commonContext}

Task:
- Переведи статью на русский язык.
- Сохрани структуру и смысл оригинала.
- Не пересказывай и не сокращай материал без необходимости.
- Верни только перевод статьи без пояснений от себя.
`;
    case "illustration":
      return `${commonContext}

Task:
- На основе статьи предложи 1 идею иллюстрации.
- Оформи ответ по структуре: 1 строка заголовка и затем 3-5 коротких пунктов.
`;
  }
}

function localFallback(action: ActionKey, article: ArticleContent) {
  const dateLine = article.date ? `Дата публикации: ${article.date}.` : "Дата публикации не найдена.";

  switch (action) {
    case "summary":
      return [
        `Статья "${article.title}" успешно загружена и распознана.`,
        `${dateLine} Сейчас ответ сформирован в резервном режиме без OpenRouter.`,
        "",
        `- Основной текст статьи извлечён.`,
        `- Доступен URL источника: ${article.url}.`,
        `- Для полноценной краткой выжимки нужен активный OpenRouter API key.`,
      ].join("\n");
    case "theses":
      return [
        `Основные тезисы для статьи "${article.title}" пока показаны в резервном режиме.`,
        "",
        `- ${dateLine}`,
        `- Контент статьи извлечён и готов к AI-обработке.`,
        `- После подключения OpenRouter здесь появятся содержательные тезисы на русском языке.`,
      ].join("\n");
    case "telegram":
      return [
        `Материал "${article.title}" подготовлен к адаптации под Telegram.`,
        "",
        `- ${dateLine}`,
        `- Источник: ${article.url}`,
        `- После подключения OpenRouter приложение сможет собрать полноценный пост для Telegram.`,
      ].join("\n");
    case "translate":
      return [
        `Перевод статьи "${article.title}" пока показан в резервном режиме.`,
        "",
        `- ${dateLine}`,
        `- Основной контент статьи извлечён.`,
        `- После подключения OpenRouter здесь появится полный перевод на русский язык.`,
      ].join("\n");
    case "illustration":
      return [
        `Идея иллюстрации для статьи "${article.title}" пока сформирована в резервном режиме.`,
        "",
        `- ${dateLine}`,
        `- Можно сгенерировать обложку/иллюстрацию по мотивам материала.`,
        `- Источник: ${article.url}`,
      ].join("\n");
  }
}

async function openRouterCompletion(action: ActionKey, article: ArticleContent) {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": OPENROUTER_SITE_URL,
      "X-OpenRouter-Title": OPENROUTER_APP_NAME,
    },
    body: JSON.stringify({
      model: action === "translate" ? TRANSLATE_MODEL : DEFAULT_MODEL,
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
    throw new Error(`OpenRouter error: ${response.status} ${errorText}`);
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
    const aiResult = await openRouterCompletion(action, article);

    if (aiResult) {
      return {
        provider: "openrouter" as const,
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

function buildIllustrationPromptInput(article: ArticleContent) {
  return `Create a single text-to-image prompt in English for a generative model.
Return ONLY the prompt text. No quotes, no markdown, no headings.
The prompt must be safe-for-work and must NOT include any brand names, logos, or real people's names.
Prefer a clean editorial illustration style, high contrast, and a clear focal point.
Keep it 1 sentence plus optional short style tags separated by commas.

Article title: ${article.title}
Article date: ${article.date ?? "unknown"}
Source URL: ${article.url}
Excerpt: ${article.excerpt}
`;
}

export async function generateIllustrationPrompt(article: ArticleContent) {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;

  // #region debug-point A:illustration-prompt-start
  await reportDebug(
    "pre-fix",
    "A",
    "src/lib/ai.ts:generateIllustrationPrompt",
    "Starting illustration prompt generation",
    {
      hasOpenRouterKey: Boolean(apiKey),
      model: ILLUSTRATION_PROMPT_MODEL,
      titleLength: article.title.length,
      excerptLength: article.excerpt.length,
    },
  );
  // #endregion

  if (!apiKey) {
    // #region debug-point A:illustration-prompt-no-key
    await reportDebug(
      "pre-fix",
      "A",
      "src/lib/ai.ts:generateIllustrationPrompt",
      "OpenRouter key missing, using local fallback prompt",
    );
    // #endregion
    return {
      provider: "local-fallback" as const,
      prompt: `Editorial illustration inspired by: ${article.title}, clean minimal composition, high contrast, soft lighting, vector style`,
    };
  }

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": OPENROUTER_SITE_URL,
        "X-OpenRouter-Title": OPENROUTER_APP_NAME,
      },
      body: JSON.stringify({
        model: ILLUSTRATION_PROMPT_MODEL,
        temperature: 0.5,
        messages: [
          {
            role: "system",
            content:
              "You are a prompt engineer for text-to-image generation. Output only the final English prompt text.",
          },
          {
            role: "user",
            content: buildIllustrationPromptInput(article),
          },
        ],
      }),
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });

    // #region debug-point A:illustration-prompt-response
    await reportDebug(
      "pre-fix",
      "A",
      "src/lib/ai.ts:generateIllustrationPrompt",
      "OpenRouter illustration prompt response received",
      {
        ok: response.ok,
        status: response.status,
        contentType: response.headers.get("content-type") ?? "",
      },
    );
    // #endregion

    if (!response.ok) {
      const errorText = await response.text();
      // #region debug-point A:illustration-prompt-error
      await reportDebug(
        "pre-fix",
        "A",
        "src/lib/ai.ts:generateIllustrationPrompt",
        "OpenRouter illustration prompt request failed",
        {
          status: response.status,
          errorPreview: errorText.slice(0, 300),
        },
      );
      // #endregion
      throw new Error(`OpenRouter error: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    const prompt = data.choices?.[0]?.message?.content?.trim() || "";

    if (!prompt) {
      // #region debug-point A:illustration-prompt-empty
      await reportDebug(
        "pre-fix",
        "A",
        "src/lib/ai.ts:generateIllustrationPrompt",
        "OpenRouter returned empty illustration prompt",
      );
      // #endregion
      throw new Error("OpenRouter вернул пустой промпт для иллюстрации.");
    }

    // #region debug-point A:illustration-prompt-success
    await reportDebug(
      "pre-fix",
      "A",
      "src/lib/ai.ts:generateIllustrationPrompt",
      "Illustration prompt generated successfully",
      {
        promptLength: prompt.length,
        promptPreview: prompt.slice(0, 180),
      },
    );
    // #endregion

    return { provider: "openrouter" as const, prompt };
  } catch (error) {
    // #region debug-point A:illustration-prompt-catch
    await reportDebug(
      "pre-fix",
      "A",
      "src/lib/ai.ts:generateIllustrationPrompt",
      "Falling back to local illustration prompt after OpenRouter failure",
      {
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    );
    // #endregion
    return {
      provider: "local-fallback" as const,
      prompt: `Editorial illustration inspired by: ${article.title}, clean minimal composition, high contrast, soft lighting, vector style`,
    };
  }
}

export async function generateIllustrationImage(prompt: string) {
  const token =
    process.env.HF_TOKEN ||
    process.env.HUGGINGFACE_API_TOKEN ||
    process.env.HUGGINGFACEHUB_API_TOKEN;

  // #region debug-point B:illustration-image-start
  await reportDebug(
    "pre-fix",
    "B",
    "src/lib/ai.ts:generateIllustrationImage",
    "Starting Hugging Face image generation",
    {
      hasHfToken: Boolean(token),
      model: HUGGINGFACE_IMAGE_MODEL,
      baseUrl: HUGGINGFACE_BASE_URL,
      promptLength: prompt.length,
      promptPreview: prompt.slice(0, 180),
    },
  );
  // #endregion

  if (!token) {
    // #region debug-point C:illustration-image-no-token
    await reportDebug(
      "pre-fix",
      "C",
      "src/lib/ai.ts:generateIllustrationImage",
      "Hugging Face token is missing",
    );
    // #endregion
    throw new Error("Не найден токен Hugging Face (HF_TOKEN).");
  }

  const huggingFaceUrl = `${HUGGINGFACE_BASE_URL.replace(/\/+$/, "")}/${HUGGINGFACE_IMAGE_MODEL}`;
  let response: Response;

  try {
    response = await fetch(huggingFaceUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "image/png",
      },
      body: JSON.stringify({
        inputs: prompt,
      }),
      signal: AbortSignal.timeout(60000),
      cache: "no-store",
    });
  } catch (error) {
    // #region debug-point B:illustration-image-fetch-exception
    await reportDebug(
      "post-fix",
      "B",
      "src/lib/ai.ts:generateIllustrationImage",
      "Hugging Face fetch threw before receiving a response",
      {
        url: huggingFaceUrl,
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    );
    // #endregion
    throw new Error(
      "Не удалось подключиться к Hugging Face. Проверьте доступность endpoint и значение HUGGINGFACE_BASE_URL.",
    );
  }

  const contentType = response.headers.get("content-type") ?? "";

  // #region debug-point B:illustration-image-response
  await reportDebug(
    "pre-fix",
    response.ok ? "B" : "D",
    "src/lib/ai.ts:generateIllustrationImage",
    "Hugging Face image response received",
    {
      ok: response.ok,
      status: response.status,
      contentType,
    },
  );
  // #endregion

  if (!response.ok) {
    if (contentType.includes("application/json")) {
      const data = (await response.json()) as { error?: string };
      // #region debug-point D:illustration-image-json-error
      await reportDebug(
        "pre-fix",
        "D",
        "src/lib/ai.ts:generateIllustrationImage",
        "Hugging Face returned JSON error payload",
        {
          status: response.status,
          errorMessage: data.error ?? "",
        },
      );
      // #endregion
      if (response.status === 403) {
        throw new Error(
          "Токен Hugging Face не имеет прав для Inference Providers. Создайте fine-grained token с разрешением Inference > Make calls to the serverless Inference API.",
        );
      }
      throw new Error(data.error || "Hugging Face вернул ошибку при генерации изображения.");
    }

    const text = await response.text();
    const head = text.slice(0, 200).replace(/\s+/g, " ").trim();
    // #region debug-point D:illustration-image-text-error
    await reportDebug(
      "pre-fix",
      "D",
      "src/lib/ai.ts:generateIllustrationImage",
      "Hugging Face returned non-JSON error payload",
      {
        status: response.status,
        errorPreview: head,
      },
    );
    // #endregion
    throw new Error(
      `Hugging Face вернул ошибку (HTTP ${response.status}). Ответ начинается с: ${head}`,
    );
  }

  if (!contentType.startsWith("image/")) {
    if (contentType.includes("application/json")) {
      const data = (await response.json()) as { error?: string };
      // #region debug-point D:illustration-image-not-image-json
      await reportDebug(
        "pre-fix",
        "D",
        "src/lib/ai.ts:generateIllustrationImage",
        "Hugging Face returned JSON instead of image",
        {
          errorMessage: data.error ?? "",
        },
      );
      // #endregion
      throw new Error(data.error || "Hugging Face вернул не изображение.");
    }

    const text = await response.text();
    const head = text.slice(0, 200).replace(/\s+/g, " ").trim();
    // #region debug-point D:illustration-image-not-image-text
    await reportDebug(
      "pre-fix",
      "D",
      "src/lib/ai.ts:generateIllustrationImage",
      "Hugging Face returned unexpected non-image payload",
      {
        errorPreview: head,
      },
    );
    // #endregion
    throw new Error(`Hugging Face вернул не изображение. Ответ начинается с: ${head}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const base64 = buffer.toString("base64");
  const dataUrl = `data:${contentType};base64,${base64}`;

  // #region debug-point B:illustration-image-success
  await reportDebug(
    "pre-fix",
    "B",
    "src/lib/ai.ts:generateIllustrationImage",
    "Hugging Face image generated successfully",
    {
      contentType,
      bytes: buffer.length,
    },
  );
  // #endregion

  return {
    dataUrl,
    contentType,
  };
}
