import { NextResponse } from "next/server";

import { fetchArticle } from "@/lib/article";
import { generateAnalysis } from "@/lib/ai";
import type { ActionKey, AnalysisResponse } from "@/lib/types";

const TITLES: Record<ActionKey, string> = {
  summary: "О чем статья?",
  theses: "Тезисы",
  telegram: "Пост для Telegram",
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
        title: article.title,
        excerpt: article.excerpt,
        byline: article.byline,
        siteName: article.siteName,
        url: article.url,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Не удалось обработать статью. Попробуйте ещё раз.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
