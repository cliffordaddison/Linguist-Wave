export interface VocabItem {
  word: string;
  meaning: string;
}

export interface SentenceClip {
  id: string;
  index: number;
  frenchText: string;
  englishTranslation: string;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  showFrench: boolean;
  showEnglish: boolean;
  keyVocab?: VocabItem[];
  grammarNotes?: string;
  recordedAudioUrl?: string | null;
}

export interface PresetSample {
  id: string;
  title: string;
  description: string;
  audioUrl?: string;
  transcriptRaw: string;
  sentences: Omit<SentenceClip, "id" | "index" | "showFrench" | "showEnglish">[];
}
