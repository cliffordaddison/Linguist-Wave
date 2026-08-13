import React, { useState, useEffect } from "react";
import { FileText, Sparkles, Upload, Check, Mic } from "lucide-react";
import { splitFrenchSentences } from "../utils/frenchSegments";

interface TranscriptUploaderProps {
  currentTranscript: string;
  onUpdateTranscript: (rawText: string, sentences: string[]) => void;
  onAutoParseAI: (rawText: string) => Promise<string[]>;
  onAutoTranscribeSTT?: () => void;
  isTranscribingSTT?: boolean;
}

export const TranscriptUploader: React.FC<TranscriptUploaderProps> = ({
  currentTranscript,
  onUpdateTranscript,
  onAutoParseAI,
  onAutoTranscribeSTT,
  isTranscribingSTT,
}) => {
  const [text, setText] = useState(currentTranscript);
  const [isParsing, setIsParsing] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setText(currentTranscript);
  }, [currentTranscript]);

  const handleApplyText = async () => {
    if (!text.trim()) return;

    setIsParsing(true);
    try {
      let parsedSentences = splitFrenchSentences(text);
      if (parsedSentences.length === 0) {
        parsedSentences = await onAutoParseAI(text);
      }
      onUpdateTranscript(text, parsedSentences);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (err) {
      // Fallback simple line split
      const simpleSplit = splitFrenchSentences(text);
      onUpdateTranscript(
        text,
        simpleSplit.length > 0
          ? simpleSplit
          : text
              .split(/\n+|\./)
              .map((s) => s.trim())
              .filter((s) => s.length > 0)
      );
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        setText(content);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-full h-full bg-[#141417] border border-white/5 rounded-xl p-3.5 shadow-xl flex flex-col min-h-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div>
          <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-white/70 flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-[#D4AF37]" /> French Transcript Source
          </h3>
          <p className="text-[11px] text-white/40 mt-0.5">
            Paste transcript, upload TXT, or use AI Speech-to-Text (STT) auto-detection.
          </p>
        </div>

        <label className="flex items-center gap-1.5 px-2.5 py-1 bg-[#0A0A0B] border border-white/10 hover:bg-white/5 text-white/70 rounded text-[11px] font-medium cursor-pointer transition-colors">
          <Upload className="w-3 h-3 text-[#D4AF37]" /> Upload TXT
          <input type="file" accept=".txt,.srt" onChange={handleFileUpload} className="hidden" />
        </label>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste French transcript, or click Auto-Detect Speech below..."
        className="w-full bg-[#0A0A0B] border border-white/10 rounded-lg p-2.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-[#D4AF37]/60 font-sans leading-relaxed flex-1 min-h-[70px] resize-none overflow-y-auto"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 shrink-0 sticky bottom-0 z-10 bg-[#141417] -mx-3.5 px-3.5 pb-0.5">
        {onAutoTranscribeSTT ? (
          <button
            onClick={onAutoTranscribeSTT}
            disabled={isTranscribingSTT}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-3 sm:py-2.5 bg-white/5 hover:bg-white/10 border border-[#D4AF37]/30 text-[#D4AF37] font-semibold rounded text-[11px] uppercase tracking-wider transition-colors disabled:opacity-50 min-h-11"
            title="Auto-detect speech from audio using Gemini STT and translate without transcript"
          >
            {isTranscribingSTT ? (
              <>
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                <span>Detecting...</span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5" />
                <span>Auto-Detect Speech</span>
              </>
            )}
          </button>
        ) : (
          <div className="hidden sm:block" />
        )}

        <button
          onClick={handleApplyText}
          disabled={isParsing || !text.trim()}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-3 sm:py-2.5 bg-[#D4AF37] hover:bg-[#e2c154] text-black font-bold rounded text-[11px] uppercase tracking-widest disabled:opacity-50 transition-all min-h-11"
        >
          {isParsing ? (
            <>
              <Sparkles className="w-3.5 h-3.5 animate-spin text-black" />
              <span>Parsing...</span>
            </>
          ) : savedSuccess ? (
            <>
              <Check className="w-3.5 h-3.5 text-black" />
              <span>Synced!</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-black" />
              <span>Sync Transcript</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

