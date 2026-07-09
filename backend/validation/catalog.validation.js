const ORDER_VALUES = new Set(["asc", "desc"]);

const sanitizeSearch = (raw) => {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, 200);
};

const sanitizeIdFilter = (raw) => {
  if (raw === undefined || raw === null || raw === "") return null;
  const value = String(raw).trim();
  return /^\d+$/.test(value) ? value : null;
};

const sanitizeYearFilter = (raw) => {
  if (raw === undefined || raw === null || raw === "") return null;
  const num = Number(raw);
  return Number.isInteger(num) && num >= 1900 && num <= 2100 ? num : null;
};

const resolveSortAndOrder = (query, sortColumns, defaultSort) => {
  const requestedSort = typeof query.sort === "string" ? query.sort : defaultSort;
  const sort = Object.prototype.hasOwnProperty.call(sortColumns, requestedSort) ? requestedSort : defaultSort;

  const requestedOrder = typeof query.order === "string" ? query.order.toLowerCase() : "desc";
  const order = ORDER_VALUES.has(requestedOrder) ? requestedOrder.toUpperCase() : "DESC";

  return { sort, order };
};

const parseSongListQuery = (query = {}, sortColumns, defaultSort) => {
  const { sort, order } = resolveSortAndOrder(query, sortColumns, defaultSort);

  return {
    search: sanitizeSearch(query.search),
    sort,
    order,
    artistId: sanitizeIdFilter(query.artistId),
    albumId: sanitizeIdFilter(query.albumId),
    genreId: sanitizeIdFilter(query.genreId),
    releaseYear: sanitizeYearFilter(query.releaseYear),
  };
};

module.exports = {
  sanitizeSearch,
  sanitizeIdFilter,
  sanitizeYearFilter,
  resolveSortAndOrder,
  parseSongListQuery,
};
