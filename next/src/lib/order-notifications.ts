import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import { notifyCustomerExpoPush } from "@/lib/expo-push";
import { sendWhatsAppTemplate, whatsappConfigured } from "@/lib/whatsapp";

type OrderNotificationEvent = "received" | "processing" | "completed" | "delivery_added";
type NotifyOrderInput = { orderId: string; customerId: string; serviceTitle: string; event: OrderNotificationEvent };

const statusCopy: Record<OrderNotificationEvent, string> = { received: "تم استلام الطلب", processing: "قيد المعالجة", completed: "مكتمل", delivery_added: "تمت إضافة بيانات التسليم" };
function configuredTemplate(name: string) { return process.env[name]?.trim() || ""; }

async function reserveLog(id: string, input: Record<string, unknown>) {
  const db = adminDb();
  if (!db) return false;
  try {
    await db.collection("notificationLogs").doc(id).create({ ...input, status: "queued", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    return true;
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? Number((error as { code?: number }).code) : 0;
    if (code !== 6) console.error("Failed to reserve notification", error);
    return false;
  }
}

async function completeLog(id: string, outcome: "sent" | "failed", providerMessageId = "", safeErrorCode = "") {
  const db = adminDb();
  if (!db) return;
  await db.collection("notificationLogs").doc(id).set({ status: outcome, providerMessageId, safeErrorCode, updatedAt: new Date().toISOString() }, { merge: true }).catch((error) => console.error("Failed to update notification log", error));
}

async function sendCustomerWhatsApp(input: NotifyOrderInput) {
  if (!whatsappConfigured()) return;
  const template = configuredTemplate(`WHATSAPP_TEMPLATE_ORDER_${input.event.toUpperCase()}`);
  if (!template) return;
  const db = adminDb();
  if (!db) return;
  const customer = await db.collection("customers").doc(input.customerId).get();
  const raw = customer.data() as Record<string, unknown> | undefined;
  const preferences = raw?.notificationPreferences as Record<string, unknown> | undefined;
  if (!raw || raw.phoneVerifiedAt === undefined || preferences?.whatsapp !== true || typeof raw.phone !== "string") return;
  const id = `order:${input.orderId}:customer:${input.event}`;
  if (!await reserveLog(id, { idempotencyKey: id, orderId: input.orderId, customerId: input.customerId, eventType: `order_${input.event}`, direction: "outbound", channel: "whatsapp" })) return;
  try {
    const sent = await sendWhatsAppTemplate({ to: raw.phone, template, bodyParameters: [input.orderId, input.serviceTitle, statusCopy[input.event]] });
    await completeLog(id, "sent", sent.providerMessageId);
  } catch (error) {
    console.error("Customer order WhatsApp notification failed", { orderId: input.orderId, event: input.event, error });
    await completeLog(id, "failed", "", "WHATSAPP_SEND_FAILED");
  }
}

async function sendAdminWhatsApp(input: NotifyOrderInput) {
  if (!whatsappConfigured()) return;
  const phone = process.env.WHATSAPP_ADMIN_PHONE?.trim() || "";
  const template = configuredTemplate(`WHATSAPP_TEMPLATE_ADMIN_ORDER_${input.event.toUpperCase()}`);
  if (!phone || !template) return;
  const id = `order:${input.orderId}:admin:${input.event}`;
  if (!await reserveLog(id, { idempotencyKey: id, orderId: input.orderId, customerId: input.customerId, eventType: `admin_order_${input.event}`, direction: "outbound", channel: "whatsapp" })) return;
  try {
    const sent = await sendWhatsAppTemplate({ to: phone, template, bodyParameters: [input.orderId, input.serviceTitle, statusCopy[input.event]] });
    await completeLog(id, "sent", sent.providerMessageId);
  } catch (error) {
    console.error("Admin order WhatsApp notification failed", { orderId: input.orderId, event: input.event, error });
    await completeLog(id, "failed", "", "WHATSAPP_SEND_FAILED");
  }
}

export async function notifyOrderEvent(input: NotifyOrderInput) {
  await Promise.allSettled([sendCustomerWhatsApp(input), sendAdminWhatsApp(input), notifyCustomerExpoPush(input)]);
}
