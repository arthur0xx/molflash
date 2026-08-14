import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser } from "@/lib/api/admin-auth";
import type { SupportTicket } from "@/lib/types";

const createTicketSchema = z.object({
  subject: z.string().trim().min(4, "موضوع الرسالة قصير جدًا").max(140, "موضوع الرسالة طويل جدًا"),
  message: z.string().trim().min(10, "تفاصيل الرسالة قصيرة جدًا").max(4000, "تفاصيل الرسالة طويلة جدًا"),
});

function serializeTicket(id: string, raw: Record<string, unknown>): SupportTicket {
  return {
    id,
    customerId: String(raw.customerId || ""),
    subject: String(raw.subject || ""),
    message: String(raw.message || ""),
    status: raw.status === "answered" ? "answered" : "open",
    createdAt: String(raw.createdAt || ""),
    updatedAt: String(raw.updatedAt || raw.createdAt || ""),
    reply: raw.reply && typeof raw.reply === "object" ? {
      message: String((raw.reply as Record<string, unknown>).message || ""),
      createdAt: String((raw.reply as Record<string, unknown>).createdAt || ""),
      createdBy: String((raw.reply as Record<string, unknown>).createdBy || ""),
    } : undefined,
  };
}

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const db = adminDb();
  if (!db) return NextResponse.json({ error: "إعداد Firebase الخادمي غير مكتمل" }, { status: 503 });

  try {
    const snapshot = await db.collection("supportTickets").where("customerId", "==", user.uid).get();
    const tickets = snapshot.docs
      .map((ticket) => serializeTicket(ticket.id, ticket.data()))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    return NextResponse.json({ tickets });
  } catch (error) {
    console.error("Failed to load customer support tickets", error);
    return NextResponse.json({ error: "تعذر تحميل رسائل الدعم" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const db = adminDb();
  if (!db) return NextResponse.json({ error: "إعداد Firebase الخادمي غير مكتمل" }, { status: 503 });

  try {
    const parsed = createTicketSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "بيانات الدعم غير صحيحة" }, { status: 400 });

    const customer = await db.collection("customers").doc(user.uid).get();
    if (!customer.exists) return NextResponse.json({ error: "ملف العميل غير موجود" }, { status: 404 });

    const now = new Date().toISOString();
    const ticketReference = db.collection("supportTickets").doc();
    const auditReference = db.collection("auditLogs").doc();
    const ticket: SupportTicket = {
      id: ticketReference.id,
      customerId: user.uid,
      subject: parsed.data.subject,
      message: parsed.data.message,
      status: "open",
      createdAt: now,
      updatedAt: now,
    };

    const batch = db.batch();
    batch.create(ticketReference, { ...ticket, createdBy: user.uid });
    batch.create(auditReference, { action: "support_ticket_created", ticketId: ticket.id, customerId: user.uid, actorUid: user.uid, at: now });
    await batch.commit();

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    console.error("Failed to create support ticket", error);
    return NextResponse.json({ error: "تعذر إرسال طلب الدعم" }, { status: 500 });
  }
}
