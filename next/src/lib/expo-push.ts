import "server-only";

import { createHash } from "node:crypto";

import { adminDb } from "@/lib/firebase/admin";

type OrderPushEvent = "received" | "processing" | "completed" | "delivery_added";
type OrderPushInput = { orderId: string; customerId: string; serviceTitle: string; event: OrderPushEvent };
type ExpoTokenRecord = { token?: unknown };

const statusCopy: Record<OrderPushEvent, string> = {
  received: "تم استلام طلبك",
  processing: "طلبك قيد المعالجة",
  completed: "اكتمل طلبك",
  delivery_added: "تمت إضافة بيانات تسليم لطلبك",
};

export function isExpoPushToken(token: string) {
  return /^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]{10,220}\]$/.test(token);
}

function tokenId(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function registerExpoPushToken(input: { customerId: string; token: string; platform: "android" | "ios" }) {
  if (!isExpoPushToken(input.token)) throw new Error("رمز إشعارات الجهاز غير صالح.");
  const db = adminDb();
  if (!db) throw new Error("خدمة الإشعارات غير متاحة حاليًا.");
  const now = new Date().toISOString();
  await db.collection("customers").doc(input.customerId).collection("pushTokens").doc(tokenId(input.token)).set({
    token: input.token,
    platform: input.platform,
    updatedAt: now,
    createdAt: now,
  }, { merge: true });
}

export async function unregisterExpoPushTokens(customerId: string) {
  const db = adminDb();
  if (!db) throw new Error("خدمة الإشعارات غير متاحة حاليًا.");
  const tokens = await db.collection("customers").doc(customerId).collection("pushTokens").limit(100).get();
  if (tokens.empty) return;
  const batch = db.batch();
  tokens.docs.forEach((item) => batch.delete(item.ref));
  await batch.commit();
}

async function reserveLog(id: string, input: Record<string, unknown>) {
  const db = adminDb();
  if (!db) return false;
  try {
    await db.collection("notificationLogs").doc(id).create({ ...input, status: "queued", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    return true;
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? Number((error as { code?: number }).code) : 0;
    if (code !== 6) console.error("Failed to reserve Expo notification", error);
    return false;
  }
}

async function completeLog(id: string, outcome: "sent" | "failed", safeErrorCode = "") {
  const db = adminDb();
  if (!db) return;
  await db.collection("notificationLogs").doc(id).set({ status: outcome, safeErrorCode, updatedAt: new Date().toISOString() }, { merge: true }).catch((error) => console.error("Failed to update Expo notification log", error));
}

export async function notifyCustomerExpoPush(input: OrderPushInput) {
  const db = adminDb();
  if (!db) return;
  const id = `order:${input.orderId}:customer:expo:${input.event}`;
  if (!await reserveLog(id, { idempotencyKey: id, orderId: input.orderId, customerId: input.customerId, eventType: `order_${input.event}`, direction: "outbound", channel: "expo" })) return;

  try {
    const snapshots = await db.collection("customers").doc(input.customerId).collection("pushTokens").limit(20).get();
    const tokens = snapshots.docs.map((item) => item.data() as ExpoTokenRecord).map((item) => typeof item.token === "string" ? item.token : "").filter(isExpoPushToken);
    if (tokens.length === 0) { await completeLog(id, "sent"); return; }

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify(tokens.map((to) => ({
        to,
        sound: "default",
        title: statusCopy[input.event],
        body: input.serviceTitle,
        channelId: "orders",
        data: { url: `chrigsm://order/${input.orderId}` },
      }))),
    });
    if (!response.ok) throw new Error(`EXPO_HTTP_${response.status}`);
    await completeLog(id, "sent");
  } catch (error) {
    const safeErrorCode = error instanceof Error && error.message.startsWith("EXPO_HTTP_") ? error.message : "EXPO_SEND_FAILED";
    console.error("Customer Expo notification failed", { orderId: input.orderId, event: input.event, safeErrorCode });
    await completeLog(id, "failed", safeErrorCode);
  }
}
