const { delhivery } = require('../config/env');
const ApiError = require('../utils/ApiError');

const TIMEOUT_MS = 25000;

/**
 * Low-level Delhivery HTTP client (Express / B2C API).
 *  - Auth: one static API token, sent as `Authorization: Token <token>` (no login step, nothing to refresh)
 *  - Most endpoints take/return JSON; order creation (cmu/create.json) takes a form body `format=json&data=<json>`
 *  - NEVER throws a 401 ourselves: the CRM frontend treats any 401 as "CRM session expired" and redirects to /login,
 *    so a wrong Delhivery token is reported as 502 instead.
 */
const isConfigured = () => Boolean(delhivery.token);
const baseUrl = () => delhivery.baseUrl.replace(/\/+$/, '');

const failureMessage = (json, res) => {
  const first = (v) => (Array.isArray(v) ? v.filter(Boolean).join(', ') : v);
  return first(json?.rmk) || first(json?.error) || first(json?.message) || first(json?.remark) || first(json?.Error)
    || (typeof json?.detail === 'string' ? json.detail : '') || `HTTP ${res.status}`;
};

async function call(method, path, { query, json, form, binary } = {}) {
  if (!isConfigured()) throw new ApiError(503, 'Delhivery is not configured. Add DELHIVERY_API_TOKEN in backend/.env and restart the server');
  const qs = query ? `?${new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString()}` : '';
  let res;
  try {
    res = await fetch(`${baseUrl()}${path}${qs}`, {
      method,
      headers: {
        Authorization: `Token ${delhivery.token}`,
        Accept: binary ? '*/*' : 'application/json',
        ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(form !== undefined ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
      body: json !== undefined ? JSON.stringify(json) : form !== undefined ? new URLSearchParams(form).toString() : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new ApiError(502, `Could not reach Delhivery: ${err.message}`);
  }

  if (res.status === 401 || res.status === 403) {
    throw new ApiError(502, 'Delhivery rejected the API token. Check DELHIVERY_API_TOKEN, and that DELHIVERY_BASE_URL matches it (production token = https://track.delhivery.com, staging token = https://staging-express.delhivery.com)');
  }
  const type = res.headers.get('content-type') || '';
  if (binary && res.ok && !type.includes('json')) return { buffer: Buffer.from(await res.arrayBuffer()), type };

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  if (data === null) throw new ApiError(502, `Delhivery sent an unexpected response (HTTP ${res.status})`);
  if (!res.ok) throw new ApiError(res.status >= 500 ? 502 : 400, `Delhivery: ${failureMessage(data, res)}`);
  return data;
}

module.exports = {
  isConfigured,
  get: (path, query, opts) => call('GET', path, { query, ...opts }),
  postJson: (path, json) => call('POST', path, { json }),
  postForm: (path, form) => call('POST', path, { form }),
  failureMessage,
};
