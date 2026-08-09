import React, { useRef, useEffect, useState, useCallback } from "react";
import { formatTime } from "../utils/audioUtils";
import { MoveHorizontal, RotateCcw } from "lucide-react";

interface WaveformDisplayProps {
  waveformPeaks: number[];
  duration: number; // in seconds
  currentTime: number; // in seconds
  sliceStart: number; // in seconds
  sliceEnd: number; // in seconds
  isPlaying: boolean;
  onSliceChange: (start: number, end: number) => void;
  onSeek: (time: number) => void;
  activeSentenceIndex?: number;
}

export const WaveformDisplay: React.FC<WaveformDisplayProps> = ({
  waveformPeaks,
  duration,
  currentTime,
  sliceStart,
  sliceEnd,
  isPlaying,
  onSliceChange,
  onSeek,
  activeSentenceIndex,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const didDragRef = useRef(false);

  const [isDragging, setIsDragging] = useState<"left" | "right" | "center" | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [initialSlice, setInitialSlice] = useState({ start: sliceStart, end: sliceEnd });

  const safeDuration = duration > 0 ? duration : 30;

  // Render canvas waveform
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = "#141417";
    ctx.fillRect(0, 0, width, height);

    // Draw subtle grid lines / time rulers
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;

    const stepSecs = safeDuration > 60 ? 10 : safeDuration > 20 ? 5 : 2;
    for (let t = 0; t <= safeDuration; t += stepSecs) {
      const x = (t / safeDuration) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height - 24);
      ctx.stroke();

      // Time label
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.font = "10px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(formatTime(t), x, height - 8);
    }

    if (!waveformPeaks || waveformPeaks.length === 0) return;

    // Calculate pixel bounds for slice region
    const sliceLeftX = (sliceStart / safeDuration) * width;
    const sliceRightX = (sliceEnd / safeDuration) * width;

    // Draw dark translucent background for inactive region outside slice
    ctx.fillStyle = "rgba(10, 10, 11, 0.6)";
    ctx.fillRect(0, 0, sliceLeftX, height - 24);
    ctx.fillRect(sliceRightX, 0, width - sliceRightX, height - 24);

    // Render peak bars
    const numBars = waveformPeaks.length;
    const barWidth = width / numBars;
    const centerY = (height - 24) / 2;
    const maxBarHeight = (height - 36) / 2;

    for (let i = 0; i < numBars; i++) {
      const x = i * barWidth;
      const peak = waveformPeaks[i];
      const barH = Math.max(2, peak * maxBarHeight);

      const isInSlice = x >= sliceLeftX && x <= sliceRightX;

      if (isInSlice) {
        // Gold accent for active slice inside selection frame
        ctx.fillStyle = "#D4AF37";
        ctx.shadowColor = "rgba(212, 175, 55, 0.4)";
        ctx.shadowBlur = 6;
      } else {
        // Muted white/20 for unselected parts
        ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        ctx.shadowBlur = 0;
      }

      // Mirror waveform bars vertically around center axis
      ctx.fillRect(x, centerY - barH, Math.max(1, barWidth - 1), barH * 2);
    }

    ctx.shadowBlur = 0; // reset shadow

    // Draw Playhead Line
    const currentX = (currentTime / safeDuration) * width;
    ctx.strokeStyle = "#FFFFFF"; // Clean white playhead
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(currentX, 0);
    ctx.lineTo(currentX, height - 24);
    ctx.stroke();

    // Playhead head dot
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(currentX, 4, 4, 0, Math.PI * 2);
    ctx.fill();
  }, [waveformPeaks, safeDuration, sliceStart, sliceEnd, currentTime]);

  // Handle Resize & Canvas Scaling (height follows CSS: 110px mobile / 140px sm+)
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeObserver = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width));
      canvas.height = Math.max(1, Math.floor(rect.height));
      drawWaveform();
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [drawWaveform]);

  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  // Pointer Events: unified mouse + touch slice dragging
  const handlePointerDown = (e: React.PointerEvent, type: "left" | "right" | "center") => {
    e.stopPropagation();
    e.preventDefault();
    didDragRef.current = false;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore unsupported capture */
    }
    setIsDragging(type);
    setDragStartX(e.clientX);
    setInitialSlice({ start: sliceStart, end: sliceEnd });
  };

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isDragging || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const deltaX = e.clientX - dragStartX;
      if (Math.abs(deltaX) > 2) {
        didDragRef.current = true;
      }
      const deltaSecs = (deltaX / rect.width) * safeDuration;

      let newStart = initialSlice.start;
      let newEnd = initialSlice.end;
      const minDuration = 0.3; // minimum 300ms slice window

      if (isDragging === "left") {
        newStart = Math.max(0, Math.min(initialSlice.start + deltaSecs, initialSlice.end - minDuration));
      } else if (isDragging === "right") {
        newEnd = Math.min(safeDuration, Math.max(initialSlice.end + deltaSecs, initialSlice.start + minDuration));
      } else if (isDragging === "center") {
        const windowLen = initialSlice.end - initialSlice.start;
        newStart = Math.max(0, Math.min(safeDuration - windowLen, initialSlice.start + deltaSecs));
        newEnd = newStart + windowLen;
      }

      onSliceChange(Number(newStart.toFixed(2)), Number(newEnd.toFixed(2)));
    },
    [isDragging, dragStartX, initialSlice, safeDuration, onSliceChange]
  );

  const handlePointerUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(null);
    }
  }, [isDragging]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
    }
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [isDragging, handlePointerMove, handlePointerUp]);

  // Click waveform to seek (skip if we just finished a drag)
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging || didDragRef.current || !containerRef.current) {
      didDragRef.current = false;
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickedTime = (clickX / rect.width) * safeDuration;
    onSeek(Math.max(0, Math.min(safeDuration, clickedTime)));
  };

  // Percentages for HTML Yellow Slicer Box positioning
  const leftPct = (sliceStart / safeDuration) * 100;
  const rightPct = (sliceEnd / safeDuration) * 100;
  const widthPct = Math.max(0.5, rightPct - leftPct);

  return (
    <div className="w-full bg-[#141417] border border-white/5 rounded-xl p-4 sm:p-6 shadow-2xl relative select-none">
      {/* Top Header Bar with Timestamp & Controls */}
      <div className="flex flex-wrap items-center justify-between mb-3 text-xs sm:text-sm text-white/50 gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-[#D4AF37] bg-[#D4AF37]/10 px-2.5 py-0.5 rounded">
            Master Waveform
          </span>
          {activeSentenceIndex !== undefined && (
            <span className="bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30 px-2 py-0.5 rounded text-xs font-mono">
              Sentence #{activeSentenceIndex + 1}
            </span>
          )}
        </div>

        {/* Timestamp Readout */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 font-mono text-xs">
          <div className="bg-[#0A0A0B] border border-white/10 px-3 py-1 rounded-md text-white/70">
            Slice: <span className="text-[#D4AF37] font-bold">{formatTime(sliceStart, true)}</span> -{" "}
            <span className="text-[#D4AF37] font-bold">{formatTime(sliceEnd, true)}</span>{" "}
            <span className="text-white/40">({(sliceEnd - sliceStart).toFixed(1)}s)</span>
          </div>

          <div className="bg-[#0A0A0B] border border-white/10 px-3 py-1 rounded-md text-white/70">
            <span className="text-white font-bold">{formatTime(currentTime)}</span> /{" "}
            <span>{formatTime(safeDuration)}</span>
          </div>
        </div>
      </div>

      {/* Waveform Container */}
      <div
        ref={containerRef}
        onClick={handleCanvasClick}
        className={`relative w-full h-[110px] sm:h-[140px] rounded-lg overflow-hidden cursor-pointer bg-[#0A0A0B] border border-white/5 shadow-inner group ${
          isDragging ? "touch-none" : ""
        }`}
        style={isDragging ? { touchAction: "none" } : undefined}
      >
        {/* Canvas Waveform Render */}
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

        {/* OVERLAY: Gold Dynamic Slicer Frame & Drag Handles */}
        <div
          style={{
            left: `${leftPct}%`,
            width: `${widthPct}%`,
            touchAction: "none",
          }}
          className="absolute top-0 bottom-[24px] border-2 border-[#D4AF37] bg-[#D4AF37]/10 shadow-[0_0_15px_rgba(212,175,55,0.3)] rounded flex items-center justify-between z-10 transition-shadow hover:shadow-[0_0_20px_rgba(212,175,55,0.5)]"
        >
          {/* Draggable Center Body */}
          <div
            onPointerDown={(e) => handlePointerDown(e, "center")}
            className={`absolute inset-0 cursor-grab active:cursor-grabbing flex items-center justify-center transition-opacity ${
              isDragging === "center" ? "opacity-100" : "opacity-40 sm:opacity-0 sm:group-hover:opacity-100"
            }`}
            title="Drag to shift time slice"
            style={{ touchAction: "none" }}
          >
            <div className="bg-[#D4AF37] text-black px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase flex items-center gap-1 shadow pointer-events-none">
              <MoveHorizontal className="w-3 h-3" /> Move
            </div>
          </div>

          {/* Left Handle — wide invisible hit pad, thin visible bar */}
          <div
            onPointerDown={(e) => handlePointerDown(e, "left")}
            className="absolute -left-4 top-0 bottom-0 w-10 flex items-center justify-center cursor-ew-resize z-20"
            title="Drag left to adjust start time"
            style={{ touchAction: "none" }}
          >
            <div className="w-3.5 h-full bg-[#D4AF37] hover:bg-[#e2c154] rounded-l shadow-md flex items-center justify-center transition-colors">
              <div className="w-0.5 h-6 bg-black/60 rounded-full"></div>
            </div>
          </div>

          {/* Right Handle — wide invisible hit pad, thin visible bar */}
          <div
            onPointerDown={(e) => handlePointerDown(e, "right")}
            className="absolute -right-4 top-0 bottom-0 w-10 flex items-center justify-center cursor-ew-resize z-20"
            title="Drag right to adjust end time"
            style={{ touchAction: "none" }}
          >
            <div className="w-3.5 h-full bg-[#D4AF37] hover:bg-[#e2c154] rounded-r shadow-md flex items-center justify-center transition-colors">
              <div className="w-0.5 h-6 bg-black/60 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Slicer Quick Adjustment Nudge Controls */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-white/50">
        <div className="flex items-center gap-1.5">
          <span className="text-white/40 font-medium mr-1">Fine-Tune Start:</span>
          <button
            onClick={() => onSliceChange(Math.max(0, sliceStart - 0.2), sliceEnd)}
            className="min-h-10 sm:min-h-0 px-3 py-2 sm:px-2 sm:py-1 bg-[#0A0A0B] border border-white/10 hover:border-[#D4AF37]/50 hover:text-[#D4AF37] rounded text-white/80 transition-colors font-mono"
          >
            -0.2s
          </button>
          <button
            onClick={() => onSliceChange(Math.min(sliceEnd - 0.3, sliceStart + 0.2), sliceEnd)}
            className="min-h-10 sm:min-h-0 px-3 py-2 sm:px-2 sm:py-1 bg-[#0A0A0B] border border-white/10 hover:border-[#D4AF37]/50 hover:text-[#D4AF37] rounded text-white/80 transition-colors font-mono"
          >
            +0.2s
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-white/40 font-medium mr-1">Fine-Tune End:</span>
          <button
            onClick={() => onSliceChange(sliceStart, Math.max(sliceStart + 0.3, sliceEnd - 0.2))}
            className="min-h-10 sm:min-h-0 px-3 py-2 sm:px-2 sm:py-1 bg-[#0A0A0B] border border-white/10 hover:border-[#D4AF37]/50 hover:text-[#D4AF37] rounded text-white/80 transition-colors font-mono"
          >
            -0.2s
          </button>
          <button
            onClick={() => onSliceChange(sliceStart, Math.min(safeDuration, sliceEnd + 0.2))}
            className="min-h-10 sm:min-h-0 px-3 py-2 sm:px-2 sm:py-1 bg-[#0A0A0B] border border-white/10 hover:border-[#D4AF37]/50 hover:text-[#D4AF37] rounded text-white/80 transition-colors font-mono"
          >
            +0.2s
          </button>
        </div>

        <button
          onClick={() => onSliceChange(0, safeDuration)}
          className="flex items-center gap-1 min-h-10 sm:min-h-0 px-3 py-2 sm:px-2.5 sm:py-1 bg-[#0A0A0B] border border-white/10 hover:bg-white/5 rounded text-white/60 hover:text-white transition-colors"
        >
          <RotateCcw className="w-3 h-3" /> Reset Selection
        </button>
      </div>
    </div>
  );
};
