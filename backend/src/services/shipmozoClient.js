const { shipmozo } = require('../config/env');
const ApiError = require('../utils/ApiError');

const TIMEOUT_MS = 20000;

/**
 * Low-level Shipmozo HTTP client.
 * - Sends public-key / private-key headers on every request
 * - Base URL never has a trailing slash (avoids CORS/route issues per docs)
 * - Shipmozo answers HTTP 200 with { result: "0" } on failure, so we convert that to an ApiError
 */
async function call(method, path, { body, query, auth = true } = {}) {
  if (auth && (!shipmozo.publicKey || !shipmozo.privateKey)) {
    throw new ApiError(503, 'Shipmozo keys are not configured. Add SHIPMOZO_PUBLIC_KEY and SHIPMOZO_PRIVATE_KEY in backend/.env');
  }

  const base = shipmozo.baseUrl.replace(/\/+$/, '');
  const qs = query ? `?${new URLSearchParams(query).toString()}` : '';
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    headers['public-key'] = shipmozo.publicKey;
    headers['private-key'] = shipmozo.privateKey;
  }

  let res;
  try {
    res = await fetch(`${base}${path}${qs}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new ApiError(502, `Could not reach Shipmozo: ${err.message}`);
  }

  const json = await res.json().catch(() => null);
  if (!json) throw new ApiError(502, `Shipmozo sent an invalid response (HTTP ${res.status})`);

  if (String(json.result) !== '1') {
    const detail = json.data && json.data.error ? `: ${json.data.error}` : '';
    throw new ApiError(res.status >= 500 ? 502 : 400, `Shipmozo: ${json.message || 'Request failed'}${detail}`);
  }
  return json.data;
}

module.exports = {
  get: (path, query) => call('GET', path, { query }),
  post: (path, body, opts = {}) => call('POST', path, { body, ...opts }),
  isConfigured: () => Boolean(shipmozo.publicKey && shipmozo.privateKey),
};
