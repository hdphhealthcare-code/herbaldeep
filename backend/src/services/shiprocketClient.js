const { shiprocket } = require('../config/env');
const ApiError = require('../utils/ApiError');

const TIMEOUT_MS = 20000;
const REFRESH_MARGIN_MS = 60 * 60 * 1000;
const TOKEN_LIFE_MS = 9 * 24 * 60 * 60 * 1000; // Shiprocket tokens last 10 days; refreshed a day early

/**
 * Low-level Shiprocket HTTP client.
 * - POST /auth/login (email + password of the Shiprocket API user) gives a Bearer token; cached and refreshed before it expires
 * - On HTTP 401 it logs in again once and retries
 * - NEVER throws a 401 ourselves: the CRM frontend treats any 401 as "CRM session expired", so a wrong Shiprocket
 *   login is reported as 502 instead.
 */
let cache = { token: null, exp: 0 };
let pending = null;

const isConfigured = () => Boolean(shiprocket.email && shiprocket.password);
const baseUrl = () => shiprocket.baseUrl.replace(/\/+$/, '');

const flatten = (v) => {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(flatten).filter(Boolean).join(', ');
  if (typeof v === 'object') return Object.values(v).map(flatten).filter(Boolean).join(', ');
  return String(v);
};

// Shiprocket's 422 says "The given data was invalid." and puts the real reason in `errors`: show the reason
const failureMessage = (json, res) => flatten(json?.errors) || flatten(json?.message) || flatten(json?.error) || flatten(json?.msg) || `HTTP ${res.status}`;

async function request(method, path, { body, query, token } = {}) {
  const qs = query ? `?${new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString()}` : '';
  let res;
  try {
    res = await fetch(`${baseUrl()}${path}${qs}`, {
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
    throw new ApiError(502, `Could not reach Shiprocket: ${err.message}`);
  }
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  return { res, json };
}

async function getToken(force = false) {
  if (!isConfigured()) {
    throw new ApiError(503, 'Shiprocket login is not configured. Add SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD in backend/.env and restart the server');
  }
  if (!force && cache.token && Date.now() < cache.exp - REFRESH_MARGIN_MS) return cache.token;
  if (!pending) {
    pending = (async () => {
      const { res, json } = await request('POST', '/auth/login', { body: { email: shiprocket.email, password: shiprocket.password } });
      if (!res.ok || !json?.token) throw new ApiError(502, `Shiprocket login failed: ${failureMessage(json, res)}. Use an API user created in Shiprocket > Settings > API`);
      cache = { token: json.token, exp: Date.now() + TOKEN_LIFE_MS };
      return cache.token;
    })().finally(() => { pending = null; });
  }
  return pending;
}

// `soft` lets the caller read non-2xx answers itself (Shiprocket answers 404 for "no courier serviceable")
async function call(method, path, { body, query, soft = false } = {}) {
  let out = await request(method, path, { body, query, token: await getToken() });
  if (out.res.status === 401) out = await request(method, path, { body, query, token: await getToken(true) });
  const { res, json } = out;
  if (soft) return { status: res.status, ok: res.ok, json: json || {} };
  if (json === null) throw new ApiError(502, `Shiprocket sent an unexpected response (HTTP ${res.status})`);
  if (!res.ok) throw new ApiError(res.status >= 500 ? 502 : 400, `Shiprocket: ${failureMessage(json, res)}`);
  return json;
}

module.exports = {
  isConfigured,
  getToken,
  get: (path, query, opts) => call('GET', path, { query, ...opts }),
  post: (path, body, opts) => call('POST', path, { body, ...opts }),
  failureMessage,
  resetToken: () => { cache = { token: null, exp: 0 }; },
};
