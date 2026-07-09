const VALID_PNG_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

const VALID_JPEG_BUFFER = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
  "base64"
);

const INVALID_AUDIO_BUFFER = Buffer.from("this is not a real audio file, just plain text bytes", "utf8");
const INVALID_IMAGE_BUFFER = Buffer.from("this is not a real image file, just plain text bytes", "utf8");

const writeUint32LE = (buffer, offset, value) => buffer.writeUInt32LE(value >>> 0, offset);
const writeUint16LE = (buffer, offset, value) => buffer.writeUInt16LE(value, offset);

const buildValidWavBuffer = (durationSeconds, { sampleRate = 8000, channels = 1, bitDepth = 16 } = {}) => {
  const bytesPerSample = bitDepth / 8;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const numSamples = Math.round(durationSeconds * sampleRate);
  const dataSize = numSamples * blockAlign;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  writeUint32LE(header, 4, 36 + dataSize);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  writeUint32LE(header, 16, 16);
  writeUint16LE(header, 20, 1);
  writeUint16LE(header, 22, channels);
  writeUint32LE(header, 24, sampleRate);
  writeUint32LE(header, 28, byteRate);
  writeUint16LE(header, 32, blockAlign);
  writeUint16LE(header, 34, bitDepth);
  header.write("data", 36, "ascii");
  writeUint32LE(header, 40, dataSize);

  const data = Buffer.alloc(dataSize);
  return Buffer.concat([header, data]);
};

const buildInvalidAudioBuffer = () => Buffer.from(INVALID_AUDIO_BUFFER);

const buildValidPngBuffer = () => Buffer.from(VALID_PNG_BUFFER);
const buildValidJpegBuffer = () => Buffer.from(VALID_JPEG_BUFFER);
const buildInvalidImageBuffer = () => Buffer.from(INVALID_IMAGE_BUFFER);

const buildOversizedWavBuffer = (sizeBytes) => {
  const approxSeconds = Math.ceil(sizeBytes / (8000 * 2));
  const buffer = buildValidWavBuffer(approxSeconds);
  if (buffer.length >= sizeBytes) return buffer;
  return Buffer.concat([buffer, Buffer.alloc(sizeBytes - buffer.length)]);
};

const buildOversizedImageBuffer = (sizeBytes) =>
  Buffer.concat([buildValidPngBuffer(), Buffer.alloc(Math.max(0, sizeBytes - buildValidPngBuffer().length))]);

module.exports = {
  buildValidWavBuffer,
  buildInvalidAudioBuffer,
  buildValidPngBuffer,
  buildValidJpegBuffer,
  buildInvalidImageBuffer,
  buildOversizedWavBuffer,
  buildOversizedImageBuffer,
};
