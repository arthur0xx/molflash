import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import { sendWhatsAppTemplate, whatsappConfigured } from "@/lib/whatsapp";
import type { PaymentRecord } from "@/lib/types";

function configuredTemplate(name: string) {
  return process.env[name]?.trim() || "";
}

async function reserveLog(id: string, input: Record<string, unknown>) {
  const db = adminDb();
  if (!db) return false;
  try {
    await db.collection("notificationLogs").doc(id).create({ ...input, status: "queued", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    return true;
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? Number((error as { code?: number }).code) : 0;
    if (code !== 6) console.error("Failed to reserve payment proof notification", error);
    return false;
  }
}

async function completeLog(id: string, outcome: "sent" | "failed", providerMessageId = "", safeErrorCode = "") {
  const db = adminDb();
  if (!db) return;
  await db.collection("notificationLogs").doc(id).set({ status: outcome, providerMessageId, safeErrorCode, updatedAt: new Date().toISOString() }, { merge: true }).catch((error) => console.error("Failed to update payment proof notification log", error));
}

/**
 * Sends a real Meta WhatsApp template only when the official integration, owner number,
 * and approved template are configured. It never affects payment status or review flow.
 */
export async function notifyAdminPaymentProofUploaded(payment: PaymentRecord) {
  if (!whatsappConfigured()) return { delivered: false, reason: "not_configured" as const };
  const phone = process.env.WHATSAPP_ADMIN_PHONE?.trim() || "";
  const template = configuredTemplate("WHATSAPP_TEMPLATE_ADMIN_PAYMENT_PROOF_UPLOADED");
  if (!phone || !template) return { delivered: false, reason: "template_or_recipient_missing" as const };

  const id = `payment:${payment.id}:admin:proof_submitted`;
  if (!await reserveLog(id, {
    idempotencyKey: id,
    paymentId: payment.id,
    paymentReference: payment.paymentReference,
    customerId: payment.customerId,
    eventType: "admin_payment_proof_uploaded",
    direction: "outbound",
    channel: "whatsapp",
  })) return { delivered: false, reason: "already_reserved" as const };

  try {
    const purposeLabel = payment.purpose === "wallet_topup" ? "شحن رصيد" : "طلب خدمة";
    const sent = await sendWhatsAppTemplate({
      to: phone,
      template,
      bodyParameters: [payment.paymentReference, `${payment.amountMad} MAD`, purposeLabel],
    });
    await completeLog(id, "sent", sent.providerMessageId);
    return { delivered: true, reason: "sent" as const };
  } catch (error) {
    console.error("Admin payment proof WhatsApp notification failed", { paymentId: payment.id, error });
    await completeLog(id, "failed", "", "WHATSAPP_SEND_FAILED");
    return { delivered: false, reason: "send_failed" as const };
  }
}
