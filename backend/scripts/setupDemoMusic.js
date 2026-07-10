#!/usr/bin/env node
/**
 * Demo music generator for manually testing Device Music scanning.
 *
 * Generates a handful of short, original WAV tracks (simple synthesized
 * tones/scales — no copied commercial melodies) plus a small generated SVG
 * cover per track, into an ignored local directory. A developer can then
 * pick these files through the "Select Audio Files" input on
 * /library/device to exercise scanning, metadata extraction, local
 * playback, and import without ever needing real commercial audio.
 *
 * This script never downloads anything and never touches the database —
 * it only writes local files under backend/demo-media/, which is gitignored.
 *
 * Usage:
 *   node scripts/setupDemoMusic.js
 */
const fs = require("fs");
const path = require("path");

const OUTPUT_ROOT = path.join(__dirname, "..", "demo-media");
const AUDIO_DIR = path.join(OUTPUT_ROOT, "audio");
const COVERS_DIR = path.join(OUTPUT_ROOT, "covers");
const SAMPLE_RATE = 22050;

const writeUint32LE = (buffer, offset, value) => buffer.writeUInt32LE(value >>> 0, offset);
const writeUint16LE = (buffer, offset, value) => buffer.writeUInt16LE(value, offset);

// Builds a mono, 16-bit PCM WAV buffer from a sequence of notes. Each note is
// { frequencyHz, seconds } (frequencyHz === 0 means silence) — a simple
// original tone generator, not a recording or transcription of any existing
// commercial work.
const buildWavFromNotes = (notes) => {
  const totalSamples = notes.reduce((sum, note) => sum + Math.round(note.seconds * SAMPLE_RATE), 0);
  const bytesPerSample = 2;
  const dataSize = totalSamples * bytesPerSample;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  writeUint32LE(header, 4, 36 + dataSize);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  writeUint32LE(header, 16, 16);
  writeUint16LE(header, 20, 1);
  writeUint16LE(header, 22, 1);
  writeUint32LE(header, 24, SAMPLE_RATE);
  writeUint32LE(header, 28, SAMPLE_RATE * bytesPerSample);
  writeUint16LE(header, 32, bytesPerSample);
  writeUint16LE(header, 34, 16);
  header.write("data", 36, "ascii");
  writeUint32LE(header, 40, dataSize);

  const data = Buffer.alloc(dataSize);
  let offset = 0;
  const amplitude = 0.2 * 32767; // gentle volume, not full-scale

  for (const note of notes) {
    const sampleCount = Math.round(note.seconds * SAMPLE_RATE);
    for (let i = 0; i < sampleCount; i += 1) {
      let value = 0;
      if (note.frequencyHz > 0) {
        const t = i / SAMPLE_RATE;
        // A short fade-in/out per note avoids audible clicks between notes.
        const fadeSamples = Math.min(200, sampleCount / 4);
        const fade = Math.min(i, sampleCount - i, fadeSamples) / fadeSamples;
        value = Math.sin(2 * Math.PI * note.frequencyHz * t) * amplitude * Math.max(0, Math.min(1, fade));
      }
      data.writeInt16LE(Math.round(value), offset);
      offset += bytesPerSample;
    }
  }

  return Buffer.concat([header, data]);
};

// Simple named frequencies (equal temperament, A4 = 440Hz) — enough to build
// short original scale/arpeggio patterns without transcribing anything real.
const NOTE_HZ = {
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99,
};

const NOTE_DURATION = 0.4;

const TRACKS = [
  {
    filename: "sunrise-loop.wav",
    title: "Sunrise Loop",
    artist: "Rockstar Demo Studio",
    notes: ["C4", "E4", "G4", "C5", "G4", "E4"].map((n) => ({ frequencyHz: NOTE_HZ[n], seconds: NOTE_DURATION })),
  },
  {
    filename: "late-night-drive.wav",
    title: "Late Night Drive",
    artist: "Rockstar Demo Studio",
    notes: ["A4", "E4", "A4", "E4", "F4", "C4"].map((n) => ({ frequencyHz: NOTE_HZ[n], seconds: 0.6 })),
  },
  {
    filename: "golden-hour.wav",
    title: "Golden Hour",
    artist: "Rockstar Demo Studio",
    notes: ["C4", "E4", "G4", "E4", "C4", "G4", "E4", "C4"].map((n) => ({
      frequencyHz: NOTE_HZ[n],
      seconds: NOTE_DURATION,
    })),
  },
  {
    filename: "city-lights.wav",
    title: "City Lights",
    artist: "Rockstar Demo Studio",
    notes: ["G4", "B4", "D5", "G5", "D5", "B4"].map((n) => ({ frequencyHz: NOTE_HZ[n], seconds: 0.3 })),
  },
  {
    filename: "quiet-static.wav",
    title: "Quiet Static",
    artist: "Rockstar Demo Studio",
    notes: [{ frequencyHz: NOTE_HZ.A4, seconds: 3 }, { frequencyHz: NOTE_HZ.E4, seconds: 3 }],
  },
];

const PALETTE = ["#1a1512", "#c9a15f", "#e8c98a", "#0d0b0a"];

const buildCoverSvg = (title, index) => {
  const accent = PALETTE[index % PALETTE.length];
  const initial = title.trim().charAt(0).toUpperCase() || "R";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0d0b0a" />
      <stop offset="100%" stop-color="#1a1512" />
    </linearGradient>
  </defs>
  <rect width="400" height="400" fill="url(#bg)" />
  <circle cx="200" cy="200" r="120" fill="none" stroke="${accent}" stroke-width="3" opacity="0.5" />
  <circle cx="200" cy="200" r="80" fill="none" stroke="${accent}" stroke-width="2" opacity="0.35" />
  <text x="200" y="228" font-family="Georgia, serif" font-size="120" fill="${accent}" text-anchor="middle">${initial}</text>
</svg>`;
};

const main = () => {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
  fs.mkdirSync(COVERS_DIR, { recursive: true });

  const manifestEntries = [];

  TRACKS.forEach((track, index) => {
    const wavBuffer = buildWavFromNotes(track.notes);
    const audioPath = path.join(AUDIO_DIR, track.filename);
    fs.writeFileSync(audioPath, wavBuffer);

    const coverFilename = track.filename.replace(/\.wav$/, ".svg");
    const coverPath = path.join(COVERS_DIR, coverFilename);
    fs.writeFileSync(coverPath, buildCoverSvg(track.title, index));

    const durationSeconds = track.notes.reduce((sum, note) => sum + note.seconds, 0);

    manifestEntries.push({
      filename: track.filename,
      coverFilename,
      title: track.title,
      creator: track.artist,
      source: "generated",
      license: "Original tone sequence generated locally by setupDemoMusic.js — no external source, no copied melody.",
      retrievedAt: new Date().toISOString(),
      durationSeconds: Math.round(durationSeconds * 100) / 100,
    });

    console.log(`Generated: ${track.filename} (${durationSeconds.toFixed(1)}s) + ${coverFilename}`);
  });

  fs.writeFileSync(
    path.join(OUTPUT_ROOT, "licenses.json"),
    JSON.stringify(
      {
        mode: "generated",
        note: "All tracks below are synthesized locally by this script. None were downloaded from any external source.",
        tracks: manifestEntries,
      },
      null,
      2
    )
  );

  console.log(`\nDone. ${TRACKS.length} demo tracks written to ${AUDIO_DIR}`);
  console.log(`Covers written to ${COVERS_DIR}`);
  console.log(`Manifest: ${path.join(OUTPUT_ROOT, "licenses.json")}`);
  console.log(`\nUse these via /library/device → "Select Audio Files" to test Device Music scanning.`);
};

main();
