import React, { useState, useEffect, useRef } from "react";
import { FileText, Sparkles, Upload, Check, Mic, MicOff } from "lucide-react";
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
  const [isListeningDictation, setIsListeningDictation] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    setText(currentTranscript);
  }, [currentTranscript]);

  const handleToggleDictation = () => {
    if (isListeningDictation) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListeningDictation(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Browser Speech Recognition (STT) is not supported on this browser. Please use Auto-Detect Speech or paste your French transcript.");
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.lang = "fr-FR";
      rec.continuous = true;
      rec.interimResults = true;

      rec.onstart = () => {
        setIsListeningDictation(true);
      };

      rec.onresult = (event: any) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript + " ";
        }
        if (transcript.trim()) {
          setText(transcript.trim());
        }
      };

      rec.onerror = () => {
        setIsListeningDictation(false);
      };

      rec.onend = () => {
        setIsListeningDictation(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch {
      setIsListeningDictation(false);
    }
  };

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
    <div className="w-full h-full bg-[#141417] border border-white/5 rounded-xl p-3.5 shadow-xl flex flex-col min-h-[260px] space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div>
          <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-white/70 flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-[#D4AF37]" /> French Transcript Source
          </h3>
          <p className="text-[11px] text-white/40 mt-0.5">
            Paste transcript, upload TXT, or use French STT speech helper.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleDictation}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-semibold border transition-all min-h-9 ${
              isListeningDictation
                ? "bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse"
                : "bg-[#0A0A0B] border-white/10 hover:bg-white/5 text-white/80"
            }`}
            title="Listen to French speech and write text live in browser"
          >
            {isListeningDictation ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-[#D4AF37]" />}
            <span>{isListeningDictation ? "Stop Dictation" : "Mic (French STT)"}</span>
          </button>

          <label className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#0A0A0B] border border-white/10 hover:bg-white/5 text-white/70 rounded text-[11px] font-medium cursor-pointer transition-colors min-h-9">
            <Upload className="w-3.5 h-3.5 text-[#D4AF37]" /> TXT
            <input type="file" accept=".txt,.srt" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste French transcript here, dictation with Mic, or tap Auto-Detect Speech..."
        className="w-full bg-[#0A0A0B] border border-white/10 rounded-lg p-2.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-[#D4AF37]/60 font-sans leading-relaxed flex-1 min-h-[90px] sm:min-h-[70px] resize-none overflow-y-auto"
      />

      {/* Button Toolbar - Always Visible & Responsive on All Devices */}
      <div className="flex flex-col sm:flex-row gap-2 pt-1 shrink-0">
        {onAutoTranscribeSTT && (
          <button
            type="button"
            onClick={onAutoTranscribeSTT}
            disabled={isTranscribingSTT}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-3 sm:py-2.5 bg-white/5 hover:bg-white/10 border border-[#D4AF37]/30 text-[#D4AF37] font-semibold rounded-lg text-xs sm:text-[11px] uppercase tracking-wider transition-colors disabled:opacity-50 min-h-11"
            title="Auto-detect speech from audio and create segments without needing AI translation"
          >
            {isTranscribingSTT ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin" />
                <span>Detecting Speech...</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                <span>Auto-Detect Speech</span>
              </>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={handleApplyText}
          disabled={isParsing || !text.trim()}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-3 sm:py-2.5 bg-[#D4AF37] hover:bg-[#e2c154] text-black font-bold rounded-lg text-xs sm:text-[11px] uppercase tracking-widest disabled:opacity-50 transition-all min-h-11"
        >
          {isParsing ? (
            <>
              <Sparkles className="w-4 h-4 animate-spin text-black" />
              <span>Parsing...</span>
            </>
          ) : savedSuccess ? (
            <>
              <Check className="w-4 h-4 text-black" />
              <span>Synced!</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-black" />
              <span>Sync Transcript</span>
            </>
          )      }
        </button>
      </div>
    </div>
  );
};


