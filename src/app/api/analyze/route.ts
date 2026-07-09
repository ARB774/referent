import { NextResponse } from "next/server";

import { fetchArticle } from "@/lib/article";
import type { AnalysisResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      url?: string;
    };

    const url = body.url?.trim();

    if (!url) {
      return NextResponse.json(
        { error: "Укажите URL англоязычной статьи." },
        { status: 400 },
      );
    }

    const article = await fetchArticle(url);
    return NextResponse.json(article satisfies AnalysisResponse, { status: 200 });
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
