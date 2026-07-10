export type ActionKey = "summary" | "theses" | "telegram";
export type ParseActionKey = "parse";
export type RequestActionKey = ActionKey | ParseActionKey;

export type ArticleContent = {
  date: string | null;
  title: string;
  content: string;
  excerpt: string;
  url: string;
};

export type AnalysisResponse = {
  mode: "ai";
  title: string;
  result: string;
  provider: "openrouter" | "local-fallback";
  article: {
    date: string | null;
    title: string;
    excerpt: string;
    url: string;
  };
};

export type ParseResponse = {
  mode: "parse";
  title: string;
  provider: "html-parser";
  article: {
    date: string | null;
    title: string;
    excerpt: string;
    url: string;
  };
  parsed: {
    date: string | null;
    title: string;
    content: string;
  };
};

export type AnalyzeResponse = AnalysisResponse | ParseResponse;
