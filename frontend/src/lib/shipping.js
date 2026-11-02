import { api } from '@/lib/api';

export const SHIPPING_STATUS = {
  not_pushed: { label: 'Not booked', tone: 'neutral' },
  booked: { label: 'Booked', tone: 'success' },
  cancelled: { label: 'Shipment cancelled', tone: 'danger' },
};

export const PROVIDER_LABEL = { xpressbees: 'Xpressbees', shipmozo: 'Shipmozo', ekart: 'Ekart' };

// Opens the shipping label. A URL opens directly; Shipmozo sends a base64 image, which browsers will not open
// as a data: link, so it is turned into a blob first. The tab is opened before the request so popup blockers allow it.
export async function openLabel(orderId) {
  const win = window.open('', '_blank');
  try {
    const { label, type } = await api.get(`/shipping/orders/${orderId}/label`);
    if (type === 'url') {
      if (win) win.location.href = label;
      else window.location.href = label;
      return;
    }
    const [head, b64] = label.split(',');
    const mime = head.match(/data:(.*?);/)?.[1] || 'image/png';
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    if (win) win.location.href = url;
    else window.location.href = url;
  } catch (err) {
    if (win) win.close();
    throw err;
  }
}
