"use client";

import { useMemo, useState } from "react";

import type { AnalysisResponse } from "@/lib/types";

export default function Home() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const resultContent = useMemo(() => {
    if (!result) {
      return {
        body: `{\n  "date": null,\n  "title": "",\n  "content": ""\n}`,
        points: [
          "Здесь появится JSON с датой, заголовком и основным контентом статьи.",
          "Ниже будет показан адрес страницы и длина извлечённого контента.",
        ],
      };
    }

    return {
      body: JSON.stringify(
        {
          date: result.date,
          title: result.title,
          content: result.content,
        },
        null,
        2,
      ),
      points: [
        `Дата публикации: ${result.date ?? "не найдена"}`,
        `Заголовок: ${result.title}`,
        `Адрес статьи: ${result.url}`,
        `Длина контента: ${result.content.length} символов`,
      ],
    };
  }, [result]);

  const copyText = useMemo(() => {
    if (!result) {
      return "";
    }

    return [
      JSON.stringify(
        {
          date: result.date,
          title: result.title,
          content: result.content,
        },
        null,
        2,
      ),
      `Адрес статьи: ${result.url}`,
    ].join("\n\n");
  }, [result]);

  async function runAnalysis() {
    if (!url.trim()) {
      setError("Сначала вставьте URL статьи.");
      return;
    }

    setError("");
    setCopied(false);
    setIsLoading(true);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
        }),
      });

      const contentType = response.headers.get("content-type") ?? "";
      const isJson = contentType.includes("application/json");

      if (!isJson) {
        const text = await response.text();
        const head = text.slice(0, 120).replace(/\s+/g, " ").trim();
        throw new Error(
          `Сервер вернул не JSON (HTTP ${response.status}). Ответ начинается с: ${head}`,
        );
      }

      const data = (await response.json()) as AnalysisResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Не удалось получить результат анализа.");
      }

      setResult(data);
    } catch (requestError) {
      setResult(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось обработать статью.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function copyResult() {
    if (!copyText) {
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(copyText);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = copyText;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Не удалось скопировать результат.");
    }
  }

  return (
    <main className="app-page">
      <div className="app-shell">
        <section className="app-card app-card--accent">
          <p className="app-eyebrow">Referent Parser</p>
          <h1 className="app-title">Извлечение JSON из HTML-статей</h1>
        </section>

        <section className="app-card">
          <h2 className="app-sectionTitle">Описание сервиса</h2>
          <p className="app-text">
            Сервис загружает HTML по URL статьи, ищет дату публикации, заголовок
            и основной контент страницы, а затем возвращает JSON вида
            <code>{` { date, title, content } `}</code>.
          </p>
        </section>

        <section className="app-card">
          <h2 className="app-sectionTitle">Инструкция</h2>
          <ol className="app-instructionList">
            <li>Вставьте URL англоязычной статьи.</li>
            <li>Нажмите кнопку запуска HTML-парсинга.</li>
            <li>Получите JSON с полями date, title и content в блоке ниже.</li>
          </ol>
        </section>

        <section className="app-card">
          <h2 className="app-sectionTitle">Рабочий блок</h2>
          <form
            className="app-form"
            onSubmit={(event) => event.preventDefault()}
          >
            <label className="app-label" htmlFor="article-url">
              URL англоязычной статьи
            </label>
            <input
              id="article-url"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/article"
              className="app-input"
            />
            <div className="app-actions">
              <button
                type="button"
                title="Загрузить HTML страницы и извлечь дату, заголовок и основной контент."
                onClick={runAnalysis}
                disabled={isLoading}
                className="app-button app-button--active"
              >
                Извлечь JSON
              </button>
            </div>

            {error ? <div className="app-error">{error}</div> : null}
          </form>
        </section>

        <section className="app-card">
          <div className="app-resultHeader">
            <div>
              <h2 className="app-sectionTitle">Результаты</h2>
              <p className="app-status">
                {isLoading
                  ? "Идёт парсинг HTML и извлечение JSON..."
                  : result
                    ? "Результат сформирован."
                    : "Ожидается запуск анализа."}
              </p>
            </div>

            {result ? (
              <button
                type="button"
                className="app-copyButton"
                onClick={copyResult}
                title="Скопировать весь текст результата"
              >
                <svg
                  aria-hidden="true"
                  className="app-copyIcon"
                  viewBox="0 0 24 24"
                >
                  <path d="M16 1H6a2 2 0 0 0-2 2v12h2V3h10z" />
                  <path d="M19 5H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2m0 16h-9V7h9z" />
                </svg>
                {copied ? "Скопировано" : "Копировать"}
              </button>
            ) : null}
          </div>

          <pre className="app-resultBody">{resultContent.body}</pre>

          <ul className="app-metaList">
            {resultContent.points.map((point) => (
              <li key={point} className="app-metaItem">
                {point}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
