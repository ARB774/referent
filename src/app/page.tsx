"use client";

import { useMemo, useState } from "react";

import type { ActionKey, AnalysisResponse } from "@/lib/types";

const actions: {
  key: ActionKey;
  label: string;
  description: string;
}[] = [
  {
    key: "summary",
    label: "Суть",
    description: "Кратко объяснить, о чем эта статья и в чем ее главная мысль.",
  },
  {
    key: "theses",
    label: "Тезисы",
    description: "Собрать главные тезисы, выводы и ключевые идеи статьи.",
  },
  {
    key: "telegram",
    label: "Пост",
    description: "Подготовить короткий пост для Telegram на основе статьи.",
  },
];

export default function Home() {
  const [url, setUrl] = useState("");
  const [selectedAction, setSelectedAction] = useState<ActionKey>("summary");
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const resultContent = useMemo(() => {
    if (!result) {
      return {
        body: "После запуска анализа здесь появится готовый текст на русском языке.",
        points: [
          "Будет показан итоговый текст по выбранному сценарию.",
          "Ниже отобразятся источник статьи, адрес и режим генерации.",
        ],
      };
    }

    return {
      body: result.result,
      points: [
        `Источник: ${result.article.siteName ?? "источник не указан"}`,
        `Адрес статьи: ${result.article.url}`,
        `Автор: ${result.article.byline ?? "не указан"}`,
        `Режим генерации: ${
          result.provider === "traeai" ? "AI (TraeAI)" : "Резервный локальный режим"
        }`,
      ],
    };
  }, [result]);

  const copyText = useMemo(() => {
    if (!result) {
      return "";
    }

    return [
      result.result,
      `Источник: ${result.article.siteName ?? "источник не указан"}`,
      `Адрес статьи: ${result.article.url}`,
      `Автор: ${result.article.byline ?? "не указан"}`,
      `Режим генерации: ${
        result.provider === "traeai" ? "AI (TraeAI)" : "Резервный локальный режим"
      }`,
    ].join("\n\n");
  }, [result]);

  async function runAnalysis(action: ActionKey) {
    if (!url.trim()) {
      setError("Сначала вставьте URL статьи.");
      return;
    }

    setSelectedAction(action);
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
          action,
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
          <p className="app-eyebrow">Referent AI</p>
          <h1 className="app-title">Разбор англоязычных статей с помощью AI</h1>
        </section>

        <section className="app-card">
          <h2 className="app-sectionTitle">Описание сервиса</h2>
          <p className="app-text">
            Сервис принимает URL англоязычной статьи, выполняет парсинг текста и
            по выбранному сценарию формирует ответ на русском языке: краткую
            суть, тезисы или готовый пост для Telegram.
          </p>
        </section>

        <section className="app-card">
          <h2 className="app-sectionTitle">Инструкция</h2>
          <ol className="app-instructionList">
            <li>Вставьте URL англоязычной статьи.</li>
            <li>Выберите один из трёх AI-сценариев для обработки материала.</li>
            <li>
              Получите результат через 1-3 мин. Ответ появится в отдельном
              блоке ниже.
            </li>
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
              {actions.map((action) => {
                const isActive = action.key === selectedAction;

                return (
                  <button
                    key={action.key}
                    type="button"
                    title={action.description}
                    onClick={() => runAnalysis(action.key)}
                    disabled={isLoading}
                    className={`app-button ${isActive ? "app-button--active" : ""}`}
                  >
                    {action.label}
                  </button>
                );
              })}
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
                  ? "Идёт генерация результата..."
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

          <div className="app-resultBody">{resultContent.body}</div>

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
