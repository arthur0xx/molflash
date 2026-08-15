import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireStaff } from "@/lib/api/admin-auth";
import type { SupportTicket } from "@/lib/types";

const replyTicketSchema = z.object({
  reply: z.string().trim().min(4, "رد الدعم قصير جدًا").max(4000, "رد الدعم طويل جدًا"),
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await requireStaff(request, "support");
  if (!admin) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const db = adminDb();
  if (!db) return NextResponse.json({ error: "إعداد Firebase الخادمي غير مكتمل" }, { status: 503 });

  try {
    const { id } = await context.params;
    const ticketId = id.trim();
    if (!ticketId) return NextResponse.json({ error: "معرف رسالة الدعم غير صحيح" }, { status: 400 });

    const parsed = replyTicketSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "بيانات الرد غير صحيحة" }, { status: 400 });

    const ticketReference = db.collection("supportTickets").doc(ticketId);
    const auditReference = db.collection("auditLogs").doc();
    const now = new Date().toISOString();

    const ticket = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ticketReference);
      if (!snapshot.exists) throw new SupportRouteError("رسالة الدعم غير موجودة", 404);
      const raw = snapshot.data() as Record<string, unknown>;
      if (raw.status === "answered" || raw.reply) throw new SupportRouteError("تم الرد على هذه الرسالة بالفعل", 409);
      const customerId = typeof raw.customerId === "string" ? raw.customerId : "";
      if (!customerId) throw new SupportRouteError("بيانات العميل غير صالحة", 409);

      const reply = { message: parsed.data.reply, createdAt: now, createdBy: admin.uid };
      const update = { status: "answered" as const, reply, updatedAt: now, updatedBy: admin.uid };
      transaction.update(ticketReference, update);
      transaction.create(auditReference, { action: "support_ticket_answered", ticketId, customerId, actorUid: admin.uid, at: now });

      return {
        id: ticketId,
        customerId,
        subject: String(raw.subject || ""),
        message: String(raw.message || ""),
        status: "answered" as const,
        createdAt: String(raw.createdAt || ""),
        updatedAt: now,
        reply,
      } satisfies SupportTicket;
    });

    return NextResponse.json({ ticket });
  } catch (error) {
    if (error instanceof SupportRouteError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Failed to answer support ticket", error);
    return NextResponse.json({ error: "تعذر حفظ رد الدعم" }, { status: 500 });
  }
}

class SupportRouteError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
