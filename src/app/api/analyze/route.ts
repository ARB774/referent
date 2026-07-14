import { NextResponse } from "next/server";

import {
  generateAnalysis,
  generateIllustrationImage,
  generateIllustrationPrompt,
} from "@/lib/ai";
import { fetchArticle } from "@/lib/article";
import type {
  ActionKey,
  AnalysisResponse,
  AnalyzeResponse,
  IllustrationResponse,
  RequestActionKey,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TITLES: Record<ActionKey, string> = {
  summary: "Суть",
  theses: "Тезисы",
  telegram: "Пост",
  translate: "Перевести",
  illustration: "Иллюстрация",
};

// #region debug-point E:reporting
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

function isRequestActionKey(value: string): value is RequestActionKey {
  return (
    value === "summary" ||
    value === "theses" ||
    value === "telegram" ||
    value === "translate" ||
    value === "illustration" ||
    value === "parse"
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      url?: string;
      action?: string;
    };

    const url = body.url?.trim();
    const action = body.action?.trim();

    if (!url) {
      return NextResponse.json(
        { error: "Укажите URL англоязычной статьи." },
        { status: 400 },
      );
    }

    if (!action || !isRequestActionKey(action)) {
      return NextResponse.json(
        { error: "Укажите корректное действие для анализа." },
        { status: 400 },
      );
    }

    // #region debug-point E:route-start
    await reportDebug(
      "pre-fix",
      "E",
      "src/app/api/analyze/route.ts:POST",
      "Analyze route received request",
      {
        action,
        hasUrl: Boolean(url),
      },
    );
    // #endregion

    const article = await fetchArticle(url);

    if (action === "parse") {
      const response: AnalyzeResponse = {
        mode: "parse",
        title: "Парсинг HTML",
        provider: "html-parser",
        article: {
          date: article.date,
          title: article.title,
          excerpt: article.excerpt,
          url: article.url,
        },
        parsed: {
          date: article.date,
          title: article.title,
          content: article.content,
        },
      };

      return NextResponse.json(response, { status: 200 });
    }

    if (action === "illustration") {
      // #region debug-point E:route-illustration-start
      await reportDebug(
        "pre-fix",
        "E",
        "src/app/api/analyze/route.ts:POST",
        "Starting illustration pipeline in route",
        {
          articleTitleLength: article.title.length,
          articleContentLength: article.content.length,
        },
      );
      // #endregion

      const promptResult = await generateIllustrationPrompt(article);
      const image = await generateIllustrationImage(promptResult.prompt);

      const response: IllustrationResponse = {
        mode: "image",
        title: TITLES[action],
        provider: "huggingface",
        promptProvider: promptResult.provider,
        prompt: promptResult.prompt,
        image,
        article: {
          date: article.date,
          title: article.title,
          excerpt: article.excerpt,
          url: article.url,
        },
      };

      // #region debug-point E:route-illustration-success
      await reportDebug(
        "pre-fix",
        "E",
        "src/app/api/analyze/route.ts:POST",
        "Illustration pipeline completed successfully",
        {
          promptProvider: promptResult.provider,
          imageContentType: image.contentType,
          dataUrlLength: image.dataUrl.length,
        },
      );
      // #endregion

      return NextResponse.json(response, { status: 200 });
    }

    const analysis = await generateAnalysis(action, article);
    const response: AnalysisResponse = {
      mode: "ai",
      title: TITLES[action],
      result: analysis.result,
      provider: analysis.provider,
      article: {
        date: article.date,
        title: article.title,
        excerpt: article.excerpt,
        url: article.url,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Не удалось обработать статью. Попробуйте ещё раз.";

    // #region debug-point E:route-catch
    await reportDebug(
      "pre-fix",
      "E",
      "src/app/api/analyze/route.ts:POST",
      "Analyze route caught an error",
      {
        errorMessage: message,
      },
    );
    // #endregion

    const status =
      message.includes("Укажите") ||
      message.includes("Поддерживаются") ||
      message.includes("Не удалось загрузить статью") ||
      message.includes("Не удалось извлечь текст") ||
      message.includes("слишком мало") ||
      message.includes("Unexpected end of JSON") ||
      message.includes("Expected property name")
        ? 400
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
