import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import { sendWhatsAppTemplate, whatsappConfigured } from "@/lib/whatsapp";

export async function notifyAdminNewSupportTicket(ticketId: string, customerId: string) {
  if (!whatsappConfigured()) return;
  const phone = process.env.WHATSAPP_ADMIN_PHONE?.trim() || "";
  const template = process.env.WHATSAPP_TEMPLATE_ADMIN_SUPPORT_NEW?.trim() || "";
  if (!phone || !template) return;
  const db = adminDb();
  if (!db) return;
  const id = `support:${ticketId}:admin:new`;
  const now = new Date().toISOString();
  try {
    await db.collection("notificationLogs").doc(id).create({ idempotencyKey: id, ticketId, customerId, eventType: "admin_support_new", direction: "outbound", channel: "whatsapp", status: "queued", createdAt: now, updatedAt: now });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? Number((error as { code?: number }).code) : 0;
    if (code !== 6) console.error("Failed to reserve support notification", error);
    return;
  }
  try {
    const sent = await sendWhatsAppTemplate({ to: phone, template, bodyParameters: [ticketId] });
    await db.collection("notificationLogs").doc(id).set({ status: "sent", providerMessageId: sent.providerMessageId, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (error) {
    console.error("Admin support WhatsApp notification failed", { ticketId, error });
    await db.collection("notificationLogs").doc(id).set({ status: "failed", safeErrorCode: "WHATSAPP_SEND_FAILED", updatedAt: new Date().toISOString() }, { merge: true }).catch(() => undefined);
  }
}
