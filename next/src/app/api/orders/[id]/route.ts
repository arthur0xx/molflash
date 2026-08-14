import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/api/admin-auth";
import { statusLabels, type OrderStatus } from "@/lib/types";

const orderStatuses = ["new", "processing", "waiting", "completed", "rejected"] as const;
const updateOrderSchema = z.object({
  status: z.enum(orderStatuses).optional(),
  deliveryCode: z.string().trim().max(500).optional(),
  deliveryNote: z.string().trim().max(1000).optional(),
});
const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  new: ["processing", "waiting", "completed", "rejected"],
  processing: ["waiting", "completed", "rejected"],
  waiting: ["processing", "completed", "rejected"],
  completed: [],
  rejected: [],
};

class OrderStatusError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const db = adminDb();
  if (!db) return NextResponse.json({ error: "إعداد Firebase الخادمي غير مكتمل" }, { status: 503 });

  try {
    const parsed = updateOrderSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "بيانات تحديث الطلب غير صحيحة" }, { status: 400 });
    const { id } = await context.params;
    const deliveryCode = parsed.data.deliveryCode || "";
    const deliveryNote = parsed.data.deliveryNote || "";
    const now = new Date().toISOString();
    let nextStatus: OrderStatus | null = null;

    await db.runTransaction(async (transaction) => {
      const orderReference = db.collection("orders").doc(id);
      const auditReference = db.collection("auditLogs").doc();
      const orderSnapshot = await transaction.get(orderReference);
      if (!orderSnapshot.exists) throw new OrderStatusError(404, "الطلب غير موجود");

      const current = orderSnapshot.data() as { status?: OrderStatus; serviceId?: string };
      if (!current.status || !orderStatuses.includes(current.status)) throw new OrderStatusError(409, "حالة الطلب الحالية غير صحيحة");
      const requestedStatus = deliveryCode ? "completed" : parsed.data.status;
      if (!requestedStatus) throw new OrderStatusError(400, "اختر حالة جديدة أو أرسل تفاصيل التسليم");
      if (deliveryCode && parsed.data.status && parsed.data.status !== "completed") throw new OrderStatusError(400, "لا يمكن إرسال تفاصيل التسليم مع حالة مختلفة عن مكتمل");
      if (!allowedTransitions[current.status].includes(requestedStatus)) throw new OrderStatusError(409, "انتقال حالة الطلب غير مسموح");

      const history = {
        status: requestedStatus,
        at: now,
        note: deliveryCode
          ? "تم إرسال كود أو تفاصيل التسليم إلى حساب العميل."
          : requestedStatus === "processing"
            ? "بدأ فريق ChriGsm معالجة الطلب. بيانات العميل أصبحت مقفلة."
            : `غيّر فريق ChriGsm الحالة إلى «${statusLabels[requestedStatus]}».`,
      };
      const update: Record<string, unknown> = {
        status: requestedStatus,
        updatedAt: now,
        statusHistory: FieldValue.arrayUnion(history),
      };

      if (deliveryCode) {
        const serviceSnapshot = current.serviceId ? await transaction.get(db.collection("services").doc(current.serviceId)) : null;
        const title = serviceSnapshot?.data()?.title || "الخدمة";
        update.deliveryCode = deliveryCode;
        update.deliveryNote = deliveryNote;
        update.notification = { title: "تم إنجاز طلبك بنجاح", body: `تم تسليم ${title}. راجع كود التسليم في تفاصيل الطلب.`, createdAt: now, read: false };
      }

      transaction.update(orderReference, update);
      transaction.create(auditReference, { action: deliveryCode ? "order_delivered" : "order_status_updated", orderId: id, customerId: orderSnapshot.data()?.customerId || null, actorUid: admin.uid, at: now, demo: true });
      nextStatus = requestedStatus;
    });

    return NextResponse.json({ ok: true, status: nextStatus, updatedAt: now });
  } catch (error) {
    if (error instanceof OrderStatusError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Failed to update order", error);
    return NextResponse.json({ error: "تعذر تحديث الطلب" }, { status: 500 });
  }
}
