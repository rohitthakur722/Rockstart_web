describe("sample 10-test run", () => {
  test("passing test 1", () => {
    expect(true).toBe(true);
  });

  test("passing test 2", () => {
    expect(1 + 1).toBe(2);
  });

  test("passing test 3", () => {
    expect("rockstar").toContain("star");
  });

  test("passing test 4", () => {
    expect(["music", "player"]).toHaveLength(2);
  });

  test("passing test 5", () => {
    expect({ status: "ok" }).toMatchObject({ status: "ok" });
  });

  test("passing test 6", () => {
    expect(Number.isFinite(108.281)).toBe(true);
  });

  test("passing test 7", () => {
    expect("7 passing").toMatch(/passing/);
  });

  test("failing test 1", () => {
    expect(10).toBe(11);
  });

  test("failing test 2", () => {
    expect("passed").toBe("failed");
  });

  test("failing test 3", () => {
    expect([1, 2, 3]).toHaveLength(4);
  });
});
