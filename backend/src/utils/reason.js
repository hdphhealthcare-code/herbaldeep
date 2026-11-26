/**
 * "Exact reason" helper for courier answers. Couriers hide the real reason in different places
 * (message, description, errors, data, remarks...). This reads every place that holds text, flattens nested
 * objects / arrays into "field: reason" and removes repeats, so the user sees the courier's own words.
 */
const flat = (v, depth = 0) => {
  if (v === undefined || v === null || v === '' || depth > 4) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map((x) => flat(x, depth + 1)).filter(Boolean).join('; ');
  if (typeof v === 'object') {
    return Object.entries(v).map(([k, x]) => { const t = flat(x, depth + 1); return t ? `${/^\d+$/.test(k) ? '' : `${k}: `}${t}` : ''; }).filter(Boolean).join('; ');
  }
  return '';
};

exports.flat = flat;

exports.reasonOf = (json, keys, fallback = '') => {
  if (typeof json === 'string') return json.trim() || fallback;
  const parts = keys.map((k) => flat(json?.[k])).filter(Boolean).filter((t, i, a) => a.indexOf(t) === i);
  return (parts.join(' - ') || fallback).slice(0, 600);
};

// "Could not reach X": say why (DNS, refused, timeout, certificate...)
exports.networkReason = (err) => {
  const code = err?.cause?.code || err?.code;
  const why = err?.name === 'TimeoutError' || err?.name === 'AbortError' ? 'timed out' : err?.message;
  return `${why}${code ? ` (${code})` : ''}`;
};
