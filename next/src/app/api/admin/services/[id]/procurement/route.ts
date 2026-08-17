import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireOwner } from "@/lib/api/admin-auth";

const purchaseUrlSchema = z.object({
  purchaseUrl: z.string().trim().url("رابط الشراء غير صحيح").refine((value) => new URL(value).protocol === "https:", "رابط الشراء يجب أن يبدأ بـ https://").max(2000, "رابط الشراء طويل جدًا").nullable(),
});

async function getServiceId(context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return id.trim();
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const db = adminDb();
  if (!db) return NextResponse.json({ error: "إعداد Firebase الخادمي غير مكتمل" }, { status: 503 });

  const serviceId = await getServiceId(context);
  if (!serviceId) return NextResponse.json({ error: "معرف الخدمة غير صحيح" }, { status: 400 });

  const [service, privateRecord] = await Promise.all([
    db.collection("services").doc(serviceId).get(),
    db.collection("servicePrivate").doc(serviceId).get(),
  ]);
  if (!service.exists) return NextResponse.json({ error: "الخدمة غير موجودة" }, { status: 404 });

  const purchaseUrl = privateRecord.exists && typeof privateRecord.data()?.purchaseUrl === "string" ? privateRecord.data()?.purchaseUrl : null;
  return NextResponse.json({ purchaseUrl });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const db = adminDb();
  if (!db) return NextResponse.json({ error: "إعداد Firebase الخادمي غير مكتمل" }, { status: 503 });

  try {
    const serviceId = await getServiceId(context);
    if (!serviceId) return NextResponse.json({ error: "معرف الخدمة غير صحيح" }, { status: 400 });

    const parsed = purchaseUrlSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "بيانات رابط الشراء غير صحيحة" }, { status: 400 });

    const service = await db.collection("services").doc(serviceId).get();
    if (!service.exists) return NextResponse.json({ error: "الخدمة غير موجودة" }, { status: 404 });

    const now = new Date().toISOString();
    const privateReference = db.collection("servicePrivate").doc(serviceId);
    await privateReference.set({
      ...(parsed.data.purchaseUrl === null ? { purchaseUrl: FieldValue.delete() } : { purchaseUrl: parsed.data.purchaseUrl }),
      updatedAt: now,
      updatedBy: owner.uid,
    }, { merge: true });
    await db.collection("auditLogs").add({ action: parsed.data.purchaseUrl === null ? "service_purchase_url_cleared" : "service_purchase_url_updated", serviceId, actorUid: owner.uid, at: now });

    return NextResponse.json({ purchaseUrl: parsed.data.purchaseUrl });
  } catch (error) {
    console.error("Failed to update service procurement URL", error);
    return NextResponse.json({ error: "تعذر حفظ رابط الشراء الداخلي" }, { status: 500 });
  }
}
