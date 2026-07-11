#!/usr/bin/env node
/**
 * Demo music generator for manually testing Device Music scanning.
 *
 * Generates a handful of original instrumental WAV tracks (layered
 * synthesis — bass, pad chords, arpeggio, soft percussion; see
 * utils/demoAudioSynth.js — no copied commercial melodies) plus a
 * professional generated SVG cover per track (utils/demoArtworkGenerator.js),
 * into an ignored local directory. A developer can then pick these files
 * through the "Select Audio Files" input on /library/device to exercise
 * scanning, metadata extraction, local playback, and import without ever
 * needing real commercial audio.
 *
 * This script never downloads anything and never touches the database — for
 * an immediately-playable, real database-backed catalog, use
 * `npm run demo:seed` instead (scripts/seedDemoLibrary.js). This script only
 * writes local files under backend/demo-media/, which is gitignored.
 *
 * Usage:
 *   node scripts/setupDemoMusic.js
 */
const fs = require("fs");
const path = require("path");
const { synthesizeDemoTrackWav } = require("../utils/demoAudioSynth");
const { buildDemoCoverSvg } = require("../utils/demoArtworkGenerator");

const OUTPUT_ROOT = path.join(__dirname, "..", "demo-media");
const AUDIO_DIR = path.join(OUTPUT_ROOT, "audio");
const COVERS_DIR = path.join(OUTPUT_ROOT, "covers");

const PROGRESSIONS = {
  warmMinor: [
    { root: "A3", quality: "min" },
    { root: "F3", quality: "maj" },
    { root: "C3", quality: "maj" },
    { root: "G3", quality: "maj" },
  ],
  jazzy: [
    { root: "C3", quality: "maj7" },
    { root: "A3", quality: "min7" },
    { root: "D3", quality: "min7" },
    { root: "G3", quality: "dom7" },
  ],
  bright: [
    { root: "E3", quality: "min" },
    { root: "C3", quality: "maj" },
    { root: "G3", quality: "maj" },
    { root: "D3", quality: "maj" },
  ],
};

const TRACKS = [
  {
    filename: "sunrise-loop.wav",
    title: "Sunrise Loop",
    artist: "Rockstar Demo Studio",
    music: { progression: PROGRESSIONS.bright, bpm: 96, loops: 3, withArpeggio: true, withPercussion: true },
  },
  {
    filename: "late-night-drive.wav",
    title: "Late Night Drive",
    artist: "Rockstar Demo Studio",
    music: { progression: PROGRESSIONS.warmMinor, bpm: 82, loops: 3, withArpeggio: true, withPercussion: false },
  },
  {
    filename: "golden-hour.wav",
    title: "Golden Hour",
    artist: "Rockstar Demo Studio",
    music: { progression: PROGRESSIONS.jazzy, bpm: 88, loops: 3, withArpeggio: false, withPercussion: false },
  },
  {
    filename: "city-lights.wav",
    title: "City Lights",
    artist: "Rockstar Demo Studio",
    music: { progression: PROGRESSIONS.bright, bpm: 110, loops: 4, withArpeggio: true, withPercussion: true },
  },
  {
    filename: "quiet-static.wav",
    title: "Quiet Static",
    artist: "Rockstar Demo Studio",
    music: { progression: PROGRESSIONS.warmMinor, bpm: 70, loops: 3, withArpeggio: false, withPercussion: false },
  },
];

const main = () => {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
  fs.mkdirSync(COVERS_DIR, { recursive: true });

  const manifestEntries = [];

  TRACKS.forEach((track) => {
    const rendered = synthesizeDemoTrackWav(track.music);
    const audioPath = path.join(AUDIO_DIR, track.filename);
    fs.writeFileSync(audioPath, rendered.buffer);

    const coverFilename = track.filename.replace(/\.wav$/, ".svg");
    const coverPath = path.join(COVERS_DIR, coverFilename);
    const coverSvg = buildDemoCoverSvg({ seed: track.filename, title: track.title, subtitle: track.artist });
    fs.writeFileSync(coverPath, coverSvg);

    manifestEntries.push({
      filename: track.filename,
      coverFilename,
      title: track.title,
      creator: track.artist,
      source: "generated",
      license: "Original layered synthesis generated locally by setupDemoMusic.js — no external source, no copied melody.",
      retrievedAt: new Date().toISOString(),
      durationSeconds: rendered.durationSeconds,
    });

    console.log(`Generated: ${track.filename} (${rendered.durationSeconds}s) + ${coverFilename}`);
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
  console.log(`For an immediately-playable database-backed catalog instead, run: npm run demo:seed`);
};

main();
