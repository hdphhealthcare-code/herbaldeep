const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { parseListQuery, paginated } = require('../utils/pagination');

/**
 * Generic CRUD handlers so simple modules (zones, customers, employees...)
 * need no repeated code.
 * options: { searchFields, filterFields, populate, beforeCreate, sanitize }
 */
module.exports = (Model, options = {}) => {
  const { searchFields = [], filterFields = [], populate = '', beforeCreate, sanitize } = options;

  const list = asyncHandler(async (req, res) => {
    const { filter, page, limit, sort } = parseListQuery(req.query, { searchFields, filterFields });
    const [data, total] = await Promise.all([
      Model.find(filter).populate(populate).sort(sort).skip((page - 1) * limit).limit(limit),
      Model.countDocuments(filter),
    ]);
    res.json(paginated(data, total, page, limit));
  });

  const getOne = asyncHandler(async (req, res) => {
    const doc = await Model.findById(req.params.id).populate(populate);
    if (!doc) throw new ApiError(404, 'Record not found');
    res.json(doc);
  });

  const create = asyncHandler(async (req, res) => {
    let body = sanitize ? sanitize(req.body) : req.body;
    if (beforeCreate) body = await beforeCreate(body, req);
    const doc = await Model.create(body);
    res.status(201).json(doc);
  });

  const update = asyncHandler(async (req, res) => {
    const doc = await Model.findById(req.params.id);
    if (!doc) throw new ApiError(404, 'Record not found');
    doc.set(sanitize ? sanitize(req.body) : req.body);
    await doc.save();
    res.json(doc);
  });

  const remove = asyncHandler(async (req, res) => {
    const doc = await Model.findByIdAndDelete(req.params.id);
    if (!doc) throw new ApiError(404, 'Record not found');
    res.json({ message: 'Deleted successfully' });
  });

  return { list, getOne, create, update, remove };
};
