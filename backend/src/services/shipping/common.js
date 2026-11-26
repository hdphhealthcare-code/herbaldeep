const ApiError = require('../../utils/ApiError');

const digits = (v) => String(v || '').replace(/\D/g, '').slice(-10);
const optional = (v) => (v === '' || v === undefined || v === null ? undefined : v);
const str = (v) => (v === undefined || v === null ? '' : String(v));
const pick = (o, keys) => keys.map((k) => o?.[k]).find((v) => v !== undefined && v !== null && v !== '');

// Finds the first of `keys` anywhere inside a nested response (Shipmozo does not document every response shape)
const deepFind = (obj, keys, depth = 3) => {
  if (obj === null || typeof obj !== 'object' || depth < 0) return undefined;
  const direct = pick(obj, keys);
  if (direct !== undefined) return direct;
  for (const v of Object.values(obj)) {
    const found = deepFind(v, keys, depth - 1);
    if (found !== undefined) return found;
  }
  return undefined;
};

const requireCustomerAddress = (customer) => {
  if (!customer.pincode) throw new ApiError(400, 'Customer pincode is required for shipping. Edit the customer and add it');
  if (!customer.state) throw new ApiError(400, 'Customer state is required for shipping. Edit the customer and add it');
};

const readParcel = (input) => {
  const missing = ['weight', 'length', 'width', 'height'].filter((k) => !input[k]);
  if (missing.length) throw new ApiError(400, `Missing: ${missing.join(', ')}`);
  return {
    weight: Number(input.weight), // grams
    length: Number(input.length),
    width: Number(input.width),
    height: Number(input.height),
  };
};

const cheapest = (list) => {
  const priced = list.filter((c) => Number.isFinite(Number(c.rate)));
  return priced.sort((a, b) => Number(a.rate) - Number(b.rate))[0] || list[0];
};

module.exports = { digits, optional, str, pick, deepFind, requireCustomerAddress, readParcel, cheapest };
