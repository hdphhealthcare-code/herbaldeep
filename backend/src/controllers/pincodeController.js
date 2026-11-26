const asyncHandler = require('../utils/asyncHandler');
const { lookup } = require('../services/pincodeService');

exports.lookup = asyncHandler(async (req, res) => {
  res.json(await lookup(req.params.pin));
});
