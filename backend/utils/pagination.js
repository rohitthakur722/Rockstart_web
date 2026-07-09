const getDefaultLimit = () => Number(process.env.CATALOG_DEFAULT_PAGE_SIZE) || 20;
const getMaxLimit = () => Number(process.env.CATALOG_MAX_PAGE_SIZE) || 100;

const parsePagination = (query = {}) => {
  const defaultLimit = getDefaultLimit();
  const maxLimit = getMaxLimit();

  let page = parseInt(query.page, 10);
  if (!Number.isInteger(page) || page < 1) page = 1;

  let limit = parseInt(query.limit, 10);
  if (!Number.isInteger(limit) || limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;

  const offset = (page - 1) * limit;

  return { page, limit, offset };
};

const buildPaginationMeta = ({ page, limit, totalItems }) => {
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);

  return {
    page,
    limit,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1 && page <= totalPages + 1,
  };
};

module.exports = { parsePagination, buildPaginationMeta };
