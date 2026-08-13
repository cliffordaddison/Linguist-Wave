import { SentenceClip } from "../types";

const CONNECTORS = [
  "et puis",
  "et alors",
  "et donc",
  "et",
  "mais",
  "ou bien",
  "ou",
  "donc",
  "car",
  "puis",
  "cependant",
  "pourtant",
  "néanmoins",
  "neanmoins",
  "en effet",
  "par conséquent",
  "c'est pourquoi",
  "afin que",
  "afin qu'",
  "parce que",
  "parce qu'",
  "alors que",
  "alors qu'",
  "tandis que",
  "tandis qu'",
  "bien que",
  "bien qu'",
  "puisque",
  "puisqu'",
  "lorsque",
  "lorsqu'",
  "quand",
  "comme",
  "si",
  "que",
  "qu'",
  "qui",
  "dont",
  "où",
];

const TERMINAL_PUNCT = /[.!?…]+$/;
const CONTINUING_PUNCT = /[,;:—\-\s]+$/;
const CONNECTOR_START = new RegExp(
  `^(${CONNECTORS.map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
  "i"
);

function normalizeFragment(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function startsWithConnector(text: string): boolean {
  const norm = normalizeFragment(text);
  return CONNECTOR_START.test(norm) || /^[a-zàâæçéèêëîïôœùûüÿ]/.test(norm);
}

export function hasTerminalPunctuation(text: string): boolean {
  return TERMINAL_PUNCT.test(normalizeFragment(text));
}

export function hasContinuingPunctuation(text: string): boolean {
  return CONTINUING_PUNCT.test(text.trim());
}

/**
 * Split French transcript into sentences using terminal punctuation / blank lines.
 * Does not split on commas or coordinating connectors (et, mais, ou, donc, …).
 */
export function splitFrenchSentences(raw: string): string[] {
  if (!raw || !raw.trim()) return [];

  const blocks = raw
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  const sentences: string[] = [];

  for (const block of blocks) {
    const pieces = block
      .split(/(?<=[.!?…])\s+/)
      .map(normalizeFragment)
      .filter(Boolean);

    let current = "";
    for (const piece of pieces) {
      if (!current) {
        current = piece;
        continue;
      }

      if (startsWithConnector(piece) || !hasTerminalPunctuation(current) || hasContinuingPunctuation(current)) {
        current = `${current} ${piece}`;
        continue;
      }

      sentences.push(current);
      current = piece;
    }

    if (current) {
      sentences.push(current);
    }
  }

  return sentences.filter((s) => s.length > 0);
}

/**
 * Merge clips whose French continues the previous sentence
 * (starts with et/mais/… or previous has no terminal punctuation).
 * Extends endTime and concatenates text. Reindexes.
 */
export function mergeContinuationClips(clips: SentenceClip[]): SentenceClip[] {
  if (clips.length <= 1) return clips;

  const merged: SentenceClip[] = [];

  for (const clip of clips) {
    const prev = merged[merged.length - 1];
    const text = normalizeFragment(clip.frenchText || "");
    const prevText = prev ? normalizeFragment(prev.frenchText || "") : "";

    const isPlaceholder =
      /^section\s*#/i.test(text) ||
      /^audio segment\s*#/i.test(text) ||
      /^phrase\s*#/i.test(text);

    const prevPlaceholder =
      /^section\s*#/i.test(prevText) ||
      /^audio segment\s*#/i.test(prevText) ||
      /^phrase\s*#/i.test(prevText);

    const shouldMerge =
      !!prev &&
      text.length > 0 &&
      !isPlaceholder &&
      (startsWithConnector(text) ||
        (prevText.length > 0 && !hasTerminalPunctuation(prevText) && !prevPlaceholder) ||
        hasContinuingPunctuation(prevText));

    if (shouldMerge && prev) {
      prev.frenchText = `${prevText} ${text}`.trim();
      prev.endTime = Math.max(prev.endTime, clip.endTime);
      if (clip.englishTranslation && clip.englishTranslation !== "—" && clip.englishTranslation !== "Translating...") {
        const prevEn = (prev.englishTranslation || "").trim();
        if (!prevEn || prevEn === "—" || prevEn === "Translating...") {
          prev.englishTranslation = clip.englishTranslation;
        } else if (!prevEn.includes(clip.englishTranslation)) {
          prev.englishTranslation = `${prevEn} ${clip.englishTranslation}`.trim();
        }
      }
      continue;
    }

    merged.push({ ...clip });
  }

  return merged.map((clip, index) => ({ ...clip, index }));
}

