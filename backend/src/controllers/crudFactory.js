const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { parseListQuery, paginated } = require('../utils/pagination');

/**
 * Generic CRUD handlers so simple modules (customers, employees...)
 * need no repeated code.
 * options: { searchFields, filterFields, populate, beforeCreate, sanitize, scope }
 *   scope(req) -> extra filter every read / write is limited to (e.g. an agent only reaches their own records)
 */
module.exports = (Model, options = {}) => {
  const { searchFields = [], filterFields = [], populate = '', beforeCreate, sanitize, scope = () => ({}) } = options;

  const list = asyncHandler(async (req, res) => {
    const { filter, page, limit, sort } = parseListQuery(req.query, { searchFields, filterFields });
    Object.assign(filter, scope(req)); // last, so a query string can never widen the scope
    const [data, total] = await Promise.all([
      Model.find(filter).populate(populate).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
      Model.countDocuments(filter),
    ]);
    res.json(paginated(data, total, page, limit));
  });

  const getOne = asyncHandler(async (req, res) => {
    const doc = await Model.findOne({ _id: req.params.id, ...scope(req) }).populate(populate);
    if (!doc) throw new ApiError(404, 'Record not found');
    res.json(doc);
  });

  const create = asyncHandler(async (req, res) => {
    let body = sanitize ? sanitize(req.body, req) : req.body;
    if (beforeCreate) body = await beforeCreate(body, req);
    const doc = await Model.create(body);
    res.status(201).json(doc);
  });

  const update = asyncHandler(async (req, res) => {
    const doc = await Model.findOne({ _id: req.params.id, ...scope(req) });
    if (!doc) throw new ApiError(404, 'Record not found');
    doc.set(sanitize ? sanitize(req.body, req) : req.body);
    await doc.save();
    res.json(doc);
  });

  const remove = asyncHandler(async (req, res) => {
    const doc = await Model.findOneAndDelete({ _id: req.params.id, ...scope(req) });
    if (!doc) throw new ApiError(404, 'Record not found');
    res.json({ message: 'Deleted successfully' });
  });

  return { list, getOne, create, update, remove };
};
