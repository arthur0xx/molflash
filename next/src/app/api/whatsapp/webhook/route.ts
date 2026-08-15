import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { normalizeMoroccanMobile } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WhatsAppMessage = { id?: unknown; from?: unknown; type?: unknown; text?: { body?: unknown } };

function equalSecret(left: string, right: string) {
  const a = Buffer.from(left, "utf8"); const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode") || "";
  const token = request.nextUrl.searchParams.get("hub.verify_token") || "";
  const challenge = request.nextUrl.searchParams.get("hub.challenge") || "";
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim() || "";
  if (!expected || mode !== "subscribe" || !equalSecret(token, expected)) return new NextResponse("Forbidden", { status: 403 });
  return new NextResponse(challenge, { status: 200, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}

async function createInboundTicket(message: WhatsAppMessage) {
  const messageId = typeof message.id === "string" ? message.id : "";
  const from = typeof message.from === "string" ? message.from : "";
  const body = typeof message.text?.body === "string" ? message.text.body.trim() : "";
  const phone = normalizeMoroccanMobile(from);
  if (!messageId || !phone || !body || body.length > 4000) return;
  const db = adminDb();
  if (!db) return;
  const inboundReference = db.collection("whatsappInbound").doc(messageId);
  try {
    const customerSnapshot = await db.collection("customers").where("phone", "==", phone).limit(1).get();
    const customer = customerSnapshot.docs[0];
    const now = new Date().toISOString();
    await db.runTransaction(async (transaction) => {
      const inbound = await transaction.get(inboundReference);
      if (inbound.exists) return;
      transaction.create(inboundReference, { providerMessageId: messageId, customerId: customer?.id || null, receivedAt: now, handled: Boolean(customer) });
      transaction.create(db.collection("notificationLogs").doc(`inbound:${messageId}`), { idempotencyKey: `inbound:${messageId}`, customerId: customer?.id || null, eventType: "whatsapp_inbound", direction: "inbound", channel: "whatsapp", status: "received", createdAt: now, updatedAt: now });
      if (customer) {
        const ticketReference = db.collection("supportTickets").doc();
        transaction.create(ticketReference, { id: ticketReference.id, customerId: customer.id, subject: "رسالة واتساب", message: body, status: "open", createdAt: now, updatedAt: now, source: "whatsapp", providerMessageId: messageId });
        transaction.create(db.collection("auditLogs").doc(), { action: "whatsapp_support_ticket_created", ticketId: ticketReference.id, customerId: customer.id, actorUid: "whatsapp-webhook", at: now });
      }
    });
  } catch (error) { console.error("WhatsApp inbound event failed", { messageId, error }); }
}

export async function POST(request: NextRequest) {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET?.trim() || "";
  const signature = request.headers.get("x-hub-signature-256") || "";
  if (!secret || !signature.startsWith("sha256=")) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const raw = await request.text();
  const expected = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
  if (!equalSecret(signature, expected)) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  try {
    const payload = JSON.parse(raw) as { entry?: Array<{ changes?: Array<{ value?: { messages?: WhatsAppMessage[] } }> }> };
    const messages = payload.entry?.flatMap((entry) => entry.changes?.flatMap((change) => change.value?.messages || []) || []) || [];
    await Promise.all(messages.map((message) => createInboundTicket(message)));
  } catch (error) { console.error("Invalid signed WhatsApp webhook payload", error); }
  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
