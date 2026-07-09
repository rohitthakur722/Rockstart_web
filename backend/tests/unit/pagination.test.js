const { parsePagination, buildPaginationMeta } = require("../../utils/pagination");

describe("parsePagination", () => {
  const originalDefault = process.env.CATALOG_DEFAULT_PAGE_SIZE;
  const originalMax = process.env.CATALOG_MAX_PAGE_SIZE;

  beforeEach(() => {
    process.env.CATALOG_DEFAULT_PAGE_SIZE = "10";
    process.env.CATALOG_MAX_PAGE_SIZE = "50";
  });

  afterAll(() => {
    process.env.CATALOG_DEFAULT_PAGE_SIZE = originalDefault;
    process.env.CATALOG_MAX_PAGE_SIZE = originalMax;
  });

  it("defaults page to 1 and limit to the configured default when the query is empty", () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: 10, offset: 0 });
  });

  it("computes offset from page and limit", () => {
    expect(parsePagination({ page: "3", limit: "10" })).toEqual({ page: 3, limit: 10, offset: 20 });
  });

  it("falls back to page 1 for a non-integer or zero/negative page", () => {
    expect(parsePagination({ page: "0" }).page).toBe(1);
    expect(parsePagination({ page: "-5" }).page).toBe(1);
    expect(parsePagination({ page: "abc" }).page).toBe(1);
    expect(parsePagination({ page: "1.5" }).page).toBe(1);
  });

  it("falls back to the default limit for a non-integer or zero/negative limit", () => {
    expect(parsePagination({ limit: "0" }).limit).toBe(10);
    expect(parsePagination({ limit: "-5" }).limit).toBe(10);
    expect(parsePagination({ limit: "abc" }).limit).toBe(10);
  });

  it("caps the limit at the configured maximum", () => {
    expect(parsePagination({ limit: "9999" }).limit).toBe(50);
  });

  it("accepts a limit exactly at the maximum", () => {
    expect(parsePagination({ limit: "50" }).limit).toBe(50);
  });

  it("uses env-driven defaults when they change", () => {
    process.env.CATALOG_DEFAULT_PAGE_SIZE = "5";
    process.env.CATALOG_MAX_PAGE_SIZE = "15";
    expect(parsePagination({})).toEqual({ page: 1, limit: 5, offset: 0 });
    expect(parsePagination({ limit: "999" }).limit).toBe(15);
  });
});

describe("buildPaginationMeta", () => {
  it("computes totalPages and next/previous flags for a middle page", () => {
    const meta = buildPaginationMeta({ page: 2, limit: 10, totalItems: 35 });
    expect(meta).toEqual({
      page: 2,
      limit: 10,
      totalItems: 35,
      totalPages: 4,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  it("has no next page on the last page", () => {
    const meta = buildPaginationMeta({ page: 4, limit: 10, totalItems: 35 });
    expect(meta.hasNextPage).toBe(false);
  });

  it("has no previous page on the first page", () => {
    const meta = buildPaginationMeta({ page: 1, limit: 10, totalItems: 35 });
    expect(meta.hasPreviousPage).toBe(false);
  });

  it("reports zero total pages for zero items", () => {
    const meta = buildPaginationMeta({ page: 1, limit: 10, totalItems: 0 });
    expect(meta.totalPages).toBe(0);
    expect(meta.hasNextPage).toBe(false);
  });
});
