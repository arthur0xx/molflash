import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { statusLabels, type OrderStatus } from "@/lib/types";

const allowedStatuses: OrderStatus[] = ["new", "processing", "waiting", "completed", "rejected"];

type UpdateBody = { status?: OrderStatus; deliveryCode?: string; deliveryNote?: string };

async function requireAdmin(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const auth = adminAuth();
  if (!token || !auth) return null;
  const decoded = await auth.verifyIdToken(token);
  return decoded.role === "admin" ? decoded : null;
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    const db = adminDb();
    if (!db) return NextResponse.json({ error: "إعداد Firebase الخادمي غير مكتمل" }, { status: 503 });

    const { id } = await context.params;
    const body = await request.json() as UpdateBody;
    const orderRef = db.collection("orders").doc(id);
    const snapshot = await orderRef.get();
    if (!snapshot.exists) return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });

    const current = snapshot.data() as { status?: OrderStatus; serviceId?: string };
    const now = new Date().toISOString();
    const status = body.status && allowedStatuses.includes(body.status) ? body.status : current.status;
    if (!status) return NextResponse.json({ error: "حالة الطلب غير صحيحة" }, { status: 400 });

    const deliveryCode = body.deliveryCode?.trim();
    const deliveryNote = body.deliveryNote?.trim();
    const isDelivery = Boolean(deliveryCode);
    const history = {
      status: isDelivery ? "completed" : status,
      at: now,
      note: isDelivery
        ? "تم إرسال كود أو تفاصيل التسليم إلى حساب العميل."
        : status === "processing"
          ? "بدأ فريق ChriGsm معالجة الطلب. بيانات العميل أصبحت مقفلة."
          : `غيّر فريق ChriGsm الحالة إلى «${statusLabels[status]}».`,
    };
    const nextStatus = isDelivery ? "completed" : status;
    const update: Record<string, unknown> = {
      status: nextStatus,
      updatedAt: now,
      statusHistory: FieldValue.arrayUnion(history),
    };

    if (isDelivery) {
      const service = current.serviceId ? await db.collection("services").doc(current.serviceId).get() : null;
      const title = service?.data()?.title || "الخدمة";
      update.deliveryCode = deliveryCode;
      update.deliveryNote = deliveryNote || "";
      update.notification = { title: "تم إنجاز طلبك بنجاح", body: `تم تسليم ${title}. راجع كود التسليم في تفاصيل الطلب.`, createdAt: now, read: false };
    }

    await orderRef.update(update);
    await db.collection("auditLogs").add({ action: isDelivery ? "order_delivered" : "order_status_updated", orderId: id, actorUid: admin.uid, at: now, demo: true });
    return NextResponse.json({ ok: true, status: nextStatus, updatedAt: now });
  } catch (error) {
    console.error("Failed to update order", error);
    return NextResponse.json({ error: "تعذر تحديث الطلب" }, { status: 500 });
  }
}
