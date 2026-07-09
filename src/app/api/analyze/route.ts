import { NextResponse } from "next/server";

import { generateAnalysis } from "@/lib/ai";
import { fetchArticle } from "@/lib/article";
import type { ActionKey, AnalysisResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TITLES: Record<ActionKey, string> = {
  summary: "Суть",
  theses: "Тезисы",
  telegram: "Пост",
};

function isActionKey(value: string): value is ActionKey {
  return value === "summary" || value === "theses" || value === "telegram";
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

    if (!action || !isActionKey(action)) {
      return NextResponse.json(
        { error: "Укажите корректное действие для анализа." },
        { status: 400 },
      );
    }

    const article = await fetchArticle(url);
    const analysis = await generateAnalysis(action, article);

    const response: AnalysisResponse = {
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
