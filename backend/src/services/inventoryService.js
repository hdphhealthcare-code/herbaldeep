const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const ApiError = require('../utils/ApiError');

// Atomically change stock by `change` (negative = reduce) and log the movement.
exports.changeStock = async ({ productId, change, type, reason, orderId, userId }) => {
  const query = { _id: productId };
  if (change < 0) query.stock = { $gte: Math.abs(change) }; // prevent negative stock

  const product = await Product.findOneAndUpdate(query, { $inc: { stock: change } }, { new: true });
  if (!product) {
    const exists = await Product.findById(productId);
    if (!exists) throw new ApiError(404, 'Product not found');
    throw new ApiError(400, `Insufficient stock for ${exists.name} (available: ${exists.stock})`);
  }
  await StockMovement.create({
    product: product._id,
    type,
    quantity: change,
    balance: product.stock,
    reason,
    order: orderId,
    createdBy: userId,
  });
  return product;
};
