"use client";

import { Fragment, useMemo, useState } from "react";

import type {
  AnalyzeResponse,
  RequestActionKey,
} from "@/lib/types";

const actions: {
  key: RequestActionKey;
  label: string;
  description: string;
}[] = [
  {
    key: "summary",
    label: "Суть",
    description: "Кратко объяснить, о чем статья и в чем ее основная мысль.",
  },
  {
    key: "theses",
    label: "Тезисы",
    description: "Собрать главные тезисы, выводы и ключевые идеи материала.",
  },
  {
    key: "telegram",
    label: "Пост",
    description: "Подготовить короткий пост для Telegram по содержанию статьи.",
  },
  {
    key: "illustration",
    label: "Иллюстрация",
    description: "Сгенерировать иллюстрацию по статье (OpenRouter → Hugging Face).",
  },
];

const translateAction = {
  key: "translate" as const,
  label: "Перевести",
  description: "Перевести полный текст статьи на русский язык через OpenRouter.",
};

const parseAction = {
  key: "parse" as const,
  label: "Парсинг HTML",
  description:
    "Найти дату, заголовок статьи и основной контент страницы и вернуть JSON.",
};

function renderLinkifiedText(text: string) {
  const urlRegex = /(https?:\/\/[^\s)]+)(?=[)\s]|$)/g;
  const matches = [...text.matchAll(urlRegex)];

  if (matches.length === 0) {
    return text;
  }

  const nodes: Array<React.ReactNode> = [];
  let cursor = 0;

  for (const [matchText] of matches) {
    const matchIndex = text.indexOf(matchText, cursor);

    if (matchIndex > cursor) {
      nodes.push(text.slice(cursor, matchIndex));
    }

    nodes.push(
      <a
        key={`url-${matchIndex}`}
        href={matchText}
        target="_blank"
        rel="noreferrer noopener"
      >
        {matchText}
      </a>,
    );

    cursor = matchIndex + matchText.length;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}

function AiResultBody({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="app-resultBody">
      {lines.map((line, index) => {
        const boldMatch = line.match(/^\*\*(.+)\*\*$/);

        return (
          <Fragment key={`${index}-${line}`}>
            {boldMatch ? (
              <strong>{renderLinkifiedText(boldMatch[1])}</strong>
            ) : (
              renderLinkifiedText(line)
            )}
            {index < lines.length - 1 ? <br /> : null}
          </Fragment>
        );
      })}
    </div>
  );
}

function ImageResultBody({
  title,
  prompt,
  dataUrl,
}: {
  title: string;
  prompt: string;
  dataUrl: string;
}) {
  return (
    <div className="app-imageResult">
      <img className="app-illustration" src={dataUrl} alt={title} />
      <div className="app-imagePrompt">
        <div className="app-imagePromptLabel">Промпт</div>
        <div className="app-imagePromptText">{renderLinkifiedText(prompt)}</div>
      </div>
    </div>
  );
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [selectedAction, setSelectedAction] = useState<RequestActionKey | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const processText = useMemo(() => {
    if (!isLoading) {
      return "";
    }

    if (selectedAction === "parse") {
      return "Загружаю и парсю статью…";
    }

    if (selectedAction === "illustration") {
      return "Генерирую иллюстрацию…";
    }

    return "Загружаю статью…";
  }, [isLoading, selectedAction]);

  const resultContent = useMemo(() => {
    if (!result) {
      return {
        body:
          "После запуска здесь появится либо готовый AI-ответ, либо JSON с результатом HTML-парсинга.",
        points: [
          "Можно выбрать один из сценариев: Суть, Тезисы, Пост, Иллюстрация, Перевести.",
          "Можно отдельно запустить Парсинг HTML и получить JSON { date, title, content }.",
        ],
      };
    }

    if (result.mode === "parse") {
      return {
        body: JSON.stringify(result.parsed, null, 2),
        points: [
          `Дата публикации: ${result.article.date ?? "не найдена"}`,
          `Заголовок: ${result.article.title}`,
          `Адрес статьи: ${result.article.url}`,
          "Режим генерации: HTML-парсер",
        ],
      };
    }

    if (result.mode === "image") {
      return {
        body: result.prompt,
        points: [
          `Дата публикации: ${result.article.date ?? "не найдена"}`,
          `Заголовок: ${result.article.title}`,
          `Адрес статьи: ${result.article.url}`,
          `Провайдер промпта: ${
            result.promptProvider === "openrouter" ? "OpenRouter" : "Резервный локальный режим"
          }`,
          "Генерация изображения: Hugging Face",
        ],
      };
    }

    return {
      body: result.result,
      points: [
        `Дата публикации: ${result.article.date ?? "не найдена"}`,
        `Заголовок: ${result.article.title}`,
        `Адрес статьи: ${result.article.url}`,
        `Режим генерации: ${
          result.provider === "openrouter" ? "AI (OpenRouter)" : "Резервный локальный режим"
        }`,
      ],
    };
  }, [result]);

  const copyText = useMemo(() => {
    if (!result) {
      return "";
    }

    if (result.mode === "parse") {
      return [
        JSON.stringify(result.parsed, null, 2),
        `Дата публикации: ${result.article.date ?? "не найдена"}`,
        `Заголовок: ${result.article.title}`,
        `Адрес статьи: ${result.article.url}`,
        "Режим генерации: HTML-парсер",
      ].join("\n\n");
    }

    if (result.mode === "image") {
      return [
        `Промпт:\n${result.prompt}`,
        `Дата публикации: ${result.article.date ?? "не найдена"}`,
        `Заголовок: ${result.article.title}`,
        `Адрес статьи: ${result.article.url}`,
        `Провайдер промпта: ${
          result.promptProvider === "openrouter" ? "OpenRouter" : "Резервный локальный режим"
        }`,
        "Генерация изображения: Hugging Face",
      ].join("\n\n");
    }

    return [
      result.result,
      `Дата публикации: ${result.article.date ?? "не найдена"}`,
      `Заголовок: ${result.article.title}`,
      `Адрес статьи: ${result.article.url}`,
      `Режим генерации: ${
        result.provider === "openrouter" ? "AI (OpenRouter)" : "Резервный локальный режим"
      }`,
    ].join("\n\n");
  }, [result]);

  async function runAnalysis(action: RequestActionKey) {
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

      const data = (await response.json()) as AnalyzeResponse & { error?: string };

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
          <h1 className="app-title">
            Разбор англоязычных статей: OpenRouter и парсинг HTML
          </h1>
        </section>

        <section className="app-card">
          <h2 className="app-sectionTitle">Описание сервиса</h2>
          <p className="app-text">
            Сервис загружает статью по URL, извлекает заголовок, дату и основной
            контент. Затем можно либо получить JSON с результатом HTML-парсинга,
            либо передать материал в OpenRouter для подготовки ответа на русском
            языке по выбранному сценарию.
          </p>
        </section>

        <section className="app-card">
          <h2 className="app-sectionTitle">Инструкция</h2>
          <ol className="app-instructionList">
            <li>Вставьте URL англоязычной статьи.</li>
            <li>Выберите парсинг HTML или один из сценариев OpenRouter.</li>
            <li>Получите JSON или текстовый результат обработки в блоке ниже.</li>
          </ol>
        </section>

        <section className="app-card">
          <h2 className="app-sectionTitle">Рабочая область</h2>
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
              placeholder="Введите URL статьи, например: `https://example.com/article`"
              className="app-input"
            />
            <p className="app-inputHint">Укажите ссылку на англоязычную статью</p>
            <div className="app-actionGroup">
              <p className="app-actionLabel">Парсинг статьи</p>
              <button
                type="button"
                title={parseAction.description}
                onClick={() => runAnalysis(parseAction.key)}
                disabled={isLoading}
                className={`app-button app-button--feature ${
                  selectedAction === parseAction.key ? "app-button--active" : ""
                }`}
              >
                {parseAction.label}
              </button>
            </div>

            <div className="app-actionGroup">
              <p className="app-actionLabel">AI-сценарии OpenRouter</p>
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

              <button
                type="button"
                title={translateAction.description}
                onClick={() => runAnalysis(translateAction.key)}
                disabled={isLoading}
                className={`app-button app-button--translate ${
                  selectedAction === translateAction.key ? "app-button--active" : ""
                }`}
              >
                {translateAction.label}
              </button>
            </div>

            {error ? <div className="app-error">{error}</div> : null}
          </form>
        </section>

        <section className="app-card">
          {processText ? <div className="app-process">{processText}</div> : null}
          <div className="app-resultHeader">
            <div>
              <h2 className="app-sectionTitle">Результаты</h2>
              <p className="app-status">
                {result
                  ? result.mode === "parse"
                    ? "JSON с результатом парсинга сформирован."
                    : "Результат AI-обработки сформирован."
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

          {result?.mode === "ai" ? (
            <AiResultBody text={resultContent.body} />
          ) : result?.mode === "image" ? (
            <ImageResultBody
              title={result.title}
              prompt={result.prompt}
              dataUrl={result.image.dataUrl}
            />
          ) : (
            <div className="app-resultBody">{resultContent.body}</div>
          )}

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
