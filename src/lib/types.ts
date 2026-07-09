export type ActionKey = "summary" | "theses" | "telegram";

export type ArticleContent = {
  title: string;
  text: string;
  excerpt: string;
  byline?: string;
  siteName?: string;
  url: string;
};

export type AnalysisResponse = {
  title: string;
  result: string;
  provider: "traeai" | "local-fallback";
  article: {
    title: string;
    excerpt: string;
    byline?: string;
    siteName?: string;
    url: string;
  };
};
