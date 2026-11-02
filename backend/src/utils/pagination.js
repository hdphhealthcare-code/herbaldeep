// Builds { filter, page, limit, sort } from query string.
exports.parseListQuery = (query, { searchFields = [], filterFields = [] } = {}) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(query.limit, 10) || 10, 100);
  const filter = {};

  filterFields.forEach((f) => {
    if (query[f] !== undefined && query[f] !== '') filter[f] = query[f];
  });

  if (query.search && searchFields.length) {
    const rx = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = searchFields.map((f) => ({ [f]: rx }));
  }

  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) filter.createdAt.$lte = new Date(`${query.to}T23:59:59.999Z`);
  }
  return { filter, page, limit, sort: query.sort || '-createdAt' };
};

exports.paginated = (data, total, page, limit) => ({
  data,
  meta: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
});
