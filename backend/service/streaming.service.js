const fs = require("fs");
const AppError = require("../utils/AppError");
const { resolveManagedFilePath, extractManagedFilename } = require("../utils/mediaFiles");
const { parseRange } = require("../utils/rangeParser");

const pipeStream = (stream, res) => {
  stream.on("error", () => {
    // Headers may already be sent for a partial transfer; there is no way
    // to report a clean JSON error mid-stream, so just end the connection.
    res.end();
  });

  res.on("close", () => {
    stream.destroy();
  });

  stream.pipe(res);
};

// `song` must already be access-checked by the caller (published, or the
// viewer is the owner/admin) — this service only resolves and streams bytes.
const serveAudioStream = async (req, res, song) => {
  const filename = extractManagedFilename("music", song.audio_url);
  const filePath = filename && resolveManagedFilePath("music", filename);

  if (!filePath) {
    throw new AppError("This song's audio file is unavailable.", 404);
  }

  let stat;
  try {
    stat = await fs.promises.stat(filePath);
  } catch {
    throw new AppError("This song's audio file is unavailable.", 404);
  }

  const fileSize = stat.size;
  const contentType = song.mime_type || "application/octet-stream";
  const range = parseRange(req.headers.range, fileSize);

  if (range && range.unsatisfiable) {
    res.status(416).set({ "Content-Range": `bytes */${fileSize}` }).end();
    return;
  }

  res.set({ "Accept-Ranges": "bytes", "Content-Type": contentType });

  if (range) {
    const { start, end } = range;
    res.status(206).set({
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Content-Length": end - start + 1,
    });
    pipeStream(fs.createReadStream(filePath, { start, end }), res);
  } else {
    res.status(200).set({ "Content-Length": fileSize });
    pipeStream(fs.createReadStream(filePath), res);
  }
};

module.exports = { serveAudioStream };
