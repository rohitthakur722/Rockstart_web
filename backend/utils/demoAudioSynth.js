// Original, locally-synthesized instrumental loops for the RockStar Demo
// Library and the manual device-scan demo generator — no recordings, no
// external audio, no copied melodies. A simple layered synthesizer (bass +
// pad chords + a plucked arpeggio + optional soft percussion) mixed down to
// a normalized, clipping-safe 16-bit PCM WAV buffer.

const SAMPLE_RATE = 22050;
const BIT_DEPTH = 16;

// Equal-temperament note table (A4 = 440Hz), a few octaves — enough range
// for a bass note, a mid-register chord, and an arpeggio an octave above it.
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const noteFrequency = (name) => {
  const match = /^([A-G]#?)(\d)$/.exec(name);
  if (!match) throw new Error(`Invalid note name: ${name}`);
  const [, pitch, octaveStr] = match;
  const octave = Number(octaveStr);
  const semitoneIndex = NOTE_NAMES.indexOf(pitch);
  const midiNumber = (octave + 1) * 12 + semitoneIndex;
  return 440 * 2 ** ((midiNumber - 69) / 12);
};

// Chord quality -> semitone offsets from the root.
const CHORD_INTERVALS = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  dom7: [0, 4, 7, 10],
  sus2: [0, 2, 7],
};

const transpose = (frequencyHz, semitones) => frequencyHz * 2 ** (semitones / 12);

const sine = (frequencyHz, t) => Math.sin(2 * Math.PI * frequencyHz * t);
const triangle = (frequencyHz, t) => {
  const phase = (frequencyHz * t) % 1;
  return phase < 0.5 ? 4 * phase - 1 : 3 - 4 * phase;
};

// Linear attack/release envelope, 0..1, so notes never start/stop with an
// audible click.
const envelope = (tInNote, noteDuration, attack, release) => {
  if (tInNote < attack) return tInNote / attack;
  if (tInNote > noteDuration - release) return Math.max(0, (noteDuration - tInNote) / release);
  return 1;
};

// Fast-decaying pluck envelope for the arpeggio layer.
const pluckEnvelope = (tInNote, decaySeconds) => Math.exp(-tInNote / decaySeconds);

// A short burst of soft, lightly-filtered noise (a 3-sample moving average
// stands in for a gentle lowpass) for an unobtrusive percussive texture.
let noiseFilterState = [0, 0, 0];
const softNoiseSample = () => {
  noiseFilterState.shift();
  noiseFilterState.push(Math.random() * 2 - 1);
  return (noiseFilterState[0] + noiseFilterState[1] + noiseFilterState[2]) / 3;
};

/**
 * Renders one original instrumental loop as Float64 samples in [-1, 1].
 *
 * @param {object} options
 * @param {Array<{root: string, quality: string}>} options.progression - chord loop
 * @param {number} options.bpm
 * @param {number} options.beatsPerChord
 * @param {number} options.loops - how many times the progression repeats
 * @param {boolean} options.withArpeggio
 * @param {boolean} options.withPercussion
 */
const renderTrack = ({
  progression,
  bpm,
  beatsPerChord = 4,
  loops = 4,
  withArpeggio = true,
  withPercussion = false,
}) => {
  const secondsPerBeat = 60 / bpm;
  const chordDuration = secondsPerBeat * beatsPerChord;
  const totalChords = progression.length * loops;
  const totalDuration = chordDuration * totalChords;
  const totalSamples = Math.round(totalDuration * SAMPLE_RATE);

  const buffer = new Float64Array(totalSamples);
  noiseFilterState = [0, 0, 0];

  for (let chordIndex = 0; chordIndex < totalChords; chordIndex += 1) {
    const { root, quality } = progression[chordIndex % progression.length];
    const rootFreq = noteFrequency(root);
    const intervals = CHORD_INTERVALS[quality] || CHORD_INTERVALS.maj;
    const chordTones = intervals.map((semitones) => transpose(rootFreq, semitones));

    const startSample = Math.round(chordIndex * chordDuration * SAMPLE_RATE);
    const endSample = Math.min(totalSamples, Math.round((chordIndex + 1) * chordDuration * SAMPLE_RATE));

    for (let i = startSample; i < endSample; i += 1) {
      const tInChord = (i - startSample) / SAMPLE_RATE;
      let sample = 0;

      // Bass: the root, one octave down, sustained.
      const bassEnv = envelope(tInChord, chordDuration, 0.05, 0.2);
      sample += sine(transpose(rootFreq, -12), tInChord) * 0.28 * bassEnv;

      // Pad: the full chord, soft triangle waves, slow attack.
      const padEnv = envelope(tInChord, chordDuration, 0.25, 0.35);
      const padGain = 0.12 / chordTones.length;
      for (const toneFreq of chordTones) {
        sample += triangle(toneFreq, tInChord) * padGain * padEnv;
      }

      // Arpeggio: cycles through the chord tones an octave up, plucked.
      if (withArpeggio) {
        const notesPerChord = beatsPerChord * 2; // eighth notes
        const noteDuration = chordDuration / notesPerChord;
        const noteIndexInChord = Math.floor(tInChord / noteDuration);
        const tInNote = tInChord - noteIndexInChord * noteDuration;
        const arpTone = transpose(chordTones[noteIndexInChord % chordTones.length], 12);
        sample += triangle(arpTone, tInNote) * 0.14 * pluckEnvelope(tInNote, noteDuration * 0.6);
      }

      // Soft percussion: a brief filtered-noise tick on every other beat.
      if (withPercussion) {
        const beatDuration = secondsPerBeat;
        const beatIndexInChord = Math.floor(tInChord / beatDuration);
        if (beatIndexInChord % 2 === 1) {
          const tInBeat = tInChord - beatIndexInChord * beatDuration;
          if (tInBeat < 0.06) {
            sample += softNoiseSample() * 0.05 * Math.exp(-tInBeat / 0.02);
          }
        }
      }

      buffer[i] += sample;
    }
  }

  // Whole-track fade-in/out on top of the per-note envelopes, so the very
  // start/end of the file is always silent, never an abrupt cut.
  const fadeInSamples = Math.round(0.6 * SAMPLE_RATE);
  const fadeOutSamples = Math.round(1.5 * SAMPLE_RATE);
  for (let i = 0; i < fadeInSamples && i < buffer.length; i += 1) {
    buffer[i] *= i / fadeInSamples;
  }
  for (let i = 0; i < fadeOutSamples && i < buffer.length; i += 1) {
    const idx = buffer.length - 1 - i;
    buffer[idx] *= i / fadeOutSamples;
  }

  // Normalize to a safe peak so layered voices never clip, with headroom.
  let peak = 0;
  for (let i = 0; i < buffer.length; i += 1) peak = Math.max(peak, Math.abs(buffer[i]));
  const targetPeak = 0.82;
  const gain = peak > 0 ? Math.min(targetPeak / peak, 4) : 1;

  return { samples: buffer, gain, sampleRate: SAMPLE_RATE, durationSeconds: totalDuration };
};

const writeUint32LE = (buffer, offset, value) => buffer.writeUInt32LE(value >>> 0, offset);
const writeUint16LE = (buffer, offset, value) => buffer.writeUInt16LE(value, offset);

// Encodes normalized Float64 samples into a valid mono 16-bit PCM WAV buffer.
const encodeWav = ({ samples, gain, sampleRate }) => {
  const bytesPerSample = BIT_DEPTH / 8;
  const dataSize = samples.length * bytesPerSample;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  writeUint32LE(header, 4, 36 + dataSize);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  writeUint32LE(header, 16, 16);
  writeUint16LE(header, 20, 1); // PCM
  writeUint16LE(header, 22, 1); // mono
  writeUint32LE(header, 24, sampleRate);
  writeUint32LE(header, 28, sampleRate * bytesPerSample);
  writeUint16LE(header, 32, bytesPerSample);
  writeUint16LE(header, 34, BIT_DEPTH);
  header.write("data", 36, "ascii");
  writeUint32LE(header, 40, dataSize);

  const data = Buffer.alloc(dataSize);
  for (let i = 0; i < samples.length; i += 1) {
    const value = Math.max(-1, Math.min(1, samples[i] * gain)) * 32767;
    data.writeInt16LE(Math.round(value), i * bytesPerSample);
  }

  return Buffer.concat([header, data]);
};

/** High-level helper: renders a track and returns a ready-to-write WAV buffer. */
const synthesizeDemoTrackWav = (trackSpec) => {
  const rendered = renderTrack(trackSpec);
  return { buffer: encodeWav(rendered), durationSeconds: Math.round(rendered.durationSeconds) };
};

module.exports = { synthesizeDemoTrackWav, renderTrack, encodeWav, noteFrequency, SAMPLE_RATE };
