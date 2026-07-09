const { parseRange } = require("../../utils/rangeParser");

const FILE_SIZE = 1000;

describe("parseRange", () => {
  it("returns null when no Range header is present", () => {
    expect(parseRange(undefined, FILE_SIZE)).toBeNull();
    expect(parseRange(null, FILE_SIZE)).toBeNull();
    expect(parseRange("", FILE_SIZE)).toBeNull();
  });

  it("returns null for a multi-range request (unsupported, serve full file)", () => {
    expect(parseRange("bytes=0-99,200-299", FILE_SIZE)).toBeNull();
  });

  it("returns null for an unparsable header", () => {
    expect(parseRange("not-a-range-header", FILE_SIZE)).toBeNull();
    expect(parseRange("items=0-99", FILE_SIZE)).toBeNull();
  });

  it("returns null when both bounds are empty", () => {
    expect(parseRange("bytes=-", FILE_SIZE)).toBeNull();
  });

  it("returns unsatisfiable when fileSize is zero or negative", () => {
    expect(parseRange("bytes=0-99", 0)).toEqual({ unsatisfiable: true });
    expect(parseRange("bytes=0-99", -1)).toEqual({ unsatisfiable: true });
  });

  it("parses a normal bounded range", () => {
    expect(parseRange("bytes=0-99", FILE_SIZE)).toEqual({ start: 0, end: 99 });
  });

  it("defaults the end to fileSize-1 when omitted", () => {
    expect(parseRange("bytes=500-", FILE_SIZE)).toEqual({ start: 500, end: 999 });
  });

  it("clamps an end beyond fileSize-1", () => {
    expect(parseRange("bytes=900-9999", FILE_SIZE)).toEqual({ start: 900, end: 999 });
  });

  it("parses a suffix range (last N bytes)", () => {
    expect(parseRange("bytes=-500", FILE_SIZE)).toEqual({ start: 500, end: 999 });
  });

  it("clamps a suffix range longer than the file to the whole file", () => {
    expect(parseRange("bytes=-5000", FILE_SIZE)).toEqual({ start: 0, end: 999 });
  });

  it("is unsatisfiable for a zero or negative suffix length", () => {
    expect(parseRange("bytes=-0", FILE_SIZE)).toEqual({ unsatisfiable: true });
  });

  it("is unsatisfiable when start > end", () => {
    expect(parseRange("bytes=500-100", FILE_SIZE)).toEqual({ unsatisfiable: true });
  });

  it("is unsatisfiable when start is at or beyond fileSize", () => {
    expect(parseRange("bytes=1000-1999", FILE_SIZE)).toEqual({ unsatisfiable: true });
    expect(parseRange(`bytes=${FILE_SIZE}-`, FILE_SIZE)).toEqual({ unsatisfiable: true });
  });

  it("parses a range covering the entire file", () => {
    expect(parseRange("bytes=0-999", FILE_SIZE)).toEqual({ start: 0, end: 999 });
  });

  it("parses a single-byte range", () => {
    expect(parseRange("bytes=0-0", FILE_SIZE)).toEqual({ start: 0, end: 0 });
  });

  it("trims surrounding whitespace on the header", () => {
    expect(parseRange("  bytes=0-99  ", FILE_SIZE)).toEqual({ start: 0, end: 99 });
  });
});
