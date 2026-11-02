const ApiError = require('../../utils/ApiError');

// Courier platforms available in the CRM. To add one more courier, create a provider file with the same methods
// (see xpressbees.js / shipmozo.js) and register it here.
const providers = {
  xpressbees: require('./xpressbees'),
  shipmozo: require('./shipmozo'),
  ekart: require('./ekart'),
};

const get = (id) => {
  const p = providers[id];
  if (!p) throw new ApiError(400, `Unknown courier provider: ${id}`);
  return p;
};

const getConfigured = (id) => {
  const p = get(id);
  if (!p.isConfigured()) throw new ApiError(503, `${p.displayName} is not configured. Add its keys in backend/.env and restart the server`);
  return p;
};

const meta = (p) => ({ id: p.id, label: p.displayName, configured: p.isConfigured(), capabilities: p.capabilities, autoHint: p.autoHint });

module.exports = {
  get,
  getConfigured,
  list: () => Object.values(providers).map(meta),
  configured: () => Object.values(providers).filter((p) => p.isConfigured()),
};
