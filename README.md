# Linguist Wave

**Learn French one sentence at a time — slice audio, loop it, shadow it.**

Upload a recording, cut it into phrases on an interactive waveform, then practice each line until it sticks.

---

## How it works

```
  ┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
  │  1. Upload  │ ──▶ │  2. Slice    │ ──▶ │  3. Loop    │ ──▶ │  4. Shadow   │
  │    audio    │     │  sentences   │     │  & listen   │     │  & speak     │
  └─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
```

### 1. Drop in your audio

Load any French recording (MP3, WAV, etc.). Linguist Wave listens for natural pauses and splits the track into sentence-sized clips automatically.

### 2. Fine-tune on the waveform

Drag the slicer handles to adjust where each phrase starts and ends. Click a sentence in the list to jump there and hear just that slice.

### 3. Practice with loop & speed

Hit play — looping is on by default. Slow down to **0.5×** when a phrase is tricky, then ramp back up as you improve.

### 4. Hide text, speak along

Toggle French or English off to test yourself. Use the mic on any sentence to record yourself and compare.

---

## Transcripts & AI

| You bring…              | The app does…                                      |
|-------------------------|----------------------------------------------------|
| Audio only              | Auto-segments by pause, optional Gemini STT        |
| Audio + transcript      | Aligns each line to the waveform, translates       |
| Transcript file / paste | Parses sentences, syncs timing to your clips       |

Optional Gemini features (needs `GEMINI_API_KEY`):

- **Speech-to-text** — transcribe French audio into timed sentences  
- **Translate** — English gloss for every line  
- **Align** — match your transcript to the recording  

Without a key, pause detection and manual slicing still work fully.

---

## Quick start

```bash
npm install
cp .env.example .env   # add GEMINI_API_KEY if you want AI features
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Stack

React · Vite · Web Audio API · Express · Gemini

Built for deliberate listening practice — not flashcards, not full-episode scrubbing. One sentence. Loop it. Own it.
