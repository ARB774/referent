export type ParsedArticle = {
  date: string | null;
  title: string;
  content: string;
  url: string;
};

export type AnalysisResponse = ParsedArticle;
