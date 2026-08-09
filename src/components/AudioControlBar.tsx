import React from "react";
import {
  Play,
  Pause,
  Repeat,
  Volume2,
  VolumeX,
  FastForward,
  Wand2,
  Square,
  SkipBack,
  SkipForward,
  ListOrdered,
} from "lucide-react";

interface AudioControlBarProps {
  isPlaying: boolean;
  isLooping: boolean;
  isPlayingAll: boolean;
  playbackRate: number;
  volume: number;
  onPlayPause: () => void;
  onStop: () => void;
  onToggleLoop: () => void;
  onPlayAll: () => void;
  onChangeSpeed: (speed: number) => void;
  onChangeVolume: (vol: number) => void;
  onAutoSegment: () => void;
  onPrevSentence?: () => void;
  onNextSentence?: () => void;
  hasAudio: boolean;
  hasClips: boolean;
}

export const AudioControlBar: React.FC<AudioControlBarProps> = ({
  isPlaying,
  isLooping,
  isPlayingAll,
  playbackRate,
  volume,
  onPlayPause,
  onStop,
  onToggleLoop,
  onPlayAll,
  onChangeSpeed,
  onChangeVolume,
  onAutoSegment,
  onPrevSentence,
  onNextSentence,
  hasAudio,
  hasClips,
}) => {
  const speeds = [0.5, 0.75, 1.0, 1.25, 1.5];

  return (
    <div className="w-full bg-[#0F0F11] border border-white/10 rounded-xl p-3 sm:p-4 shadow-xl flex flex-wrap items-center justify-center sm:justify-between gap-3 sm:gap-4">
      {/* Left: Previous/Next & Play/Pause Controls */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {onPrevSentence && (
          <button
            type="button"
            onClick={onPrevSentence}
            disabled={!hasAudio}
            className="min-w-10 min-h-10 p-2.5 rounded-md bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-40 transition-colors flex items-center justify-center"
            title="Previous Sentence Clip"
          >
            <SkipBack className="w-4 h-4" />
          </button>
        )}

        {/* Big Center Play / Pause Button */}
        <button
          type="button"
          onClick={onPlayPause}
          disabled={!hasAudio}
          className={`flex items-center justify-center w-12 h-12 sm:w-11 sm:h-11 rounded-full font-bold transition-all shadow-lg transform hover:scale-105 ${
            isPlaying
              ? "bg-[#D4AF37] text-black shadow-[#D4AF37]/30"
              : "bg-white text-black hover:bg-[#D4AF37]"
          } disabled:opacity-50`}
          title={isPlaying ? "Pause Audio" : "Play Active Slice"}
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
        </button>

        {/* Stop Button */}
        <button
          type="button"
          onClick={onStop}
          disabled={!hasAudio}
          className="min-w-10 min-h-10 p-2.5 rounded-md bg-white/5 border border-white/10 text-white/60 hover:text-rose-400 hover:bg-white/10 disabled:opacity-40 transition-colors flex items-center justify-center"
          title="Stop & Reset Cursor"
        >
          <Square className="w-4 h-4 fill-current" />
        </button>

        {onNextSentence && (
          <button
            type="button"
            onClick={onNextSentence}
            disabled={!hasAudio}
            className="min-w-10 min-h-10 p-2.5 rounded-md bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-40 transition-colors flex items-center justify-center"
            title="Next Sentence Clip"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        )}

        {/* Continuous Loop Slice Toggle */}
        <button
          type="button"
          onClick={onToggleLoop}
          className={`flex items-center gap-2 min-h-10 px-3 py-2 rounded-md text-xs uppercase tracking-wider font-semibold border transition-all ${
            isLooping
              ? "bg-[#D4AF37] text-black border-[#D4AF37] font-bold"
              : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
          }`}
          title="Toggle seamless looping for selected slice"
        >
          <Repeat className={`w-3.5 h-3.5 ${isLooping ? "animate-spin-slow" : ""}`} />
          <span>{isLooping ? "Loop Active" : "Loop Off"}</span>
        </button>

        {/* Play All sections continuously */}
        <button
          type="button"
          onClick={onPlayAll}
          disabled={!hasAudio || !hasClips}
          className={`flex items-center gap-2 min-h-10 px-3 py-2 rounded-md text-xs uppercase tracking-wider font-semibold border transition-all disabled:opacity-40 ${
            isPlayingAll
              ? "bg-[#D4AF37] text-black border-[#D4AF37] font-bold"
              : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
          }`}
          title="Play every section once in order, then stop"
        >
          <ListOrdered className="w-3.5 h-3.5" />
          <span>{isPlayingAll ? "Playing All…" : "Play All"}</span>
        </button>
      </div>

      {/* Center: Playback Speed Selector */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 bg-[#0A0A0B] border border-white/10 p-1.5 rounded-md w-full sm:w-auto">
        <span className="text-[10px] text-white/40 uppercase tracking-widest font-medium px-2 flex items-center gap-1">
          <FastForward className="w-3 h-3" /> Speed:
        </span>
        {speeds.map((s) => (
          <button
            type="button"
            key={s}
            onClick={() => onChangeSpeed(s)}
            className={`min-h-10 sm:min-h-0 px-3 py-2 sm:px-2 sm:py-1 rounded text-xs font-mono transition-colors ${
              playbackRate === s
                ? "bg-[#D4AF37] text-black font-bold"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            {s}x
          </button>
        ))}
      </div>

      {/* Right: Volume Slider & Auto-Segment AI Assistant */}
      <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-center sm:justify-end">
        {/* Volume Control */}
        <div className="flex items-center gap-2 text-white/50">
          <button
            type="button"
            onClick={() => onChangeVolume(volume > 0 ? 0 : 0.8)}
            className="min-w-10 min-h-10 flex items-center justify-center hover:text-white transition-colors"
            title={volume > 0 ? "Mute" : "Unmute"}
          >
            {volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => onChangeVolume(parseFloat(e.target.value))}
            className="w-24 sm:w-20 accent-[#D4AF37] h-2 sm:h-1 bg-white/20 rounded-full appearance-none cursor-pointer"
          />
        </div>

        {/* Auto Pause Detect / Alignment Button */}
        <button
          type="button"
          onClick={onAutoSegment}
          disabled={!hasAudio}
          className="flex items-center gap-2 min-h-10 px-3.5 py-2 rounded-md bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 hover:bg-[#D4AF37]/20 font-bold text-xs uppercase tracking-widest disabled:opacity-40 transition-all"
          title="Detect pauses in audio and match with sentence transcript"
        >
          <Wand2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Auto-Align</span>
        </button>
      </div>
    </div>
  );
};
