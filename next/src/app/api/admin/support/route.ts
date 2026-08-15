import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireStaff } from "@/lib/api/admin-auth";
import type { SupportTicket } from "@/lib/types";

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
  const admin = await requireStaff(request, "support");
  if (!admin) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const db = adminDb();
  if (!db) return NextResponse.json({ error: "إعداد Firebase الخادمي غير مكتمل" }, { status: 503 });

  try {
    const snapshot = await db.collection("supportTickets").get();
    const tickets = snapshot.docs
      .map((ticket) => serializeTicket(ticket.id, ticket.data()))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    return NextResponse.json({ tickets });
  } catch (error) {
    console.error("Failed to load admin support tickets", error);
    return NextResponse.json({ error: "تعذر تحميل رسائل الدعم" }, { status: 500 });
  }
}
