import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/api/admin-auth";
import { adminDb } from "@/lib/firebase/admin";
import { authenticatedImageDeliveryUrl } from "@/lib/cloudinary";
import type { PaymentRecord } from "@/lib/types";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const db = adminDb();
  if (!db) return NextResponse.json({ error: "خدمة مراجعة الدفع غير متاحة حاليًا" }, { status: 503 });

  try {
    const { id } = await context.params;
    const paymentId = id.trim();
    if (!paymentId) return NextResponse.json({ error: "معرف عملية الدفع غير صحيح" }, { status: 400 });

    const paymentSnapshot = await db.collection("payments").doc(paymentId).get();
    if (!paymentSnapshot.exists) return NextResponse.json({ error: "عملية الدفع غير موجودة" }, { status: 404 });
    const payment = { id: paymentSnapshot.id, ...paymentSnapshot.data() } as PaymentRecord;
    if (!payment.proof) return NextResponse.json({ error: "لم يُرفق العميل إثبات تحويل لهذه العملية بعد" }, { status: 404 });

    const url = authenticatedImageDeliveryUrl(payment.proof.publicId, payment.proof.format);
    if (!url) return NextResponse.json({ error: "تعذر تجهيز عرض إثبات التحويل" }, { status: 503 });
    return NextResponse.json({ url, submittedAt: payment.proof.submittedAt, format: payment.proof.format, sizeBytes: payment.proof.sizeBytes });
  } catch (error) {
    console.error("Failed to prepare payment proof", error);
    return NextResponse.json({ error: "تعذر فتح إثبات التحويل" }, { status: 500 });
  }
}
