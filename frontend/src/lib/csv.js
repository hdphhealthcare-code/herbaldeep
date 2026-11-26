// Tiny CSV download helper (values are quoted, so commas and line breaks inside them are safe)
const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export function downloadCsv(filename, headers, rows) {
  const text = [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`\ufeff${text}`], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Reads CSV text (quotes, commas and line breaks inside quotes, BOM, Windows line endings) into [{ header: value }].
// Header names are lower-cased and trimmed, so "Mobile " and "mobile" are the same column.
export function parseCsv(text) {
  const src = String(text || '').replace(/^\ufeff/, '');
  const rows = []; let row = []; let cur = ''; let quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cur += '"'; i += 1; } else if (c === '"') quoted = false; else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cur); cur = ''; } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i += 1;
      row.push(cur); cur = '';
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((v) => v.trim() !== '')) rows.push(row);
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, String(r[i] ?? '').trim()])));
}
