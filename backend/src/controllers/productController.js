const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { parseListQuery, paginated } = require('../utils/pagination');
const { changeStock } = require('../services/inventoryService');
const crud = require('./crudFactory');

// Opening stock is logged as a movement so the ledger always reconciles.
const base = crud(Product, {
  searchFields: ['name', 'sku'],
  filterFields: ['isActive'],
});

exports.base = base;

// Admin sees every product; an agent sees active products only.
exports.listForRole = (req, res, next) => {
  if (req.user.role === 'agent') req.query.isActive = 'true';
  return base.list(req, res, next);
};

exports.create = asyncHandler(async (req, res) => {
  const { stock = 0, ...rest } = req.body;
  const product = await Product.create({ ...rest, stock: 0 });
  if (Number(stock) > 0) {
    await changeStock({
      productId: product._id, change: Number(stock), type: 'in',
      reason: 'Opening stock', userId: req.user._id,
    });
  }
  res.status(201).json(await Product.findById(product._id));
});

// Stock cannot be edited directly via update, only via adjust endpoint.
exports.update = asyncHandler(async (req, res) => {
  const { stock, ...rest } = req.body;
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  product.set(rest);
  await product.save();
  res.json(product);
});

exports.adjustStock = asyncHandler(async (req, res) => {
  const { type, quantity, reason } = req.body;
  const qty = Number(quantity);
  if (!qty || qty <= 0) throw new ApiError(400, 'Quantity must be greater than zero');
  // in = add stock, out/adjustment = reduce stock
  const change = type === 'in' ? qty : -qty;
  const product = await changeStock({
    productId: req.params.id, change, type: type === 'in' ? 'in' : 'adjustment',
    reason: reason || 'Manual adjustment', userId: req.user._id,
  });
  res.json(product);
});

exports.movements = asyncHandler(async (req, res) => {
  const { page, limit } = parseListQuery(req.query);
  const filter = req.query.product ? { product: req.query.product } : {};
  const [data, total] = await Promise.all([
    StockMovement.find(filter).populate('product', 'name sku').populate('createdBy', 'name')
      .sort('-createdAt').skip((page - 1) * limit).limit(limit),
    StockMovement.countDocuments(filter),
  ]);
  res.json(paginated(data, total, page, limit));
});

exports.lowStock = asyncHandler(async (req, res) => {
  const data = await Product.find({ isActive: true, $expr: { $lte: ['$stock', '$reorderLevel'] } }).sort('stock');
  res.json(data);
});
