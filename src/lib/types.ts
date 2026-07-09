export type ActionKey = "summary" | "theses" | "telegram";

export type ArticleContent = {
  date: string | null;
  title: string;
  content: string;
  excerpt: string;
  url: string;
};

export type AnalysisResponse = {
  title: string;
  result: string;
  provider: "openai" | "local-fallback";
  article: {
    date: string | null;
    title: string;
    excerpt: string;
    url: string;
  };
};
