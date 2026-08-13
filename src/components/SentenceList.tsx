import React, { useState } from "react";
import { SentenceClip } from "../types";
import { formatTime } from "../utils/audioUtils";
import {
  Play,
  Eye,
  EyeOff,
  Languages,
  Mic,
  Square,
  Volume2,
  Plus,
  Trash2,
  Edit3,
  Check,
  BookOpen,
  Sparkles,
} from "lucide-react";

interface SentenceListProps {
  sentences: SentenceClip[];
  activeSentenceIndex: number | null;
  isPlaying: boolean;
  isLooping: boolean;
  aiTranslateEnabled: boolean;
  onToggleAiTranslate: (enabled: boolean) => void;
  onSelectSentence: (index: number, autoPlay?: boolean) => void;
  onToggleFrench: (index: number) => void;
  onToggleEnglish: (index: number) => void;
  onToggleAllFrench: (show: boolean) => void;
  onToggleAllEnglish: (show: boolean) => void;
  onUpdateSentenceBounds: (index: number, start: number, end: number) => void;
  onAddSentence: () => void;
  onDeleteSentence: (index: number) => void;
}

export const SentenceList: React.FC<SentenceListProps> = ({
  sentences,
  activeSentenceIndex,
  isPlaying,
  isLooping,
  aiTranslateEnabled,
  onToggleAiTranslate,
  onSelectSentence,
  onToggleFrench,
  onToggleEnglish,
  onToggleAllFrench,
  onToggleAllEnglish,
  onUpdateSentenceBounds,
  onAddSentence,
  onDeleteSentence,
}) => {
  const [allFrenchState, setAllFrenchState] = useState(true);
  const [allEnglishState, setAllEnglishState] = useState(true);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editTimes, setEditTimes] = useState<{ start: string; end: string }>({ start: "0", end: "0" });

  // Voice recording state per sentence
  const [recordingIndex, setRecordingIndex] = useState<number | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordings, setRecordings] = useState<{ [key: number]: string }>({});

  // Handle Master French Toggle
  const handleMasterFrenchToggle = () => {
    const nextState = !allFrenchState;
    setAllFrenchState(nextState);
    onToggleAllFrench(nextState);
  };

  // Handle Master English Toggle
  const handleMasterEnglishToggle = () => {
    const nextState = !allEnglishState;
    setAllEnglishState(nextState);
    onToggleAllEnglish(nextState);
  };

  // Mic Recording Handlers for Shadowing Practice
  const startRecording = async (index: number) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setRecordings((prev) => ({ ...prev, [index]: url }));
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setRecordingIndex(index);
    } catch (err) {
      alert("Microphone access denied or unavailable.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    setRecordingIndex(null);
  };

  const playRecording = (url: string) => {
    const audio = new Audio(url);
    audio.play();
  };

  // Auto scroll active item into view
  const activeCardRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (activeCardRef.current) {
      activeCardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeSentenceIndex]);

  const activeClip = activeSentenceIndex !== null && sentences[activeSentenceIndex]
    ? sentences[activeSentenceIndex]
    : null;

  return (
    <div className="w-full h-full bg-[#141417] border border-white/5 rounded-xl p-3.5 shadow-xl flex flex-col min-h-0 space-y-3 overflow-hidden">
      {/* List Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-white/10 shrink-0">
        <div>
          <h2 className="text-xs uppercase tracking-[0.2em] text-white/70 font-bold flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-[#D4AF37]" />
            Practice Clips ({sentences.length})
          </h2>
        </div>

        {/* Global Master Control Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Master French Transcript Toggle */}
          <button
            onClick={handleMasterFrenchToggle}
            className={`flex items-center gap-1.5 min-h-9 px-2.5 py-1.5 rounded text-[11px] font-semibold border transition-all ${
              allFrenchState
                ? "bg-white/10 border-white/20 text-white"
                : "bg-[#D4AF37]/10 border-[#D4AF37]/30 text-[#D4AF37]"
            }`}
          >
            {allFrenchState ? <Eye className="w-3 h-3 text-white/70" /> : <EyeOff className="w-3 h-3 text-[#D4AF37]" />}
            <span>{allFrenchState ? "Hide Transcript" : "Show Transcript"}</span>
          </button>

          {/* Master English Translation Toggle */}
          <button
            type="button"
            onClick={handleMasterEnglishToggle}
            className={`flex items-center gap-1.5 min-h-9 px-2.5 py-1.5 rounded text-[11px] font-semibold border transition-all ${
              allEnglishState
                ? "bg-white/10 border-white/20 text-white"
                : "bg-white/5 border-white/10 text-white/40"
            }`}
          >
            <Languages className="w-3 h-3 text-white/70" />
            <span>{allEnglishState ? "Hide Translation" : "Show Translation"}</span>
          </button>

          {/* Opt-in Gemini translation (off by default) */}
          <button
            type="button"
            onClick={() => onToggleAiTranslate(!aiTranslateEnabled)}
            className={`flex items-center gap-1.5 min-h-9 px-2.5 py-1.5 rounded text-[11px] font-semibold border transition-all ${
              aiTranslateEnabled
                ? "bg-[#D4AF37] border-[#D4AF37] text-black"
                : "bg-white/5 border-white/10 text-white/50"
            }`}
            title="When on, Gemini translates French clips. Off uses no AI tokens."
          >
            <Sparkles className="w-3 h-3" />
            <span>{aiTranslateEnabled ? "AI Translate On" : "AI Translate Off"}</span>
          </button>

          {/* Add Sentence Clip */}
          <button
            onClick={onAddSentence}
            className="flex items-center gap-1 min-h-9 px-2.5 py-1.5 bg-[#0A0A0B] border border-white/10 hover:bg-white/10 text-white/80 rounded text-[11px] font-medium transition-colors"
          >
            <Plus className="w-3 h-3" /> Add Clip
          </button>
        </div>
      </div>

      {/* ACTIVE SENTENCE PINNED SPOTLIGHT (ALWAYS SHOWING AT TOP) */}
      {activeClip && activeSentenceIndex !== null && (
        <div className="bg-[#1A1A1E] border-2 border-[#D4AF37]/60 rounded-xl p-3.5 shadow-2xl relative space-y-2.5 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-2.5 py-0.5 rounded bg-[#D4AF37] text-black text-xs font-bold font-mono">
                Active Clip #{activeSentenceIndex + 1}
              </span>
              {editingIndex === activeSentenceIndex ? (
                <div className="flex items-center gap-1 text-[11px] font-mono" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="number"
                    step="0.1"
                    value={editTimes.start}
                    onChange={(e) => setEditTimes({ ...editTimes, start: e.target.value })}
                    className="w-14 bg-[#0A0A0B] border border-[#D4AF37]/50 rounded px-1 py-0.5 text-white"
                  />
                  <span className="text-white/40">s -</span>
                  <input
                    type="number"
                    step="0.1"
                    value={editTimes.end}
                    onChange={(e) => setEditTimes({ ...editTimes, end: e.target.value })}
                    className="w-14 bg-[#0A0A0B] border border-[#D4AF37]/50 rounded px-1 py-0.5 text-white"
                  />
                  <span className="text-white/40">s</span>
                  <button
                    onClick={() => {
                      onUpdateSentenceBounds(activeSentenceIndex, parseFloat(editTimes.start), parseFloat(editTimes.end));
                      setEditingIndex(null);
                    }}
                    className="min-w-9 min-h-9 p-2 bg-[#D4AF37] text-black rounded hover:bg-[#e2c154] flex items-center justify-center"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-xs font-mono text-[#D4AF37]">
                  <span>{formatTime(activeClip.startTime, true)}</span>
                  <span className="text-white/30">-</span>
                  <span>{formatTime(activeClip.endTime, true)}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingIndex(activeSentenceIndex);
                      setEditTimes({ start: activeClip.startTime.toString(), end: activeClip.endTime.toString() });
                    }}
                    className="ml-1 min-w-9 min-h-9 p-2 text-white/30 hover:text-[#D4AF37] flex items-center justify-center"
                    title="Fine-tune start and end bounds"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {isPlaying && (
                <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Playing Loop
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onSelectSentence(activeSentenceIndex, true)}
                className={`flex items-center gap-1.5 min-h-10 px-3 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all ${
                  isPlaying ? "bg-[#D4AF37] text-black" : "bg-white/10 hover:bg-[#D4AF37] hover:text-black text-white"
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isPlaying ? "Replay" : "Play Clip"}</span>
              </button>

              <button
                onClick={() => onToggleFrench(activeSentenceIndex)}
                className="min-w-10 min-h-10 p-2 rounded bg-[#0A0A0B] border border-white/10 text-white/70 hover:text-white flex items-center justify-center"
                title="Toggle French Text"
              >
                {activeClip.showFrench ? <Eye className="w-4 h-4 text-[#D4AF37]" /> : <EyeOff className="w-4 h-4 text-white/40" />}
              </button>

              <button
                onClick={() => onToggleEnglish(activeSentenceIndex)}
                className="min-w-10 min-h-10 p-2 rounded bg-[#0A0A0B] border border-white/10 text-white/70 hover:text-white flex items-center justify-center"
                title="Toggle Translation"
              >
                <Languages className={`w-4 h-4 ${activeClip.showEnglish ? "text-[#D4AF37]" : "text-white/30"}`} />
              </button>
            </div>
          </div>

          {/* Active French Text */}
          {activeClip.showFrench ? (
            <p className="text-lg sm:text-xl font-medium leading-relaxed text-white">
              {activeClip.frenchText}
            </p>
          ) : (
            <div
              onClick={() => onToggleFrench(activeSentenceIndex)}
              className="cursor-pointer py-2 px-3 bg-[#0A0A0B] rounded border border-dashed border-white/10 text-white/40 text-xs font-mono flex items-center justify-between"
            >
              <span>🙈 French Text Hidden (Click to reveal)</span>
              <Eye className="w-3.5 h-3.5 text-[#D4AF37]" />
            </div>
          )}

          {/* Active English Translation */}
          {activeClip.showEnglish && activeClip.englishTranslation && (
            <div className="pt-2 border-t border-white/5">
              <p className="text-sm sm:text-base font-medium text-[#D4AF37] leading-relaxed">
                {activeClip.englishTranslation}
              </p>
            </div>
          )}

          {/* Shadowing Recorder */}
          <div className="pt-2 flex items-center justify-between text-xs">
            <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">
              Pronunciation Shadowing
            </span>
            <div className="flex items-center gap-2">
              {recordingIndex === activeSentenceIndex ? (
                <button
                  onClick={stopRecording}
                  className="flex items-center gap-1 px-2.5 py-1 bg-rose-600 text-white rounded font-bold uppercase text-[10px] tracking-wider animate-pulse"
                >
                  <Square className="w-3 h-3 fill-current" /> Stop
                </button>
              ) : (
                <button
                  onClick={() => startRecording(activeSentenceIndex)}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-[#0A0A0B] border border-white/10 hover:border-[#D4AF37]/40 text-white/80 hover:text-white rounded text-[10px] uppercase font-bold tracking-wider transition-colors"
                  title="Record your voice to practice"
                >
                  <Mic className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Record Shadowing</span>
                </button>
              )}

              {recordings[activeSentenceIndex] && (
                <button
                  onClick={() => playRecording(recordings[activeSentenceIndex])}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] rounded text-[10px] uppercase font-bold tracking-wider hover:bg-[#D4AF37]/20 transition-colors"
                >
                  <Volume2 className="w-3.5 h-3.5" /> Play Recording
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty State when no clips exist */}
      {sentences.length === 0 && (
        <div className="py-12 px-6 text-center border border-dashed border-white/10 rounded-xl bg-[#0A0A0B]/40 space-y-2">
          <BookOpen className="w-8 h-8 text-[#D4AF37]/50 mx-auto" />
          <h3 className="text-sm font-semibold text-white/80">No Practice Clips Loaded</h3>
          <p className="text-xs text-white/40 max-w-md mx-auto">
            Upload an audio file in the top bar, then use <span className="text-[#D4AF37] font-semibold">Auto-Detect Speech (AI STT)</span> or paste a French transcript and tap <span className="text-[#D4AF37] font-semibold">Sync Transcript</span> in the transcript panel.
          </p>
        </div>
      )}

      {/* Sentence Cards List */}
      {sentences.length > 0 && (
        <div className="space-y-2 flex-1 min-h-0 overflow-y-auto pr-1">
          {sentences.map((clip, idx) => {
            const isActive = activeSentenceIndex === idx;

            return (
              <div
                key={clip.id || idx}
                ref={isActive ? activeCardRef : null}
                onClick={() => {
                  if (!isActive) onSelectSentence(idx, true);
                }}
                className={`rounded-lg p-3 transition-all cursor-pointer ${
                  isActive
                    ? "bg-[#1A1A1E] border-l-4 border-[#D4AF37] shadow-md ring-1 ring-white/10"
                    : "bg-[#0A0A0B]/60 border border-white/5 hover:border-white/10 hover:bg-[#141417] opacity-60 hover:opacity-100"
                }`}
              >
                {/* Card Header Row: Badge, Time Range & Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono transition-colors ${
                        isActive
                          ? "bg-[#D4AF37] text-black"
                          : "bg-white/10 text-white/60"
                      }`}
                    >
                      #{idx + 1}
                    </span>

                    {/* Timestamp Range */}
                    {editingIndex === idx ? (
                      <div className="flex items-center gap-1 text-[11px] font-mono" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="number"
                          step="0.1"
                          value={editTimes.start}
                          onChange={(e) => setEditTimes({ ...editTimes, start: e.target.value })}
                          className="w-14 bg-[#0A0A0B] border border-[#D4AF37]/50 rounded px-1 py-0.5 text-white"
                        />
                        <span className="text-white/40">s -</span>
                        <input
                          type="number"
                          step="0.1"
                          value={editTimes.end}
                          onChange={(e) => setEditTimes({ ...editTimes, end: e.target.value })}
                          className="w-14 bg-[#0A0A0B] border border-[#D4AF37]/50 rounded px-1 py-0.5 text-white"
                        />
                        <span className="text-white/40">s</span>
                        <button
                          onClick={() => {
                            onUpdateSentenceBounds(idx, parseFloat(editTimes.start), parseFloat(editTimes.end));
                            setEditingIndex(null);
                          }}
                          className="p-1 bg-[#D4AF37] text-black rounded hover:bg-[#e2c154]"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-xs font-mono text-[#D4AF37]">
                        <span>{formatTime(clip.startTime, true)}</span>
                        <span className="text-white/30">-</span>
                        <span>{formatTime(clip.endTime, true)}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingIndex(idx);
                            setEditTimes({ start: clip.startTime.toString(), end: clip.endTime.toString() });
                          }}
                          className="ml-1 text-white/30 hover:text-[#D4AF37]"
                          title="Edit timestamp bounds"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {isActive && (
                      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#D4AF37] font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-pulse"></span>
                        <span>Showing Above</span>
                      </div>
                    )}
                  </div>

                  {/* Right Action Buttons */}
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {/* Play Clip Button */}
                    <button
                      onClick={() => onSelectSentence(idx, true)}
                      className={`flex items-center gap-1 min-h-9 px-2.5 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition-all ${
                        isActive && isPlaying
                          ? "bg-[#D4AF37] text-black"
                          : "bg-white/10 hover:bg-[#D4AF37] hover:text-black text-white"
                      }`}
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>{isActive && isPlaying ? "Playing" : "Play"}</span>
                    </button>

                    {/* Toggle French visibility */}
                    <button
                      onClick={() => onToggleFrench(idx)}
                      className="min-w-9 min-h-9 p-2 rounded bg-[#0A0A0B] border border-white/10 text-white/50 hover:text-white flex items-center justify-center"
                      title={clip.showFrench ? "Hide French Text" : "Show French Text"}
                    >
                      {clip.showFrench ? <Eye className="w-3.5 h-3.5 text-[#D4AF37]" /> : <EyeOff className="w-3.5 h-3.5 text-white/40" />}
                    </button>

                    {/* Toggle English visibility */}
                    <button
                      onClick={() => onToggleEnglish(idx)}
                      className="min-w-9 min-h-9 p-2 rounded bg-[#0A0A0B] border border-white/10 text-white/50 hover:text-white flex items-center justify-center"
                      title={clip.showEnglish ? "Hide English Translation" : "Show English Translation"}
                    >
                      <Languages className={`w-3.5 h-3.5 ${clip.showEnglish ? "text-white" : "text-white/30"}`} />
                    </button>

                    {/* Delete Clip */}
                    <button
                      onClick={() => onDeleteSentence(idx)}
                      className="min-w-9 min-h-9 p-2 rounded bg-[#0A0A0B] border border-white/10 text-white/40 hover:text-rose-400 flex items-center justify-center"
                      title="Delete clip"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* COMPACT TEXT PREVIEW */}
                <div className="mt-1 text-xs text-white/80 truncate">
                  {clip.showFrench ? clip.frenchText : "French sentence hidden"}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

