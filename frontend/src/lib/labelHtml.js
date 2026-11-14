import JsBarcode from 'jsbarcode';
import qrcode from 'qrcode-generator';
import { BRAND } from '@/lib/brand';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => `Rs ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const barcodeSvg = (value) => {
  if (!value) return '';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  try {
    JsBarcode(svg, String(value), { format: 'CODE128', displayValue: true, height: 46, width: 2, fontSize: 13, margin: 0 });
  } catch {
    return '';
  }
  return svg.outerHTML;
};

// QR code of the order number (HBD-00001), drawn as an inline SVG so it prints sharply at any size
const qrSvg = (text) => {
  try {
    const qr = qrcode(0, 'M');
    qr.addData(String(text));
    qr.make();
    const n = qr.getModuleCount();
    let path = '';
    for (let r = 0; r < n; r += 1) for (let c = 0; c < n; c += 1) if (qr.isDark(r, c)) path += `M${c} ${r}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><path d="${path}" fill="#000"/></svg>`;
  } catch {
    return '';
  }
};

const clip = (text, max) => { const t = String(text || '').replace(/\s+/g, ' ').trim(); return t.length > max ? `${t.slice(0, max - 1)}...` : t; };

/**
 * Printable 4x6 inch shipping label built by the CRM:
 *   brand + courier + payment box  |  AWB barcode  |  ship to (the customer's phone number is NEVER printed)
 *   order number + QR code + parcel  |  ship from  |  items table (item, qty, amount)  |  GST + totals  |  order note
 * Returns an HTML fragment (every value is escaped).
 */
export function buildLabelHtml({ order, warehouse }) {
  const s = order.shipping || {};
  const c = order.customer || {};
  const awb = s.awb || order.courier?.awb || '';
  const cod = s.paymentType === 'COD' || order.payment?.type === 'COD';
  const codAmount = s.codAmount || order.payment?.codAmount || order.totalAmount;
  const from = warehouse || order.warehouse || {};
  const fromLine = [from.address, from.address2, from.city, from.state, from.pincode].filter(Boolean).map(esc).join(', ');
  const units = (order.items || []).reduce((n, i) => n + Number(i.quantity || 0), 0);
  const inclusive = Boolean(order.taxInclusive);
  const rate = order.gstRate ?? 5;

  const rows = (order.items || []).map((i) => `
    <tr><td class="it">${esc(clip(i.name, 46))}${i.sku ? `<div class="sku">SKU ${esc(i.sku)}</div>` : ''}</td><td class="q">${esc(i.quantity)}</td><td class="a">${esc(money(i.lineTotal || i.price * i.quantity))}</td></tr>`).join('');

  const gstLine = order.gstAmount
    ? `<div class="kv"><span>${inclusive ? `GST ${esc(rate)}% (included)` : `GST ${esc(rate)}%`}</span><b>${esc(money(order.gstAmount))}</b></div>`
    : '';
  const sellerGst = BRAND.gstin ? `<div class="kv"><span>Seller GSTIN</span><b>${esc(BRAND.gstin)}</b></div>` : '';
  const buyerGst = order.gstNumber ? `<div class="kv"><span>Buyer GSTIN</span><b>${esc(order.gstNumber)}</b></div>` : '';
  const note = clip(order.notes, 150);

  return `
<div class="lbl">
  <div class="top">
    <div class="brand"><img src="${esc(typeof window !== 'undefined' ? new URL(BRAND.logo, window.location.origin).href : BRAND.logo)}" alt="" width="26" height="26"/><b>${esc(BRAND.name.toUpperCase())}</b></div>
    <div class="pay ${cod ? 'cod' : ''}">${cod ? `COD<span>${esc(money(codAmount))}</span>` : 'PREPAID<span>Do not collect</span>'}</div>
  </div>
  <div class="courier"><b>${esc(s.courierName || 'Courier')}</b><span>${esc(s.provider ? s.provider[0].toUpperCase() + s.provider.slice(1) : '')}${s.mode ? ` &middot; ${s.mode === 'air' ? 'Air' : 'Surface'}` : ''}</span></div>
  <div class="bar">${barcodeSvg(awb)}</div>
  <div class="box to">
    <div class="cap">SHIP TO</div>
    <b class="nm">${esc(c.name)}</b>
    <div class="ad">${[c.address, c.area].filter(Boolean).map(esc).join(', ')}</div>
    <div class="ad">${[c.city, c.state].filter(Boolean).map(esc).join(', ')} <b class="pin">${esc(c.pincode)}</b></div>
  </div>
  <div class="grid">
    <div class="box ord">
      <div class="cap">ORDER</div>
      <b class="oid">${esc(order.orderId)}</b>
      <div class="sm">${esc(order.orderDate ? new Date(order.orderDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '')}</div>
      <div class="sm">${esc(s.weight || order.parcel?.weight ? `${s.weight || order.parcel.weight} g` : '')}${(s.length || order.parcel?.length) ? ` &middot; ${esc(s.length || order.parcel.length)}x${esc(s.width || order.parcel.width)}x${esc(s.height || order.parcel.height)} cm` : ''}</div>
    </div>
    <div class="qr">${qrSvg(order.orderId)}</div>
    <div class="box frm"><div class="cap">SHIP FROM</div><b>${esc(from.title || '')}</b><div class="sm">${fromLine}${from.phone ? ` &middot; ${esc(from.phone)}` : ''}</div></div>
  </div>
  <table class="items">
    <thead><tr><th>Item</th><th class="q">Qty</th><th class="a">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td>Total items</td><td class="q">${esc(units)}</td><td class="a">${esc(money(order.totalAmount))}</td></tr></tfoot>
  </table>
  ${(gstLine || sellerGst || buyerGst) ? `<div class="gst">${gstLine}${buyerGst}${sellerGst}</div>` : ''}
  ${note ? `<div class="note"><span class="cap">NOTE</span> ${esc(note)}</div>` : ''}
  <div class="foot">${esc(BRAND.name)} &middot; thank you for your order</div>
</div>`;
}

export const LABEL_CSS = `
  .lbl{width:384px;box-sizing:border-box;border:2px solid #000;padding:7px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#000;background:#fff;line-height:1.35}
  .lbl *{box-sizing:border-box}
  .lbl .top{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-bottom:6px;border-bottom:1.5px solid #000}
  .lbl .brand{display:flex;align-items:center;gap:7px;font-size:14px;letter-spacing:.12em} .lbl .brand img{border-radius:6px}
  .lbl .pay{min-width:104px;border:2px solid #000;padding:3px 8px;font-weight:700;text-align:center;font-size:13px;line-height:1.15}
  .lbl .pay span{display:block;font-size:12px;font-weight:700} .lbl .pay.cod{background:#000;color:#fff}
  .lbl .pay:not(.cod) span{font-size:8px;font-weight:400;letter-spacing:.04em}
  .lbl .courier{display:flex;justify-content:space-between;align-items:baseline;padding:5px 0 2px;font-size:12px} .lbl .courier span{font-size:10px;color:#333}
  .lbl .bar{text-align:center;padding:4px 0 7px;border-bottom:1px dashed #000;margin-bottom:6px} .lbl .bar svg{max-width:100%;height:auto}
  .lbl .box{border:1px solid #000;padding:5px 6px}
  .lbl .cap{font-size:8px;letter-spacing:.1em;color:#444;font-weight:700}
  .lbl .to{margin-bottom:6px} .lbl .nm{display:block;font-size:14px;margin:1px 0 2px} .lbl .ad{font-size:12px} .lbl .pin{font-size:16px;letter-spacing:.04em}
  .lbl .grid{display:grid;grid-template-columns:1fr 66px 1.25fr;gap:6px;margin-bottom:6px;align-items:stretch}
  .lbl .oid{display:block;font-size:14px;letter-spacing:.02em;margin:1px 0} .lbl .sm{font-size:9px;color:#333;margin-top:1px}
  .lbl .qr{display:flex;align-items:center;justify-content:center;border:1px solid #000;padding:3px} .lbl .qr svg{width:100%;height:auto;display:block}
  .lbl .items{width:100%;border-collapse:collapse;margin-bottom:5px;font-size:11px}
  .lbl .items th{font-size:8px;letter-spacing:.08em;text-align:left;border-bottom:1.5px solid #000;padding:2px 3px;color:#333}
  .lbl .items td{padding:3px;border-bottom:1px solid #bbb;vertical-align:top} .lbl .items .sku{font-size:8px;color:#444}
  .lbl .items .q{width:34px;text-align:center} .lbl .items .a{width:76px;text-align:right}
  .lbl .items tfoot td{border-top:1.5px solid #000;border-bottom:0;font-weight:700;padding-top:3px}
  .lbl .gst{border:1px solid #000;padding:3px 6px;margin-bottom:5px} .lbl .kv{display:flex;justify-content:space-between;font-size:10px;padding:1px 0} .lbl .kv b{letter-spacing:.03em}
  .lbl .note{border:1px dashed #000;padding:3px 6px;font-size:10px;margin-bottom:5px}
  .lbl .foot{text-align:center;font-size:8px;color:#555}
`;

// Opens a clean window sized for a 4x6 label and prints it
export function printLabelHtml(html) {
  const w = window.open('', '_blank', 'width=480,height=720');
  if (!w) return false;
  w.document.write(`<!doctype html><html><head><title>Shipping label</title><style>@page{size:4in 6in;margin:3mm}body{margin:0}${LABEL_CSS}</style></head><body>${html}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
  return true;
}
