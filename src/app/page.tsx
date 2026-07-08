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
    label: "О чем статья?",
    description: "Краткое объяснение сути статьи простым языком.",
  },
  {
    key: "theses",
    label: "Тезисы",
    description: "Структурированный список ключевых мыслей и выводов.",
  },
  {
    key: "telegram",
    label: "Пост для Telegram",
    description: "Черновик поста с адаптацией под формат канала.",
  },
];

export default function Home() {
  const [url, setUrl] = useState("");
  const [selectedAction, setSelectedAction] = useState<ActionKey>("summary");
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const selectedActionData = useMemo(
    () => actions.find((action) => action.key === selectedAction) ?? actions[0],
    [selectedAction],
  );

  const resultContent = useMemo(() => {
    if (!result) {
      return {
        title: "Результат появится здесь",
        body: "Введите URL англоязычной статьи и выберите нужный сценарий. После подключения AI в этом блоке будет появляться сгенерированный ответ.",
        points: [
          "Парсинг исходной статьи по URL.",
          "Запуск AI-сценария по выбранной кнопке.",
          "Вывод готового ответа в удобном формате.",
        ],
      };
    }

    return {
      title: result.title,
      body: result.result,
      points: [
        `Источник: ${result.article.title}`,
        `Сайт: ${result.article.siteName ?? "не указан"}`,
        `Режим генерации: ${
          result.provider === "openai" ? "AI (OpenAI)" : "Локальный fallback"
        }`,
      ],
    };
  }, [result]);

  async function runAnalysis(action: ActionKey) {
    if (!url.trim()) {
      setError("Сначала вставьте URL статьи.");
      return;
    }

    setSelectedAction(action);
    setError("");
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

      const data = (await response.json()) as AnalysisResponse & {
        error?: string;
      };

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

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-10 lg:px-10 lg:py-14">
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] shadow-2xl shadow-slate-950/40">
          <div className="grid gap-8 p-6 md:p-8 lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
            <div className="flex flex-col gap-6">
              <div className="inline-flex w-fit items-center rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-sm font-medium text-cyan-200">
                Referent AI
              </div>

              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
                  Интерфейс для разбора англоязычных статей с помощью AI
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
                  Приложение принимает URL статьи, выполняет парсинг и по
                  выбранному сценарию помогает быстро получить краткое
                  объяснение, тезисы или готовый пост для Telegram.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <p className="text-sm font-medium text-slate-200">
                    1. Вставьте ссылку
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    URL англоязычной статьи для дальнейшего парсинга.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <p className="text-sm font-medium text-slate-200">
                    2. Выберите действие
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Один из трёх AI-сценариев для обработки материала.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <p className="text-sm font-medium text-slate-200">
                    3. Получите результат
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Ответ появится в отдельном блоке справа.
                  </p>
                </div>
              </div>
            </div>

            <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 backdrop-blur md:p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white">
                  Параметры запроса
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Введите URL статьи и выберите сценарий. Приложение загрузит
                  страницу, извлечёт текст и попробует сгенерировать ответ через
                  AI.
                </p>
              </div>

              <form
                className="space-y-6"
                onSubmit={(event) => event.preventDefault()}
              >
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-slate-200"
                    htmlFor="article-url"
                  >
                    URL англоязычной статьи
                  </label>
                  <input
                    id="article-url"
                    type="url"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://example.com/article"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
                  />
                  <p className="text-xs leading-5 text-slate-500">
                    Поддерживается адрес статьи, которую нужно разобрать или
                    адаптировать.
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-200">
                    Выберите действие
                  </p>
                  <div className="grid gap-3">
                    {actions.map((action) => {
                      const isActive = action.key === selectedAction;

                      return (
                        <button
                          key={action.key}
                          type="button"
                          onClick={() => runAnalysis(action.key)}
                          disabled={isLoading}
                          className={`rounded-2xl border px-4 py-4 text-left transition ${
                            isActive
                              ? "border-cyan-400/70 bg-cyan-400/10 shadow-lg shadow-cyan-950/30"
                              : "border-white/10 bg-slate-950/70 hover:border-slate-600 hover:bg-slate-900"
                          } ${isLoading ? "cursor-not-allowed opacity-70" : ""}`}
                        >
                          <span className="block text-sm font-semibold text-white">
                            {action.label}
                          </span>
                          <span className="mt-1 block text-sm leading-6 text-slate-400">
                            {action.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {error ? (
                  <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm leading-6 text-rose-100">
                    {error}
                  </div>
                ) : null}
              </form>
            </section>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
            <h2 className="text-lg font-semibold text-white">
              Текущий сценарий
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Активное действие:
            </p>
            <div className="mt-3 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm font-medium text-emerald-200">
              {selectedActionData.label}
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              {selectedActionData.description}
            </p>
            <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-slate-950/60 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Источник
              </p>
              <p className="mt-2 break-all text-sm leading-6 text-slate-300">
                {result?.article.url || url.trim() || "URL пока не указан"}
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/80">
                  Блок результата
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-white">
                  {resultContent.title}
                </h2>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
                {isLoading
                  ? "Генерация..."
                  : result
                    ? "Ответ получен"
                    : "Ожидание генерации"}
              </div>
            </div>

            <div className="mt-5 max-w-3xl whitespace-pre-wrap text-sm leading-7 text-slate-300 md:text-base">
              {resultContent.body}
            </div>

            <ul className="mt-6 space-y-3">
              {resultContent.points.map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-slate-200"
                >
                  <span className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-cyan-400" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>

            {result?.article.excerpt ? (
              <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Фрагмент статьи
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {result.article.excerpt}
                </p>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
