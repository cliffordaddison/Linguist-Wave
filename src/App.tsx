import React, { useState, useEffect, useRef, useCallback } from "react";
import { SentenceClip } from "./types";
import {
  decodeAudioFile,
  extractWaveformPeaks,
  detectPauseSegments,
  audioBufferToBase64Wav,
  sliceAudioBuffer,
} from "./utils/audioUtils";
import { splitFrenchSentences, mergeContinuationClips } from "./utils/frenchSegments";
import { WaveformDisplay } from "./components/WaveformDisplay";
import { AudioControlBar } from "./components/AudioControlBar";
import { SentenceList } from "./components/SentenceList";
import { TranscriptUploader } from "./components/TranscriptUploader";
import { UploadCloud, Cpu, Loader2, CheckCircle2 } from "lucide-react";

const EMPTY_ENGLISH = "—";
const AI_TRANSLATE_STORAGE_KEY = "lw-ai-translate";

export default function App() {
  // Audio state
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
  const [duration, setDuration] = useState<number>(22);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(true); // default loop enabled
  const [isPlayingAll, setIsPlayingAll] = useState<boolean>(false);
  const [aiTranslateEnabled, setAiTranslateEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(AI_TRANSLATE_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
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

  // Pitch-preserving HTMLAudioElement transport (keeps AudioBuffer for analysis only)
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const durationRef = useRef<number>(duration);
  const playbackRateRef = useRef<number>(playbackRate);
  const volumeRef = useRef<number>(volume);
  const sliceRangeRef = useRef<{ start: number; end: number }>({ start: 0.5, end: 4.8 });
  const isPlayingRef = useRef<boolean>(false);
  const isPlayingAllRef = useRef<boolean>(false);
  const sentencesRef = useRef<SentenceClip[]>(sentences);
  const activeSentenceIndexRef = useRef<number | null>(activeSentenceIndex);
  const playAllNavigatingRef = useRef<boolean>(false);
  const advancePlayAllRef = useRef<() => void>(() => {});
  const aiTranslateEnabledRef = useRef<boolean>(aiTranslateEnabled);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const documentHiddenRef = useRef<boolean>(typeof document !== "undefined" ? document.hidden : false);

  const isLoopingRef = useRef<boolean>(isLooping);
  useEffect(() => {
    isLoopingRef.current = isLooping;
  }, [isLooping]);

  useEffect(() => {
    isPlayingAllRef.current = isPlayingAll;
  }, [isPlayingAll]);

  useEffect(() => {
    sentencesRef.current = sentences;
  }, [sentences]);

  useEffect(() => {
    activeSentenceIndexRef.current = activeSentenceIndex;
  }, [activeSentenceIndex]);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    playbackRateRef.current = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    aiTranslateEnabledRef.current = aiTranslateEnabled;
  }, [aiTranslateEnabled]);

  const clearPlayAll = useCallback(() => {
    isPlayingAllRef.current = false;
    setIsPlayingAll(false);
  }, []);

  const stopAudio = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    const el = audioElRef.current;
    if (el && !el.paused) {
      el.pause();
    }
    isPlayingRef.current = false;
    setIsPlaying(false);
    clearPlayAll();
  }, [clearPlayAll]);

  const playAudioRange = useCallback(
    (startSec: number, endSec: number) => {
      const el = audioElRef.current;
      if (!el || !el.src) return;

      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }

      const mediaDuration =
        Number.isFinite(el.duration) && el.duration > 0
          ? el.duration
          : durationRef.current || Number.POSITIVE_INFINITY;
      const clampedStart = Math.max(0, Math.min(startSec, mediaDuration));
      const clampedEnd = Math.max(clampedStart + 0.05, Math.min(endSec, mediaDuration));
      sliceRangeRef.current = { start: clampedStart, end: clampedEnd };

      el.playbackRate = playbackRateRef.current;
      el.volume = volumeRef.current;

      const beginMonitor = () => {
        const updateLoop = () => {
          if (!isPlayingRef.current || !audioElRef.current) return;

          const currentPos = audioElRef.current.currentTime;
          setCurrentTime(currentPos);

          if (currentPos >= sliceRangeRef.current.end - 0.02) {
            // Play All: advance to next section (ignores Loop)
            if (isPlayingAllRef.current) {
              advancePlayAllRef.current();
              return;
            }
            // Screen off / background: continue to next segments even if Loop is on
            const hidden = documentHiddenRef.current;
            const clips = sentencesRef.current;
            const currentIdx = activeSentenceIndexRef.current ?? 0;
            if (hidden && clips.length > 1 && currentIdx < clips.length - 1) {
              advancePlayAllRef.current();
              return;
            }
            if (isLoopingRef.current && !hidden) {
              const audio = audioElRef.current;
              audio.currentTime = sliceRangeRef.current.start;
              setCurrentTime(sliceRangeRef.current.start);
              if (audio.paused) {
                audio.play().catch(() => {
                  stopAudio();
                });
              }
              animFrameRef.current = requestAnimationFrame(updateLoop);
              return;
            }
            stopAudio();
            setCurrentTime(sliceRangeRef.current.end);
            return;
          }

          animFrameRef.current = requestAnimationFrame(updateLoop);
        };
        animFrameRef.current = requestAnimationFrame(updateLoop);
      };

      const startPlayback = () => {
        el.currentTime = clampedStart;
        setCurrentTime(clampedStart);
        isPlayingRef.current = true;
        setIsPlaying(true);
        el.play()
          .then(() => beginMonitor())
          .catch(() => {
            isPlayingRef.current = false;
            setIsPlaying(false);
            clearPlayAll();
          });
      };

      if (el.readyState >= 1) {
        startPlayback();
      } else {
        el.addEventListener("loadedmetadata", startPlayback, { once: true });
      }
    },
    [stopAudio, clearPlayAll]
  );

  const advancePlayAll = useCallback(() => {
    const clips = sentencesRef.current;
    const current = activeSentenceIndexRef.current ?? 0;
    const next = current + 1;

    if (next < clips.length) {
      const clip = clips[next];
      playAllNavigatingRef.current = true;
      activeSentenceIndexRef.current = next;
      setActiveSentenceIndex(next);
      setSliceStart(clip.startTime);
      setSliceEnd(clip.endTime);
      playAudioRange(clip.startTime, clip.endTime);
      playAllNavigatingRef.current = false;
      return;
    }

    // Finished last section — check if Loop is enabled to start from beginning
    if (isLoopingRef.current && clips.length > 0) {
      const firstClip = clips[0];
      playAllNavigatingRef.current = true;
      activeSentenceIndexRef.current = 0;
      setActiveSentenceIndex(0);
      setSliceStart(firstClip.startTime);
      setSliceEnd(firstClip.endTime);
      playAudioRange(firstClip.startTime, firstClip.endTime);
      playAllNavigatingRef.current = false;
      return;
    }

    // Finished last section without Loop — stop completely
    const lastEnd = clips.length > 0 ? clips[clips.length - 1].endTime : sliceRangeRef.current.end;
    stopAudio();
    setCurrentTime(lastEnd);
  }, [playAudioRange, stopAudio]);

  useEffect(() => {
    advancePlayAllRef.current = advancePlayAll;
  }, [advancePlayAll]);

  // Create persistent audio element; revoke object URLs on unmount
  useEffect(() => {
    const el = new Audio();
    el.preload = "auto";
    audioElRef.current = el;
    return () => {
      el.pause();
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      audioElRef.current = null;
    };
  }, []);

  // Keep screen awake while using the app
  useEffect(() => {
    const releaseWakeLock = async () => {
      try {
        await wakeLockRef.current?.release();
      } catch {
        /* ignore */
      }
      wakeLockRef.current = null;
    };

    const requestWakeLock = async () => {
      if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
      try {
        if (!wakeLockRef.current) {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
          wakeLockRef.current.addEventListener("release", () => {
            wakeLockRef.current = null;
          });
        }
      } catch {
        wakeLockRef.current = null;
      }
    };

    requestWakeLock();

    const onVisibility = () => {
      documentHiddenRef.current = document.hidden;
      if (!document.hidden) {
        requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      releaseWakeLock();
    };
  }, []);

  // Media Session so mobile OS can keep the audio session alive
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;

    const title =
      activeSentenceIndex !== null && sentences[activeSentenceIndex]
        ? `Clip ${activeSentenceIndex + 1} · ${sentences[activeSentenceIndex].frenchText.slice(0, 60)}`
        : currentAudioName || "Linguist Wave";

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist: "Linguist Wave",
        album: currentAudioName || "French practice",
      });
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    } catch {
      /* ignore unsupported metadata */
    }

    try {
      navigator.mediaSession.setActionHandler("play", () => {
        if (!isPlayingRef.current) {
          const clips = sentencesRef.current;
          const idx = activeSentenceIndexRef.current;
          if (idx !== null && clips[idx]) {
            playAudioRange(clips[idx].startTime, clips[idx].endTime);
          } else {
            playAudioRange(sliceRangeRef.current.start, sliceRangeRef.current.end);
          }
        }
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        stopAudio();
      });
      navigator.mediaSession.setActionHandler("nexttrack", () => {
        const clips = sentencesRef.current;
        const idx = activeSentenceIndexRef.current;
        if (!clips.length) return;
        const next = idx === null ? 0 : Math.min(idx + 1, clips.length - 1);
        const clip = clips[next];
        if (!clip) return;
        playAllNavigatingRef.current = true;
        activeSentenceIndexRef.current = next;
        setActiveSentenceIndex(next);
        setSliceStart(clip.startTime);
        setSliceEnd(clip.endTime);
        if (isPlayingRef.current) {
          playAudioRange(clip.startTime, clip.endTime);
        }
        playAllNavigatingRef.current = false;
      });
      navigator.mediaSession.setActionHandler("previoustrack", () => {
        const clips = sentencesRef.current;
        const idx = activeSentenceIndexRef.current;
        if (!clips.length) return;
        const prev = idx === null ? 0 : Math.max(idx - 1, 0);
        const clip = clips[prev];
        if (!clip) return;
        playAllNavigatingRef.current = true;
        activeSentenceIndexRef.current = prev;
        setActiveSentenceIndex(prev);
        setSliceStart(clip.startTime);
        setSliceEnd(clip.endTime);
        if (isPlayingRef.current) {
          playAudioRange(clip.startTime, clip.endTime);
        }
        playAllNavigatingRef.current = false;
      });
    } catch {
      /* ignore unsupported handlers */
    }
  }, [isPlaying, currentAudioName, activeSentenceIndex, sentences, playAudioRange, stopAudio]);

  const startPlayAll = useCallback(() => {
    if (!audioBuffer || sentencesRef.current.length === 0) return;

    const clip = sentencesRef.current[0];
    playAllNavigatingRef.current = true;
    isPlayingAllRef.current = true;
    setIsPlayingAll(true);
    activeSentenceIndexRef.current = 0;
    setActiveSentenceIndex(0);
    setSliceStart(clip.startTime);
    setSliceEnd(clip.endTime);
    playAudioRange(clip.startTime, clip.endTime);
    playAllNavigatingRef.current = false;
  }, [audioBuffer, playAudioRange]);

  const handleChangeSpeed = (speed: number) => {
    playbackRateRef.current = speed;
    setPlaybackRate(speed);
    if (audioElRef.current) {
      audioElRef.current.playbackRate = speed;
    }
  };

  const handleChangeVolume = (vol: number) => {
    volumeRef.current = vol;
    setVolume(vol);
    if (audioElRef.current) {
      audioElRef.current.volume = vol;
    }
  };

  // Handle Play/Pause
  const handlePlayPause = () => {
    if (isPlaying) {
      stopAudio();
    } else {
      clearPlayAll();
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
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      const objectUrl = URL.createObjectURL(file);
      objectUrlRef.current = objectUrl;
      const el = audioElRef.current;
      if (el) {
        el.src = objectUrl;
        el.load();
        el.playbackRate = playbackRateRef.current;
        el.volume = volumeRef.current;
      }

      const decodedBuffer = await decodeAudioFile(file);
      setAudioBuffer(decodedBuffer);
      setDuration(decodedBuffer.duration);
      setWaveformPeaks(extractWaveformPeaks(decodedBuffer, 800));
      setCurrentAudioName(file.name);

      // Segmentation based strictly on local long audio pauses (100% free, no Gemini dependency)
      handleAutoAlignSentences(decodedBuffer);
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

  const maybeTranslateClips = (clipsToTranslate: SentenceClip[]) => {
    if (aiTranslateEnabledRef.current && clipsToTranslate.length > 0) {
      translateClipsWithAI(clipsToTranslate);
    }
  };

  const handleToggleAiTranslate = (enabled: boolean) => {
    aiTranslateEnabledRef.current = enabled;
    setAiTranslateEnabled(enabled);
    try {
      localStorage.setItem(AI_TRANSLATE_STORAGE_KEY, enabled ? "1" : "0");
    } catch {
      /* ignore quota / private mode */
    }
    if (enabled && sentencesRef.current.length > 0) {
      translateClipsWithAI(sentencesRef.current);
    }
  };

  const englishPlaceholder = () => (aiTranslateEnabledRef.current ? "Translating..." : EMPTY_ENGLISH);

  // Auto-Detect Speech using Gemini STT API directly on the uploaded audio buffer
  const handleAutoTranscribeSTT = async (bufferToTranscribe?: AudioBuffer) => {
    const targetBuffer = bufferToTranscribe || audioBuffer;
    if (!targetBuffer) return;
    setIsTranscribingSTT(true);
    try {
      const base64Wav = audioBufferToBase64Wav(targetBuffer);
      const res = await fetch("/api/transcribe-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64: base64Wav, mimeType: "audio/wav" }),
      });
      const data = await res.json();

      if (data.sentences && Array.isArray(data.sentences) && data.sentences.length > 0) {
        const rawClips: SentenceClip[] = data.sentences.map((s: any, idx: number) => ({
          id: `stt-${idx}`,
          index: idx,
          frenchText: s.frenchText || `Phrase #${idx + 1}`,
          englishTranslation: aiTranslateEnabledRef.current ? (s.englishTranslation || "Translating...") : EMPTY_ENGLISH,
          startTime: Number((s.startTime || idx * 4).toFixed(2)),
          endTime: Number((s.endTime || (idx + 1) * 4).toFixed(2)),
          showFrench: true,
          showEnglish: true,
        }));
        const clips = mergeContinuationClips(rawClips);

        setSentences(clips);
        setCurrentTranscript(clips.map((c) => c.frenchText).join("\n"));
        if (clips.length > 0) {
          handleSelectSentence(0, false);
          maybeTranslateClips(clips);
        }
      } else {
        handleAutoAlignSentences(targetBuffer);
      }
    } catch (err) {
      console.error("STT Error:", err);
      handleAutoAlignSentences(targetBuffer);
    } finally {
      setIsTranscribingSTT(false);
    }
  };

  // Internal Background Audio STT (processes full audio in 1 single request to avoid rate limits)
  const [isInternalSTTTranscribing, setIsInternalSTTTranscribing] = useState<boolean>(false);
  const [sttProgressStatus, setSttProgressStatus] = useState<string>("");

  const handleRunInternalAudioSTT = async () => {
    if (!audioBuffer || sentences.length === 0) {
      alert("Please upload an audio file first.");
      return;
    }

    setIsInternalSTTTranscribing(true);
    setSttProgressStatus("Transcribing audio file...");

    try {
      const fullWavBase64 = audioBufferToBase64Wav(audioBuffer);

      const res = await fetch("/api/transcribe-full-audio-segments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64: fullWavBase64,
          mimeType: "audio/wav",
          targetCount: sentences.length,
        }),
      });

      if (res.status === 429) {
        alert("API rate limit reached. Please wait ~30 seconds before clicking Transcribe again.");
        return;
      }

      if (res.ok) {
        const data = await res.json();
        const transcripts: { frenchText: string; englishTranslation: string }[] = data.transcripts || [];

        if (transcripts.length > 0) {
          const updatedSentences = sentences.map((clip, idx) => {
            if (idx < transcripts.length) {
              return {
                ...clip,
                frenchText: transcripts[idx].frenchText || clip.frenchText,
                englishTranslation:
                  transcripts[idx].englishTranslation || clip.englishTranslation || EMPTY_ENGLISH,
              };
            }
            return clip;
          });

          setSentences(updatedSentences);

          const fullScript = transcripts
            .map((item) => item.frenchText)
            .filter(Boolean)
            .join("\n\n");
          if (fullScript) {
            setCurrentTranscript(fullScript);
          }
        }
      }
    } catch (err) {
      console.error("Internal Audio STT Error:", err);
    } finally {
      setIsInternalSTTTranscribing(false);
      setSttProgressStatus("");
    }
  };

  // Select a specific sentence card to practice
  const handleSelectSentence = (idx: number, autoPlay = true) => {
    if (idx < 0 || idx >= sentences.length) return;

    // Manual clip selection exits Play All mode
    if (!playAllNavigatingRef.current) {
      clearPlayAll();
    }

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
  const handleAutoAlignSentences = (bufferToUse?: AudioBuffer) => {
    const targetBuf = bufferToUse || audioBuffer;
    if (!targetBuf) return;

    const pauseSegments = detectPauseSegments(targetBuf);
    const localSentences = splitFrenchSentences(currentTranscript);
    const rawLines =
      localSentences.length > 0
        ? localSentences
        : currentTranscript
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
        englishTranslation: sentences[idx]?.englishTranslation || englishPlaceholder(),
        startTime,
        endTime,
        showFrench: true,
        showEnglish: true,
      };
    });

    const mergedAligned = mergeContinuationClips(aligned);
    setSentences(mergedAligned);
    if (mergedAligned.length > 0) {
      handleSelectSentence(0, false);
      maybeTranslateClips(mergedAligned);
    }
  };

  const handleAutoParseTranscriptAI = async (rawText: string): Promise<string[]> => {
    const local = splitFrenchSentences(rawText);
    if (local.length > 0) return local;

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

    // IF USER HAS EXISTING CLIPS (e.g., long-pause audio segments):
    if (sentences.length > 0) {
      // Map parsed French STT sentences into each respective segment clip
      newClips = sentences.map((clip, idx) => ({
        ...clip,
        frenchText: parsedSentences[idx] || clip.frenchText,
        englishTranslation:
          aiTranslateEnabledRef.current && idx < parsedSentences.length
            ? "Translating..."
            : clip.englishTranslation || EMPTY_ENGLISH,
      }));

      // Append extra sentences if parsed STT output exceeds initial segment count
      if (parsedSentences.length > sentences.length) {
        for (let idx = sentences.length; idx < parsedSentences.length; idx++) {
          const lastClip = newClips[newClips.length - 1];
          const startTime = Number((lastClip ? lastClip.endTime + 0.3 : 0).toFixed(2));
          const endTime = Number(Math.min(duration || 999, startTime + 3.5).toFixed(2));
          newClips.push({
            id: `parsed-extra-${idx}`,
            index: idx,
            frenchText: parsedSentences[idx],
            englishTranslation: englishPlaceholder(),
            startTime,
            endTime,
            showFrench: true,
            showEnglish: true,
          });
        }
      }
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
            englishTranslation: s.englishTranslation || englishPlaceholder(),
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
            englishTranslation: englishPlaceholder(),
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
        englishTranslation: englishPlaceholder(),
        startTime: Number((idx * segDuration).toFixed(2)),
        endTime: Number(((idx + 1) * segDuration).toFixed(2)),
        showFrench: true,
        showEnglish: true,
      }));
    }

    newClips = mergeContinuationClips(newClips);
    setSentences(newClips);
    if (newClips.length > 0) {
      handleSelectSentence(0, false);
      maybeTranslateClips(newClips);
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
      englishTranslation: EMPTY_ENGLISH,
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
    <div className="min-h-dvh h-dvh max-h-dvh w-full overflow-hidden bg-[#0A0A0B] text-[#E0E0E0] font-sans antialiased selection:bg-[#D4AF37] selection:text-black flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      {/* Top Navigation Bar with LinguistWave + Upload Audio Button on the right */}
      <header className="w-full bg-[#0F0F11] border-b border-white/10 shrink-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 shrink-0 bg-[#D4AF37] rounded flex items-center justify-center text-black font-bold text-xs tracking-tight shadow-md">
              LW
            </div>
            <h1 className="text-lg sm:text-xl font-medium tracking-tight text-white truncate">
              Linguist<span className="font-light italic text-[#D4AF37]">Wave</span>
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <div className="hidden sm:flex items-center gap-2 text-xs uppercase tracking-widest text-white/50 font-mono min-w-0">
              <span className="w-2 h-2 shrink-0 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="max-w-[140px] lg:max-w-[200px] truncate" title={currentAudioName}>
                {currentAudioName}
              </span>
            </div>

            {/* SINGLE UPLOAD AUDIO BUTTON ON THE RIGHT */}
            <label className="flex items-center gap-2 px-3 sm:px-3.5 py-2 sm:py-1.5 bg-[#D4AF37] hover:bg-[#e2c154] text-black text-xs font-bold uppercase tracking-wider rounded-md cursor-pointer transition-colors shadow-md shrink-0">
              <UploadCloud className="w-4 h-4 text-black" />
              <span className="sm:hidden">Upload</span>
              <span className="hidden sm:inline">Upload Audio</span>
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

      {/* Main workspace: scroll on phones/tablets, locked single viewport on lg+ */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-3 flex-1 flex flex-col min-h-0 space-y-3 overflow-y-auto lg:overflow-hidden overscroll-contain">
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
            isPlayingAll={isPlayingAll}
            playbackRate={playbackRate}
            volume={volume}
            onPlayPause={handlePlayPause}
            onStop={stopAudio}
            onToggleLoop={() => setIsLooping(!isLooping)}
            onPlayAll={startPlayAll}
            onChangeSpeed={handleChangeSpeed}
            onChangeVolume={handleChangeVolume}
            onAutoSegment={handleAutoAlignSentences}
            onPrevSentence={handlePrevSentence}
            onNextSentence={handleNextSentence}
            hasAudio={!!audioBuffer}
            hasClips={sentences.length > 0}
          />
        </div>

        {/* Main Grid: Sentences Practice Column & Control Column */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0 lg:overflow-hidden">
          {/* Left Column: Interactive Sentence Practice List */}
          <div className="lg:col-span-8 flex flex-col min-h-[280px] lg:min-h-0 overflow-hidden">
            <SentenceList
              sentences={sentences}
              activeSentenceIndex={activeSentenceIndex}
              isPlaying={isPlaying}
              isLooping={isLooping}
              aiTranslateEnabled={aiTranslateEnabled}
              onToggleAiTranslate={handleToggleAiTranslate}
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
          <div className="lg:col-span-4 flex flex-col min-h-[320px] lg:min-h-0 space-y-3 overflow-hidden">
            {/* Internal Background Audio STT Card */}
            <div className="bg-[#141417] border border-white/5 p-3.5 rounded-xl space-y-2 shrink-0">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest">
                <span className="text-[#D4AF37]">Audio STT Transcriber</span>
                <span className={isInternalSTTTranscribing ? "text-[#D4AF37] font-mono animate-pulse" : "text-white/40"}>
                  {isInternalSTTTranscribing ? `● ${sttProgressStatus}` : `${sentences.length} Segments`}
                </span>
              </div>
              <button
                onClick={handleRunInternalAudioSTT}
                disabled={isInternalSTTTranscribing || !audioBuffer}
                className={`w-full py-2.5 sm:py-2.5 rounded-md text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none ${
                  isInternalSTTTranscribing
                    ? "bg-[#D4AF37]/20 border border-[#D4AF37]/50 text-[#D4AF37]"
                    : "bg-[#D4AF37] hover:bg-[#e2c154] text-black shadow-md"
                }`}
                title="Process uploaded audio file in the background and assign transcribed French text to each long-pause segment card"
              >
                {isInternalSTTTranscribing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#D4AF37]" />
                    <span>Transcribing {sttProgressStatus}</span>
                  </>
                ) : (
                  <>
                    <Cpu className="w-4 h-4" />
                    <span>Transcribe Audio & Assign Sentences</span>
                  </>
                )}
              </button>
            </div>

            {/* Transcript Uploader / STT Auto-Detect */}
            <div className="flex-1 min-h-[260px] lg:min-h-0 flex flex-col overflow-hidden">
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

