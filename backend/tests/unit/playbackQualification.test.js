const { getQualificationThresholdSeconds, isQualified } = require("../../utils/playbackQualification");

describe("getQualificationThresholdSeconds", () => {
  it("requires the whole song for a 3s clip (below the 5s floor)", () => {
    expect(getQualificationThresholdSeconds(3)).toBe(3);
  });

  it("uses the 5s floor for a 20s song (25% would be 5s exactly)", () => {
    expect(getQualificationThresholdSeconds(20)).toBe(5);
  });

  it("uses 25% of duration for a 60s song", () => {
    expect(getQualificationThresholdSeconds(60)).toBe(15);
  });

  it("caps at 30s for a 120s song", () => {
    expect(getQualificationThresholdSeconds(120)).toBe(30);
  });

  it("caps at 30s for songs longer than 120s", () => {
    expect(getQualificationThresholdSeconds(600)).toBe(30);
  });

  it("returns 0 for a zero-duration song", () => {
    expect(getQualificationThresholdSeconds(0)).toBe(0);
  });

  it("returns 0 for a negative duration", () => {
    expect(getQualificationThresholdSeconds(-10)).toBe(0);
  });

  it("returns 0 for a non-numeric duration", () => {
    expect(getQualificationThresholdSeconds(NaN)).toBe(0);
    expect(getQualificationThresholdSeconds(undefined)).toBe(0);
    expect(getQualificationThresholdSeconds("not a number")).toBe(0);
  });

  it("rounds up fractional 25% thresholds (ceil)", () => {
    // 25% of 21 = 5.25 -> ceil to 6, still above the 5s floor.
    expect(getQualificationThresholdSeconds(21)).toBe(6);
  });
});

describe("isQualified", () => {
  it("is not qualified just below the threshold", () => {
    expect(isQualified(14, 60)).toBe(false);
  });

  it("is qualified exactly at the threshold", () => {
    expect(isQualified(15, 60)).toBe(true);
  });

  it("is qualified above the threshold", () => {
    expect(isQualified(16, 60)).toBe(true);
  });

  it("a 3s clip qualifies only once the whole clip is heard", () => {
    expect(isQualified(2, 3)).toBe(false);
    expect(isQualified(3, 3)).toBe(true);
  });
});
