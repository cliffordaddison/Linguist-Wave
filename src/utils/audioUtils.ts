/**
 * Helper utilities for Web Audio API decoding, waveform peak extraction,
 * silence detection, and synthetic speech synthesis.
 */

// Global AudioContext singleton
let sharedAudioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    sharedAudioCtx = new AudioCtxClass();
  }
  if (sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume();
  }
  return sharedAudioCtx;
}

/**
 * Decode uploaded audio file (MP3, WAV, M4A, WebM) into AudioBuffer
 */
export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  const arrayBuffer = await file.arrayBuffer();
  return await ctx.decodeAudioData(arrayBuffer);
}

/**
 * Extract peak amplitudes from AudioBuffer for canvas waveform rendering
 */
export function extractWaveformPeaks(buffer: AudioBuffer, samplesCount: number = 800): number[] {
  const rawData = buffer.getChannelData(0); // Left channel
  const totalSamples = rawData.length;
  const blockSize = Math.floor(totalSamples / samplesCount);
  const peaks: number[] = new Array(samplesCount);

  for (let i = 0; i < samplesCount; i++) {
    const start = i * blockSize;
    let max = 0;
    for (let j = 0; j < blockSize; j++) {
      const absVal = Math.abs(rawData[start + j] || 0);
      if (absVal > max) {
        max = absVal;
      }
    }
    peaks[i] = max;
  }

  // Normalize peaks between 0 and 1
  const maxPeak = Math.max(...peaks, 0.001);
  return peaks.map((p) => p / maxPeak);
}

/**
 * Automatic Pause/Silence Detection
 * Scans channel data for quiet sections (< threshold for > minSilenceDuration)
 * Returns timestamp slice segments [ { startTime, endTime } ]
 */
export function detectPauseSegments(
  buffer: AudioBuffer,
  minSilenceSecs = 0.5,
  silenceThreshold = 0.03
): { startTime: number; endTime: number }[] {
  const raw = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const frameSize = Math.floor(sampleRate * 0.02); // 20ms frames
  const totalFrames = Math.floor(raw.length / frameSize);

  const frameEnergies: number[] = [];
  for (let f = 0; f < totalFrames; f++) {
    let sumSq = 0;
    const offset = f * frameSize;
    for (let i = 0; i < frameSize; i++) {
      const val = raw[offset + i] || 0;
      sumSq += val * val;
    }
    const rms = Math.sqrt(sumSq / frameSize);
    frameEnergies.push(rms);
  }

  // Find non-silent speech blocks
  const minSilenceFrames = Math.floor(minSilenceSecs / 0.02);
  const segments: { startTime: number; endTime: number }[] = [];

  let inSpeech = false;
  let speechStartFrame = 0;
  let silenceFrameCount = 0;

  for (let f = 0; f < frameEnergies.length; f++) {
    const isSilent = frameEnergies[f] < silenceThreshold;

    if (!inSpeech) {
      if (!isSilent) {
        inSpeech = true;
        speechStartFrame = f;
        silenceFrameCount = 0;
      }
    } else {
      if (isSilent) {
        silenceFrameCount++;
        if (silenceFrameCount >= minSilenceFrames) {
          // End of phrase
          const endFrame = f - silenceFrameCount;
          const startSec = Math.max(0, (speechStartFrame * frameSize) / sampleRate - 0.1);
          const endSec = Math.min(buffer.duration, (endFrame * frameSize) / sampleRate + 0.1);

          if (endSec - startSec >= 0.8) {
            segments.push({ startTime: startSec, endTime: endSec });
          }
          inSpeech = false;
          silenceFrameCount = 0;
        }
      } else {
        silenceFrameCount = 0;
      }
    }
  }

  // Handle final segment if ends during speech
  if (inSpeech) {
    const startSec = Math.max(0, (speechStartFrame * frameSize) / sampleRate - 0.1);
    const endSec = buffer.duration;
    if (endSec - startSec >= 0.8) {
      segments.push({ startTime: startSec, endTime: endSec });
    }
  }

  // Fallback if no pauses detected
  if (segments.length === 0) {
    const dur = buffer.duration;
    segments.push({ startTime: 0, endTime: dur });
  }

  return segments;
}

/**
 * Generate synthetic French audio buffer with clear spoken cadence and pauses
 * for preloaded samples when audio file is generated dynamically in browser.
 */
export function generateSyntheticAudioBuffer(
  sentences: { startTime: number; endTime: number; frenchText: string }[],
  totalDuration = 35
): AudioBuffer {
  const ctx = getAudioContext();
  const sampleRate = ctx.sampleRate;
  const numSamples = Math.floor(sampleRate * totalDuration);
  const buffer = ctx.createBuffer(1, numSamples, sampleRate);
  const data = buffer.getChannelData(0);

  // Generate realistic acoustic speech envelope for each sentence range
  sentences.forEach((s) => {
    const startIdx = Math.floor(s.startTime * sampleRate);
    const endIdx = Math.floor(s.endTime * sampleRate);
    const len = endIdx - startIdx;

    if (len <= 0) return;

    for (let i = 0; i < len; i++) {
      const t = i / sampleRate;
      const progress = i / len;

      // Syllabic speech cadence modulation (4-6 Hz speech rate)
      const syllableEnv = Math.pow(Math.sin(t * Math.PI * 5), 2) * 0.7 + 0.3;
      
      // Pitch contours
      const baseFreq = 160 + Math.sin(t * 3) * 20 - progress * 15;
      const fundamental = Math.sin(2 * Math.PI * baseFreq * t);
      const harmonic1 = 0.5 * Math.sin(2 * Math.PI * baseFreq * 2 * t);
      const harmonic2 = 0.25 * Math.sin(2 * Math.PI * baseFreq * 3 * t);
      
      // Attack and release fade
      let envelope = 1;
      if (progress < 0.05) envelope = progress / 0.05;
      else if (progress > 0.92) envelope = (1 - progress) / 0.08;

      // Combine harmonics + subtle formant resonance
      const sampleVal = (fundamental + harmonic1 + harmonic2) * 0.3 * syllableEnv * envelope;
      
      const idx = startIdx + i;
      if (idx < numSamples) {
        data[idx] = sampleVal;
      }
    }
  });

  return buffer;
}

/**
 * Format seconds into mm:ss or mm:ss.d
 */
export function formatTime(seconds: number, showDecimal = false): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const decs = Math.floor((seconds % 1) * 10);

  const mStr = String(mins).padStart(2, "0");
  const sStr = String(secs).padStart(2, "0");

  if (showDecimal) {
    return `${mStr}:${sStr}.${decs}`;
  }
  return `${mStr}:${sStr}`;
}

/**
 * Convert AudioBuffer to Base64 encoded WAV string for Gemini STT input
 */
export function audioBufferToBase64Wav(buffer: AudioBuffer): string {
  const numChannels = 1;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const channelData = buffer.getChannelData(0);

  // Limit to max 120s of audio for optimal STT performance
  const maxSamples = Math.min(channelData.length, sampleRate * 120);
  const dataLength = maxSamples * 2;
  const bufferLength = 44 + dataLength;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < maxSamples; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

