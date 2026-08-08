import React, { useState, useEffect, useRef, useCallback } from "react";
import { SentenceClip } from "./types";
import {
  getAudioContext,
  decodeAudioFile,
  extractWaveformPeaks,
  detectPauseSegments,
  generateSyntheticAudioBuffer,
  formatTime,
  audioBufferToBase64Wav,
} from "./utils/audioUtils";
import { WaveformDisplay } from "./components/WaveformDisplay";
import { AudioControlBar } from "./components/AudioControlBar";
import { SentenceList } from "./components/SentenceList";
import { TranscriptUploader } from "./components/TranscriptUploader";
import { UploadCloud } from "lucide-react";

const INITIAL_DEMO_SENTENCES = [
  {
    startTime: 0.5,
    endTime: 4.8,
    frenchText: "Je vis actuellement à Toronto, où je me suis installé pour mes études.",
    englishTranslation: "I currently live in Toronto, where I settled for my studies.",
  },
  {
    startTime: 5.2,
    endTime: 9.6,
    frenchText: "C'est une ville dynamique et multiculturelle que j'apprécie énormément.",
    englishTranslation: "It's a vibrant and multicultural city that I really enjoy.",
  },
  {
    startTime: 10.1,
    endTime: 15.2,
    frenchText: "Chaque matin, je prends un café dans un petit bistro du quartier.",
    englishTranslation: "Every morning, I grab a coffee at a small neighborhood bistro.",
  },
  {
    startTime: 15.8,
    endTime: 21.0,
    frenchText: "L'apprentissage d'une langue demande de la constance et de la pratique audio.",
    englishTranslation: "Learning a language requires consistency and audio practice.",
  },
];

export default function App() {
  // Audio state
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
  const [duration, setDuration] = useState<number>(22);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(true); // default loop enabled
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [volume, setVolume] = useState<number>(0.9);

  // Slicer bounds
  const [sliceStart, setSliceStart] = useState<number>(0.5);
  const [sliceEnd, setSliceEnd] = useState<number>(4.8);

  // Content state
  const [currentAudioName, setCurrentAudioName] = useState<string>("No audio loaded");
  const [currentTranscript, setCurrentTranscript] = useState<string>("");
  const [sentences, setSentences] = useState<SentenceClip[]>([]);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState<number | null>(null);

  // Loading & STT states
  const [isTranscribingSTT, setIsTranscribingSTT] = useState<boolean>(false);

  // Audio Node Refs for Web Audio API
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const startOffsetRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);

  // CRITICAL BUG FIX: Real-time ref for looping state during playback
  const isLoopingRef = useRef<boolean>(isLooping);
  useEffect(() => {
    isLoopingRef.current = isLooping;
  }, [isLooping]);

  // Stop Web Audio playback safely
  const stopAudio = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch (e) {}
      sourceNodeRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const playAudioRange = useCallback(
    (startSec: number, endSec: number) => {
      stopAudio();

      if (!audioBuffer) return;

      const ctx = getAudioContext();
      audioCtxRef.current = ctx;

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = playbackRate;

      const gain = ctx.createGain();
      gain.gain.value = volume;

      source.connect(gain);
      gain.connect(ctx.destination);

      sourceNodeRef.current = source;
      gainNodeRef.current = gain;

      const clampedStart = Math.max(0, Math.min(startSec, audioBuffer.duration));
      startOffsetRef.current = clampedStart;
      startTimeRef.current = ctx.currentTime;

      source.start(0, clampedStart);
      setIsPlaying(true);

      // Smooth playback loop & time monitor
      const updateLoop = () => {
        if (!sourceNodeRef.current || ctx.state === "closed") return;

        const elapsed = (ctx.currentTime - startTimeRef.current) * playbackRate;
        const currentPos = startOffsetRef.current + elapsed;
        setCurrentTime(currentPos);

        // Check if reached end of slice
        if (currentPos >= endSec) {
          // Check LIVE ref value so toggling loop OFF immediately stops playback!
          if (isLoopingRef.current) {
            playAudioRange(startSec, endSec);
            return;
          } else {
            stopAudio();
            setCurrentTime(endSec);
            return;
          }
        }

        animFrameRef.current = requestAnimationFrame(updateLoop);
      };

      animFrameRef.current = requestAnimationFrame(updateLoop);
    },
    [audioBuffer, playbackRate, volume, stopAudio]
  );

  // Handle Play/Pause
  const handlePlayPause = () => {
    if (isPlaying) {
      stopAudio();
    } else {
      playAudioRange(sliceStart, sliceEnd);
    }
  };

  // Handle Seek
  const handleSeek = (timeSec: number) => {
    setCurrentTime(timeSec);
    if (isPlaying) {
      playAudioRange(timeSec, sliceEnd);
    }
  };

  // Handle Slicer Handle Drag Change
  const handleSliceChange = (start: number, end: number) => {
    const formattedStart = Number(start.toFixed(2));
    const formattedEnd = Number(end.toFixed(2));
    setSliceStart(formattedStart);
    setSliceEnd(formattedEnd);

    // Save fine-tuned bounds into active sentence memory
    if (activeSentenceIndex !== null) {
      setSentences((prev) =>
        prev.map((c, i) =>
          i === activeSentenceIndex
            ? { ...c, startTime: formattedStart, endTime: formattedEnd }
            : c
        )
      );
    }

    if (isPlaying) {
      playAudioRange(start, end);
    }
  };

  // Initial setup: App starts clean/free without preset audio
  useEffect(() => {
    setAudioBuffer(null);
    setDuration(0);
    setWaveformPeaks([]);
    setSentences([]);
    setCurrentTranscript("");
    setActiveSentenceIndex(null);
  }, []);

  // Handle Uploading Custom Audio File
  const handleAudioFileUpload = async (file: File) => {
    stopAudio();
    try {
      const decodedBuffer = await decodeAudioFile(file);
      setAudioBuffer(decodedBuffer);
      setDuration(decodedBuffer.duration);
      setWaveformPeaks(extractWaveformPeaks(decodedBuffer, 800));
      setCurrentAudioName(file.name);

      // Dynamically detect sentence clips from audio pauses so section-by-section playback works immediately
      const pauseSegments = detectPauseSegments(decodedBuffer);
      const autoClips: SentenceClip[] = pauseSegments.map((seg, idx) => ({
        id: `auto-${idx}`,
        index: idx,
        frenchText: `Section #${idx + 1}`,
        englishTranslation: `Audio Segment #${idx + 1}`,
        startTime: Number(seg.startTime.toFixed(2)),
        endTime: Number(seg.endTime.toFixed(2)),
        showFrench: true,
        showEnglish: true,
      }));

      setSentences(autoClips);
      if (autoClips.length > 0) {
        setActiveSentenceIndex(0);
        setSliceStart(autoClips[0].startTime);
        setSliceEnd(autoClips[0].endTime);
        setCurrentTime(autoClips[0].startTime);
      } else {
        setActiveSentenceIndex(null);
        setSliceStart(0);
        setSliceEnd(Math.min(5, decodedBuffer.duration));
        setCurrentTime(0);
      }

      setCurrentTranscript("");
    } catch (err) {
      alert("Error decoding audio file. Please ensure it is a valid audio format.");
    }
  };

  // Translate sentence clips via Gemini API `/api/translate`
  const translateClipsWithAI = async (clipsToTranslate: SentenceClip[]) => {
    try {
      const frenchSentences = clipsToTranslate.map((c) => c.frenchText);
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentences: frenchSentences }),
      });
      const data = await res.json();

      if (data.translations && Array.isArray(data.translations)) {
        setSentences((prev) =>
          prev.map((clip, i) => {
            const aiData = data.translations[i];
            if (!aiData) return clip;
            return {
              ...clip,
              englishTranslation: aiData.english || clip.englishTranslation,
            };
          })
        );
      }
    } catch (err) {
      console.error("AI Translation Error:", err);
    }
  };

  // Auto-Detect Speech using Gemini STT API freely without transcript
  const handleAutoTranscribeSTT = async () => {
    if (!audioBuffer) return;
    setIsTranscribingSTT(true);
    try {
      const base64Wav = audioBufferToBase64Wav(audioBuffer);
      const res = await fetch("/api/transcribe-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64: base64Wav, mimeType: "audio/wav" }),
      });
      const data = await res.json();

      if (data.sentences && Array.isArray(data.sentences) && data.sentences.length > 0) {
        const clips: SentenceClip[] = data.sentences.map((s: any, idx: number) => ({
          id: `stt-${idx}`,
          index: idx,
          frenchText: s.frenchText || `Phrase #${idx + 1}`,
          englishTranslation: s.englishTranslation || "",
          startTime: Number((s.startTime || idx * 4).toFixed(2)),
          endTime: Number((s.endTime || (idx + 1) * 4).toFixed(2)),
          showFrench: true,
          showEnglish: true,
        }));

        setSentences(clips);
        setCurrentTranscript(clips.map((c) => c.frenchText).join("\n"));
        if (clips.length > 0) {
          handleSelectSentence(0, false);
        }
      } else {
        handleAutoAlignSentences();
      }
    } catch (err) {
      console.error("STT Error:", err);
      handleAutoAlignSentences();
    } finally {
      setIsTranscribingSTT(false);
    }
  };

  // Select a specific sentence card to practice
  const handleSelectSentence = (idx: number, autoPlay = true) => {
    if (idx < 0 || idx >= sentences.length) return;
    const clip = sentences[idx];
    setActiveSentenceIndex(idx);
    setSliceStart(clip.startTime);
    setSliceEnd(clip.endTime);
    setCurrentTime(clip.startTime);

    if (autoPlay) {
      playAudioRange(clip.startTime, clip.endTime);
    }
  };

  const handlePrevSentence = () => {
    if (sentences.length === 0) return;
    if (activeSentenceIndex === null) {
      handleSelectSentence(0, isPlaying);
    } else if (activeSentenceIndex > 0) {
      handleSelectSentence(activeSentenceIndex - 1, isPlaying);
    }
  };

  const handleNextSentence = () => {
    if (sentences.length === 0) return;
    if (activeSentenceIndex === null) {
      handleSelectSentence(0, isPlaying);
    } else if (activeSentenceIndex < sentences.length - 1) {
      handleSelectSentence(activeSentenceIndex + 1, isPlaying);
    }
  };

  // Auto-Align Sentences with Audio Pauses
  const handleAutoAlignSentences = () => {
    if (!audioBuffer) return;

    const pauseSegments = detectPauseSegments(audioBuffer);
    const rawLines = currentTranscript
      .split(/\n+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    // If transcript has specific sentences, limit alignment to those sentences
    const itemsCount = rawLines.length > 0 ? rawLines.length : pauseSegments.length;

    const aligned: SentenceClip[] = Array.from({ length: itemsCount }).map((_, idx) => {
      let startTime = 0;
      let endTime = 0;

      if (idx < pauseSegments.length) {
        startTime = Number(pauseSegments[idx].startTime.toFixed(2));
        endTime = Number(pauseSegments[idx].endTime.toFixed(2));
      } else {
        const prevEnd = idx > 0 ? pauseSegments[pauseSegments.length - 1]?.endTime || 0 : 0;
        startTime = Number((prevEnd + 0.3).toFixed(2));
        endTime = Number(Math.min(duration, startTime + 3.5).toFixed(2));
      }

      return {
        id: `aligned-${idx}`,
        index: idx,
        frenchText: rawLines[idx] || sentences[idx]?.frenchText || `Phrase #${idx + 1}`,
        englishTranslation: sentences[idx]?.englishTranslation || "Translating...",
        startTime,
        endTime,
        showFrench: true,
        showEnglish: true,
      };
    });

    setSentences(aligned);
    if (aligned.length > 0) {
      handleSelectSentence(0, false);
      translateClipsWithAI(aligned);
    }
  };

  const handleAutoParseTranscriptAI = async (rawText: string): Promise<string[]> => {
    try {
      const res = await fetch("/api/parse-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText }),
      });
      const data = await res.json();
      return data.sentences || [];
    } catch (err) {
      return rawText.split(/\n+/).filter((s) => s.trim().length > 0);
    }
  };

  const handleUpdateTranscript = async (rawText: string, parsedSentences: string[]) => {
    setCurrentTranscript(rawText);

    if (parsedSentences.length === 0) return;

    let newClips: SentenceClip[] = [];

    // IF USER HAS EXISTING CLIPS (e.g., after deleting unwanted sections or auto-detecting/fine-tuning clips)
    if (sentences.length > 0) {
      newClips = parsedSentences.map((textLine, idx) => {
        if (idx < sentences.length) {
          // Preserve existing/fine-tuned clip bounds & ID!
          return {
            ...sentences[idx],
            index: idx,
            frenchText: textLine,
            englishTranslation: "Translating...",
          };
        } else {
          // If transcript has extra lines beyond existing clips, append after last clip
          const lastClip = sentences[sentences.length - 1];
          const startTime = Number((lastClip ? lastClip.endTime + 0.3 : 0).toFixed(2));
          const endTime = Number(Math.min(duration || 999, startTime + 3.5).toFixed(2));
          return {
            id: `parsed-extra-${idx}`,
            index: idx,
            frenchText: textLine,
            englishTranslation: "Translating...",
            startTime,
            endTime,
            showFrench: true,
            showEnglish: true,
          };
        }
      });
    } else if (audioBuffer) {
      // IF NO CLIPS EXIST YET: perform AI alignment with the audio
      try {
        const base64Wav = audioBufferToBase64Wav(audioBuffer);
        const res = await fetch("/api/align-transcript", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audioBase64: base64Wav,
            mimeType: "audio/wav",
            sentences: parsedSentences,
            rawTranscript: rawText,
          }),
        });

        const data = await res.json();
        if (data.alignedSentences && Array.isArray(data.alignedSentences) && data.alignedSentences.length > 0) {
          newClips = data.alignedSentences.map((s: any, idx: number) => ({
            id: `aligned-ai-${idx}`,
            index: idx,
            frenchText: s.frenchText || parsedSentences[idx] || `Phrase #${idx + 1}`,
            englishTranslation: s.englishTranslation || "Translating...",
            startTime: Number(Math.max(0, s.startTime || 0).toFixed(2)),
            endTime: Number(Math.min(duration || 999, s.endTime || ((s.startTime || 0) + 4)).toFixed(2)),
            showFrench: true,
            showEnglish: true,
          }));
        }
      } catch (err) {
        console.warn("AI Audio Alignment failed, using smart local pause alignment fallback:", err);
      }

      // Fallback: Smart local pause segment alignment if AI alignment failed or returned empty
      if (newClips.length === 0) {
        const pauseSegments = detectPauseSegments(audioBuffer);

        newClips = parsedSentences.map((textLine, idx) => {
          let startTime = 0;
          let endTime = 0;

          if (idx < pauseSegments.length) {
            // Align each transcript line directly with detected audio speech burst
            startTime = Number(pauseSegments[idx].startTime.toFixed(2));
            endTime = Number(pauseSegments[idx].endTime.toFixed(2));
          } else {
            // If more lines than detected pause segments, assign standard ~3.5s per line sequentially
            const prevEnd = idx > 0 ? (pauseSegments[pauseSegments.length - 1]?.endTime || 0) : 0;
            startTime = Number((prevEnd + 0.3).toFixed(2));
            endTime = Number(Math.min(duration, startTime + 3.5).toFixed(2));
          }

          return {
            id: `parsed-${idx}`,
            index: idx,
            frenchText: textLine,
            englishTranslation: "Translating...",
            startTime,
            endTime,
            showFrench: true,
            showEnglish: true,
          };
        });
      }
    } else {
      // No audio loaded: Assign standard 4s blocks per sentence
      const segDuration = 4;
      newClips = parsedSentences.map((textLine, idx) => ({
        id: `parsed-${idx}`,
        index: idx,
        frenchText: textLine,
        englishTranslation: "Translating...",
        startTime: Number((idx * segDuration).toFixed(2)),
        endTime: Number(((idx + 1) * segDuration).toFixed(2)),
        showFrench: true,
        showEnglish: true,
      }));
    }

    setSentences(newClips);
    if (newClips.length > 0) {
      handleSelectSentence(0, false);
      translateClipsWithAI(newClips);
    }
  };

  // Toggles
  const handleToggleFrench = (idx: number) => {
    setSentences((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, showFrench: !c.showFrench } : c))
    );
  };

  const handleToggleEnglish = (idx: number) => {
    setSentences((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, showEnglish: !c.showEnglish } : c))
    );
  };

  const handleToggleAllFrench = (show: boolean) => {
    setSentences((prev) => prev.map((c) => ({ ...c, showFrench: show })));
  };

  const handleToggleAllEnglish = (show: boolean) => {
    setSentences((prev) => prev.map((c) => ({ ...c, showEnglish: show })));
  };

  const handleUpdateSentenceBounds = (idx: number, start: number, end: number) => {
    setSentences((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, startTime: start, endTime: end } : c))
    );
    if (activeSentenceIndex === idx) {
      setSliceStart(start);
      setSliceEnd(end);
    }
  };

  const handleAddSentence = () => {
    const lastClip = sentences[sentences.length - 1];
    const newStart = lastClip ? lastClip.endTime : 0;
    const newEnd = Math.min(duration, newStart + 5);

    const newClip: SentenceClip = {
      id: `manual-${Date.now()}`,
      index: sentences.length,
      frenchText: "Nouvelle phrase en français...",
      englishTranslation: "New French sentence...",
      startTime: Number(newStart.toFixed(2)),
      endTime: Number(newEnd.toFixed(2)),
      showFrench: true,
      showEnglish: true,
    };

    setSentences((prev) => [...prev, newClip]);
  };

  const handleDeleteSentence = (idx: number) => {
    setSentences((prev) => {
      const filtered = prev.filter((_, i) => i !== idx).map((clip, newIdx) => ({
        ...clip,
        index: newIdx,
      }));

      if (activeSentenceIndex === idx) {
        if (filtered.length === 0) {
          setActiveSentenceIndex(null);
        } else {
          const nextIdx = Math.min(idx, filtered.length - 1);
          setActiveSentenceIndex(nextIdx);
          setSliceStart(filtered[nextIdx].startTime);
          setSliceEnd(filtered[nextIdx].endTime);
        }
      } else if (activeSentenceIndex !== null && activeSentenceIndex > idx) {
        setActiveSentenceIndex(activeSentenceIndex - 1);
      }

      return filtered;
    });
  };

  return (
    <div className="h-screen max-h-screen w-screen overflow-hidden bg-[#0A0A0B] text-[#E0E0E0] font-sans antialiased selection:bg-[#D4AF37] selection:text-black flex flex-col">
      {/* Top Navigation Bar with LinguistWave + Upload Audio Button on the right */}
      <header className="w-full bg-[#0F0F11] border-b border-white/10 shrink-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#D4AF37] rounded flex items-center justify-center text-black font-bold text-xs tracking-tight shadow-md">
              LW
            </div>
            <h1 className="text-xl font-medium tracking-tight text-white">
              Linguist<span className="font-light italic text-[#D4AF37]">Wave</span>
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/50 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="max-w-[200px] truncate" title={currentAudioName}>
                {currentAudioName}
              </span>
            </div>

            {/* SINGLE UPLOAD AUDIO BUTTON ON THE RIGHT */}
            <label className="flex items-center gap-2 px-3.5 py-1.5 bg-[#D4AF37] hover:bg-[#e2c154] text-black text-xs font-bold uppercase tracking-wider rounded-md cursor-pointer transition-colors shadow-md">
              <UploadCloud className="w-4 h-4 text-black" />
              <span>Upload Audio</span>
              <input
                type="file"
                accept="audio/mp3,audio/wav,audio/m4a,audio/ogg,audio/webm"
                onChange={(e) => e.target.files?.[0] && handleAudioFileUpload(e.target.files[0])}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </header>

      {/* Main Single-View Workspace Container - Non-scrollable viewport fit */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-3 flex-1 flex flex-col min-h-0 space-y-3 overflow-hidden">
        {/* Waveform Slicer Visualizer */}
        <div className="shrink-0">
          <WaveformDisplay
            waveformPeaks={waveformPeaks}
            duration={duration}
            currentTime={currentTime}
            sliceStart={sliceStart}
            sliceEnd={sliceEnd}
            isPlaying={isPlaying}
            onSliceChange={handleSliceChange}
            onSeek={handleSeek}
            activeSentenceIndex={activeSentenceIndex ?? undefined}
          />
        </div>

        {/* Audio Control Bar */}
        <div className="shrink-0">
          <AudioControlBar
            isPlaying={isPlaying}
            isLooping={isLooping}
            playbackRate={playbackRate}
            volume={volume}
            onPlayPause={handlePlayPause}
            onStop={stopAudio}
            onToggleLoop={() => setIsLooping(!isLooping)}
            onChangeSpeed={setPlaybackRate}
            onChangeVolume={setVolume}
            onAutoSegment={handleAutoAlignSentences}
            onPrevSentence={handlePrevSentence}
            onNextSentence={handleNextSentence}
            hasAudio={!!audioBuffer}
          />
        </div>

        {/* Main Grid: Sentences Practice Column & Control Column */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0 overflow-hidden">
          {/* Left Column: Interactive Sentence Practice List */}
          <div className="lg:col-span-8 flex flex-col min-h-0 overflow-hidden">
            <SentenceList
              sentences={sentences}
              activeSentenceIndex={activeSentenceIndex}
              isPlaying={isPlaying}
              isLooping={isLooping}
              onSelectSentence={handleSelectSentence}
              onToggleFrench={handleToggleFrench}
              onToggleEnglish={handleToggleEnglish}
              onToggleAllFrench={handleToggleAllFrench}
              onToggleAllEnglish={handleToggleAllEnglish}
              onUpdateSentenceBounds={handleUpdateSentenceBounds}
              onAddSentence={handleAddSentence}
              onDeleteSentence={handleDeleteSentence}
            />
          </div>

          {/* Right Column: Loop Mode Status & Transcript / STT Uploader */}
          <div className="lg:col-span-4 flex flex-col min-h-0 space-y-3 overflow-hidden">
            {/* Playback Loop Mode Card */}
            <div className="bg-[#141417] border border-white/5 p-3.5 rounded-xl space-y-2 shrink-0">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest">
                <span className="text-[#D4AF37]">Loop Practice</span>
                <span className="text-white/40">{isLooping ? "Active" : "Paused"}</span>
              </div>
              <button
                onClick={() => setIsLooping(!isLooping)}
                className={`w-full py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-colors ${
                  isLooping
                    ? "bg-[#D4AF37] text-black hover:bg-[#e2c154]"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {isLooping ? "Looping Enabled" : "Enable Looping"}
              </button>
            </div>

            {/* Transcript Uploader / STT Auto-Detect */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <TranscriptUploader
                currentTranscript={currentTranscript}
                onUpdateTranscript={handleUpdateTranscript}
                onAutoParseAI={handleAutoParseTranscriptAI}
                onAutoTranscribeSTT={handleAutoTranscribeSTT}
                isTranscribingSTT={isTranscribingSTT}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

