const { ekart } = require('../config/env');
const ApiError = require('../utils/ApiError');

const TIMEOUT_MS = 25000;
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

/**
 * Low-level Ekart HTTP client.
 * - POST /integrations/v2/auth/token/{client_id} with username + password gives a Bearer token (valid ~24h); cached and refreshed
 * - Sends `Authorization: Bearer <token>`; on HTTP 401 it logs in again once and retries
 * - Errors come as { statusCode, message, description } (HTTP 4xx/5xx) or { status: false, remark } (HTTP 200)
 * - NEVER throws a 401 ourselves: the frontend treats any 401 as "CRM session expired" and redirects to /login
 */
let cache = { token: null, exp: 0 };
let pending = null;

const isConfigured = () => Boolean(ekart.clientId && ekart.username && ekart.password);
const baseUrl = () => ekart.baseUrl.replace(/\/+$/, '');

async function request(method, path, { body, token, binary } = {}) {
  let res;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: binary ? '*/*' : 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new ApiError(502, `Could not reach Ekart: ${err.message}`);
  }
  const type = res.headers.get('content-type') || '';
  if (binary && res.ok && !type.includes('json')) {
    return { res, json: null, buffer: Buffer.from(await res.arrayBuffer()) };
  }
  const json = await res.json().catch(() => null);
  return { res, json, buffer: null };
}

const failureMessage = (json, res) => json?.message || json?.description || json?.remark || json?.error || `HTTP ${res.status}`;

async function getToken(force = false) {
  if (!isConfigured()) {
    throw new ApiError(503, 'Ekart login is not configured. Add EKART_CLIENT_ID, EKART_USERNAME and EKART_PASSWORD in backend/.env');
  }
  if (!force && cache.token && Date.now() < cache.exp - REFRESH_MARGIN_MS) return cache.token;

  if (!pending) {
    pending = (async () => {
      const { res, json } = await request('POST', `/integrations/v2/auth/token/${encodeURIComponent(ekart.clientId)}`, {
        body: { username: ekart.username, password: ekart.password },
      });
      if (!res.ok || !json?.access_token) {
        // 502, not 401: wrong Ekart credentials must not log the CRM user out
        throw new ApiError(502, `Ekart login failed: ${failureMessage(json, res)}`);
      }
      cache = { token: json.access_token, exp: Date.now() + (Number(json.expires_in) || 3600) * 1000 };
      return cache.token;
    })().finally(() => { pending = null; });
  }
  return pending;
}

async function call(method, path, { body, binary } = {}) {
  let out = await request(method, path, { body, binary, token: await getToken() });
  if (out.res.status === 401) out = await request(method, path, { body, binary, token: await getToken(true) });
  const { res, json, buffer } = out;
  if (buffer) return buffer;
  if (json === null) throw new ApiError(502, `Ekart sent an invalid response (HTTP ${res.status})`);
  if (!res.ok) throw new ApiError(res.status >= 500 ? 502 : 400, `Ekart: ${failureMessage(json, res)}`);
  if (json && !Array.isArray(json) && json.status === false) throw new ApiError(400, `Ekart: ${failureMessage(json, res)}`);
  return json;
}

module.exports = {
  get: (path) => call('GET', path),
  post: (path, body, opts) => call('POST', path, { body, ...opts }),
  put: (path, body) => call('PUT', path, { body }),
  del: (path) => call('DELETE', path),
  getToken,
  isConfigured,
  resetToken: () => { cache = { token: null, exp: 0 }; },
};
