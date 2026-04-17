export interface StyleProfile {
  id: string;
  name: string;
  sentenceStructure: string;
  vocabularyLevel: string;
  tone: string;
  transitionWords: string[];
  quirks: string[];
  burstiness: number; // 0-1 score
  perplexity: number; // 0-1 score
  createdAt: number;
}

export interface TextAnalysis {
  originalText: string;
  humanizedText: string;
  styleMatchScore: number;
  suggestions: string[];
}
