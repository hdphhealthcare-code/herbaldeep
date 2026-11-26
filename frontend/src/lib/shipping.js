import { api } from '@/lib/api';

export const SHIPPING_STATUS = {
  not_pushed: { label: 'Not booked', tone: 'neutral' },
  booked: { label: 'Booked', tone: 'success' },
  cancelled: { label: 'Shipment cancelled', tone: 'danger' },
};

// Order of the platform buttons on the ship page and in filters
export const PROVIDER_ORDER = ['shipmozo', 'ekart', 'delhivery', 'shiprocket', 'xpressbees'];

export const PROVIDER_LABEL = { xpressbees: 'Xpressbees', shipmozo: 'Shipmozo', ekart: 'Ekart', delhivery: 'Delhivery', shiprocket: 'Shiprocket' };

/**
 * Loads the courier's own shipping label for an order.
 * Returns { src, kind: 'pdf' | 'image', external, release() }:
 *  - Xpressbees sends a URL (opened as is)
 *  - Shiprocket / Delhivery send a link too
 *  - Shipmozo (PNG) and Ekart (PDF) send base64, which browsers will not open as a data: link, so it becomes a blob URL
 */
export async function loadLabel(orderId) {
  const { label, type } = await api.get(`/shipping/orders/${orderId}/label`);
  if (type === 'url') {
    const isImage = /\.(png|jpe?g|gif|webp)(\?|$)/i.test(label);
    return { src: label, kind: isImage ? 'image' : 'pdf', external: true, release() {} };
  }
  const [head, b64] = label.split(',');
  const mime = head.match(/data:(.*?);/)?.[1] || 'application/pdf';
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const src = URL.createObjectURL(new Blob([bytes], { type: mime }));
  return { src, kind: mime.startsWith('image/') ? 'image' : 'pdf', external: false, mime, release: () => URL.revokeObjectURL(src) };
}

// Opens the label in a new tab. The tab is opened before the request so popup blockers allow it.
export async function openLabel(orderId) {
  const win = window.open('', '_blank');
  try {
    const label = await loadLabel(orderId);
    if (win) win.location.href = label.src;
    else window.location.href = label.src;
  } catch (err) {
    if (win) win.close();
    throw err;
  }
}
