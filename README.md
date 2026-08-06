# PSYWEAVE — The Infinite Psytrance Instrument

**PSYWEAVE is a genre-native psychedelic music instrument.**
Not a toy, not a demo — a performable instrument: press PLAY and a full, authentic psytrance production unfolds and evolves by itself. You play *with* it — energy, color, chaos, loops — for hours. No music knowledge required. No grid programming. No wrong notes.

**Play it now (installable app, phone & desktop):** https://psyweave.pages.dev

---

## What it is

- A **real-time synthesis engine** (Web Audio), not samples: kick, rolling bass, 303-style acid, wavefolder leads, pads, percussion — synthesized per note.
- An **auto-arranger**: the track arranges itself like a live DJ set — INTRO → BUILD → DROP → BREAK → CLIMAX — with risers, impacts and filter grammar, fully editable in Song Mode.
- A **live looper**: record the master bus or your mic, quantized to the bar, tempo-compensated, with level meters.
- A **macro performance surface**: FILTER / SPACE / DRIVE / SWING + MORPH XY. Every knob is musical; nothing can break the mix.
- **Instant studio output**: offline-rendered WAV mixdown and separate STEMS (drums / bass / lead / pads / loops), loudness-normalized, ready for any DAW.
- **Installable PWA**: add to home screen on your phone — it is an app, offline-capable, built for performance.

## The idea in one line

Anyone — zero experience — picks it up, and within minutes is *performing* an original, genre-authentic psytrance track that sounds like a production, and can keep evolving it forever.

## Play guide (30 seconds)

1. Open https://psyweave.pages.dev and press PLAY.
2. Let AUTO run the arrangement. Switch SCENES (Full-On / Dark / Prog / Acid / Goa / Night / Fold) — each is a different psychedelic world with its own tempo.
3. Ride the macros: FILTER for tension, SPACE for depth, MORPH XY for movement. RISE / DROP / FILL / ZAP are your stage buttons.
4. Record a loop (REC) over the top, or your voice (MIC).
5. EXPORT WAV or STEMS — your track, normalized, ready.

## Keyboard

Space Play/Stop · 1–7 scenes · R record · M mutate melody · D drop · F fill · U undo

## Architecture

    js/core.js     scales, scenes, arrangement grammar
    js/engine.js   synthesis & master chain (sidechain, limiter, wavefolder, 303)
    js/music.js    motif generator, arranger, sequencer, offline bounce
    js/looper.js   live looper + WAV encoding
    js/viz.js      radial visualizer
    js/app.js      state, UI, MIDI, persistence
    sw.js          service worker (offline app)
    manifest.json  PWA manifest

## The target we build against

See **VISION.md** — the full product spec: genre matrix across the psychedelic spectrum, synthesis architecture, intelligence/automation model, performance UX, and sound-quality bar.

## Run locally

    python3 -m http.server 8000

## Deploy

GitHub Actions (`.github/workflows/deploy.yml`) + Cloudflare Pages. Push and it is live.
