import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireStaff } from "@/lib/api/admin-auth";
import { statusLabels, type OrderStatus } from "@/lib/types";
import { notifyOrderEvent } from "@/lib/order-notifications";

const orderStatuses = ["new", "processing", "waiting", "completed", "rejected"] as const;
const updateOrderSchema = z.object({
  status: z.enum(orderStatuses).optional(),
  deliveryCode: z.string().trim().max(500).optional(),
  deliveryNote: z.string().trim().max(1000).optional(),
  archive: z.boolean().optional(),
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
  const admin = await requireStaff(request, "orders");
  if (!admin) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const db = adminDb();
  if (!db) return NextResponse.json({ error: "إعداد Firebase الخادمي غير مكتمل" }, { status: 503 });

  try {
    const parsed = updateOrderSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "بيانات تحديث الطلب غير صحيحة" }, { status: 400 });
    const { id } = await context.params;
    const isOwner = admin.role === "admin" || admin.role === "owner";
    if (parsed.data.archive !== undefined && !isOwner) return NextResponse.json({ error: "أرشفة الطلبات متاحة للمالك فقط" }, { status: 403 });
    if (parsed.data.archive !== undefined && (parsed.data.status !== undefined || parsed.data.deliveryCode !== undefined || parsed.data.deliveryNote !== undefined)) return NextResponse.json({ error: "لا تجمع الأرشفة مع تغيير حالة الطلب أو التسليم" }, { status: 400 });
    const deliveryCode = parsed.data.deliveryCode || "";
    const deliveryNote = parsed.data.deliveryNote || "";
    const now = new Date().toISOString();
    let nextStatus: OrderStatus | null = null;
    let archived: boolean | null = null;
    let notificationInput: { orderId: string; customerId: string; serviceTitle: string; event: "processing" | "completed" | "delivery_added" } | null = null;

    await db.runTransaction(async (transaction) => {
      const orderReference = db.collection("orders").doc(id);
      const auditReference = db.collection("auditLogs").doc();
      const orderSnapshot = await transaction.get(orderReference);
      if (!orderSnapshot.exists) throw new OrderStatusError(404, "الطلب غير موجود");

      const current = orderSnapshot.data() as { status?: OrderStatus; serviceId?: string; customerId?: string; archivedAt?: string };
      if (!current.status || !orderStatuses.includes(current.status)) throw new OrderStatusError(409, "حالة الطلب الحالية غير صحيحة");

      if (parsed.data.archive !== undefined) {
        if (current.status !== "rejected") throw new OrderStatusError(409, "يمكن أرشفة الطلبات المرفوضة فقط");
        if (parsed.data.archive && current.archivedAt) throw new OrderStatusError(409, "الطلب مؤرشف بالفعل");
        if (!parsed.data.archive && !current.archivedAt) throw new OrderStatusError(409, "الطلب غير مؤرشف");
        transaction.update(orderReference, {
          updatedAt: now,
          archivedAt: parsed.data.archive ? now : FieldValue.delete(),
          archivedBy: parsed.data.archive ? admin.uid : FieldValue.delete(),
        });
        transaction.create(auditReference, {
          action: parsed.data.archive ? "order_archived" : "order_unarchived",
          orderId: id,
          customerId: current.customerId || null,
          actorUid: admin.uid,
          at: now,
        });
        archived = parsed.data.archive;
        return;
      }

      const requestedStatus = deliveryCode ? "completed" : parsed.data.status;
      if (!requestedStatus) throw new OrderStatusError(400, "اختر حالة جديدة أو أرسل تفاصيل التسليم");
      if (deliveryCode && parsed.data.status && parsed.data.status !== "completed") throw new OrderStatusError(400, "لا يمكن إرسال تفاصيل التسليم مع حالة مختلفة عن مكتمل");
      if (!allowedTransitions[current.status].includes(requestedStatus)) throw new OrderStatusError(409, "انتقال حالة الطلب غير مسموح");

      const serviceSnapshot = current.serviceId ? await transaction.get(db.collection("services").doc(current.serviceId)) : null;
      const title = typeof serviceSnapshot?.data()?.title === "string" ? serviceSnapshot.data()!.title : "خدمة رقمية";
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
        update.deliveryCode = deliveryCode;
        update.deliveryNote = deliveryNote;
        update.notification = { title: "تم إنجاز طلبك بنجاح", body: `تم تسليم ${title}. راجع كود التسليم في تفاصيل الطلب.`, createdAt: now, read: false };
      }

      transaction.update(orderReference, update);
      transaction.create(auditReference, { action: deliveryCode ? "order_delivered" : "order_status_updated", orderId: id, customerId: orderSnapshot.data()?.customerId || null, actorUid: admin.uid, at: now });
      nextStatus = requestedStatus;
      const event = deliveryCode ? "delivery_added" : requestedStatus === "processing" ? "processing" : requestedStatus === "completed" ? "completed" : null;
      if (event && typeof current.customerId === "string" && current.customerId) notificationInput = { orderId: id, customerId: current.customerId, serviceTitle: title, event };
    });
    if (notificationInput) await notifyOrderEvent(notificationInput);

    return NextResponse.json({ ok: true, status: nextStatus, archived, updatedAt: now });
  } catch (error) {
    if (error instanceof OrderStatusError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Failed to update order", error);
    return NextResponse.json({ error: "تعذر تحديث الطلب" }, { status: 500 });
  }
}
