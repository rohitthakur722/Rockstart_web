const RANGE_PATTERN = /^bytes=(\d*)-(\d*)$/;

// Parses a single-range "Range" header against a known file size.
// Returns:
//   null                    -> no range requested (or unparsable/multi-range,
//                               which we degrade to serving the full file)
//   { unsatisfiable: true } -> syntactically a range, but not satisfiable (416)
//   { start, end }          -> a valid, satisfiable byte range (inclusive)
const parseRange = (rangeHeader, fileSize) => {
  if (!rangeHeader) return null;
  if (rangeHeader.includes(",")) return null; // multiple ranges: unsupported, serve full file

  const match = RANGE_PATTERN.exec(rangeHeader.trim());
  if (!match) return null;

  const [, startStr, endStr] = match;
  if (startStr === "" && endStr === "") return null;

  if (fileSize <= 0) return { unsatisfiable: true };

  let start;
  let end;

  if (startStr === "") {
    // Suffix range: last N bytes, e.g. "bytes=-1024".
    const suffixLength = parseInt(endStr, 10);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return { unsatisfiable: true };
    start = Math.max(fileSize - suffixLength, 0);
    end = fileSize - 1;
  } else {
    start = parseInt(startStr, 10);
    end = endStr === "" ? fileSize - 1 : parseInt(endStr, 10);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) return { unsatisfiable: true };
  if (start > end) return { unsatisfiable: true };
  if (start >= fileSize) return { unsatisfiable: true };

  end = Math.min(end, fileSize - 1);

  return { start, end };
};

module.exports = { parseRange };
