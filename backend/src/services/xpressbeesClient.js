const { xpressbees } = require('../config/env');
const ApiError = require('../utils/ApiError');

const TIMEOUT_MS = 20000;
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

/**
 * Low-level Xpressbees HTTP client.
 * - Logs in with XPRESSBEES_EMAIL / XPRESSBEES_PASSWORD, caches the JWT and refreshes it before it expires
 * - Sends `Authorization: Bearer <token>`; on HTTP 401 it logs in again once and retries
 * - Xpressbees answers { status: true, data } on success and { status: false, message } on failure
 */
let cache = { token: null, exp: 0 };
let pending = null;

const isConfigured = () => Boolean(xpressbees.email && xpressbees.password);
const baseUrl = () => xpressbees.baseUrl.replace(/\/+$/, '');

const jwtExpiry = (token) => {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    return payload.exp ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
};

async function request(method, path, { body, token } = {}) {
  let res;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new ApiError(502, `Could not reach Xpressbees: ${err.message}`);
  }
  const json = await res.json().catch(() => null);
  return { res, json };
}

const failureMessage = (json) => {
  if (!json) return 'Request failed';
  if (json.message) return json.message;
  if (typeof json.data === 'string') return json.data;
  if (json.errors) return JSON.stringify(json.errors);
  return 'Request failed';
};

async function getToken(force = false) {
  if (!isConfigured()) {
    throw new ApiError(503, 'Xpressbees login is not configured. Add XPRESSBEES_EMAIL and XPRESSBEES_PASSWORD in backend/.env');
  }
  if (!force && cache.token && Date.now() < cache.exp - REFRESH_MARGIN_MS) return cache.token;

  if (!pending) {
    pending = (async () => {
      const { res, json } = await request('POST', '/users/login', {
        body: { email: xpressbees.email, password: xpressbees.password },
      });
      if (!json || json.status !== true || !json.data) {
        throw new ApiError(502, `Xpressbees login failed: ${failureMessage(json) || `HTTP ${res.status}`}`);
      }
      cache = { token: json.data, exp: jwtExpiry(json.data) || Date.now() + 2 * 60 * 60 * 1000 };
      return cache.token;
    })().finally(() => { pending = null; });
  }
  return pending;
}

async function call(method, path, body) {
  let { res, json } = await request(method, path, { body, token: await getToken() });
  if (res.status === 401) {
    ({ res, json } = await request(method, path, { body, token: await getToken(true) }));
  }
  if (json === null) throw new ApiError(502, `Xpressbees sent an invalid response (HTTP ${res.status})`);

  // The NDR action API answers with an array of per-AWB results
  if (Array.isArray(json)) return json;
  if (json.status !== true) {
    throw new ApiError(res.status >= 500 ? 502 : 400, `Xpressbees: ${failureMessage(json)}`);
  }
  return json.data !== undefined ? json.data : json;
}

module.exports = {
  get: (path) => call('GET', path),
  post: (path, body) => call('POST', path, body),
  getToken,
  isConfigured,
  resetToken: () => { cache = { token: null, exp: 0 }; },
};
