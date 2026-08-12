import db from './db.js';

const getSetting = (key, def = '') => {
  const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return r ? r.value : def;
};

export const waNumber = () => {
  let n = getSetting('whatsapp_number', '');
  n = n.replace(/\D/g, '');
  return n ? '212' + n.replace(/^0+/, '') : '';
};

export function waLink(message) {
  const num = waNumber();
  if (!num) return null;
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

export function waLinkTo(phone, message) {
  let n = String(phone || '').replace(/\D/g, '');
  if (!n) return null;
  if (n.startsWith('0')) n = '212' + n.slice(1);
  return `https://wa.me/${n}?text=${encodeURIComponent(message)}`;
}

export function addNotification(userId, title, body, link = '') {
  db.prepare('INSERT INTO notifications (user_id, title, body, link) VALUES (?,?,?,?)')
    .run(userId, title, body, link);
}

export async function sendWhatsApp(phone, message) {
  const api = getSetting('whatsapp_api', '');
  const token = getSetting('whatsapp_token', '');
  if (!api || !token || !phone) return false;
  let n = String(phone).replace(/\D/g, '');
  if (n.startsWith('0')) n = '212' + n.slice(1);
  try {
    const r = await fetch(api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ to: n, message, token }),
    });
    return r.ok;
  } catch (e) {
    return false;
  }
}

export function orderStatusMessage(order, statusText) {
  return `مرحباً ${order.user_name || ''} 👋\n\n` +
    `طلبك رقم #${order.id} تغيّرت حالته إلى: *${statusText}*\n\n` +
    `المبلغ: ${order.total} درهم\n` +
    (order.items_text ? `المنتجات:\n${order.items_text}\n` : '') +
    `شكراً لثقتك فينا 🙏`;
}

export function newOrderToAdmin(order, itemsText) {
  const customerPhone = order.user_phone || '';
  return `🛒 *طلب جديد #${order.id}*\n\n` +
    `الزبون: ${order.user_name || ''}\n` +
    `الهاتف: ${customerPhone}\n` +
    `المبلغ: ${order.total} درهم\n\n` +
    `المنتجات:\n${itemsText}\n\n` +
    `حالة: قيد المعالجة`;
}
