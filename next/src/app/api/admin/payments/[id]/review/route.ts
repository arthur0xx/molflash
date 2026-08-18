import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireOwner } from "@/lib/api/admin-auth";
import type { Customer, PaymentRecord, WalletEntry } from "@/lib/types";

const reviewSchema = z.object({
  action: z.enum(["under_review", "confirm", "reject"]),
  note: z.string().trim().max(500, "ملاحظة المراجعة طويلة جدًا").optional(),
  reconciliationNote: z.string().trim().max(500, "ملاحظة المطابقة البنكية طويلة جدًا").optional(),
});

const reviewableStatuses = new Set<PaymentRecord["status"]>(["manual_transfer_pending", "proof_submitted", "under_review"]);

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const db = adminDb();
  if (!db) return NextResponse.json({ error: "خدمة مراجعة الدفع غير متاحة حاليًا" }, { status: 503 });

  try {
    const { id } = await context.params;
    const paymentId = id.trim();
    if (!paymentId) return NextResponse.json({ error: "معرف عملية الدفع غير صحيح" }, { status: 400 });

    const parsed = reviewSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "بيانات المراجعة غير صحيحة" }, { status: 400 });

    const now = new Date().toISOString();
    const paymentReference = db.collection("payments").doc(paymentId);
    const result = await db.runTransaction(async (transaction) => {
      const paymentSnapshot = await transaction.get(paymentReference);
      if (!paymentSnapshot.exists) throw new PaymentReviewError("عملية الدفع غير موجودة", 404);
      const payment = { id: paymentSnapshot.id, ...paymentSnapshot.data() } as PaymentRecord;
      if (!reviewableStatuses.has(payment.status)) throw new PaymentReviewError("تمت مراجعة هذه العملية سابقًا ولا يمكن تعديلها مرة أخرى", 409);

      if (parsed.data.action === "under_review") {
        if (!payment.proof) throw new PaymentReviewError("لا يمكن بدء المراجعة قبل أن يرفق العميل إثبات التحويل", 409);
        const next = { ...payment, status: "under_review" as const, updatedAt: now, reviewNote: parsed.data.note || payment.reviewNote || "قيد مراجعة التحويل", reconciliationNote: parsed.data.reconciliationNote || payment.reconciliationNote };
        transaction.update(paymentReference, { status: next.status, updatedAt: next.updatedAt, reviewNote: next.reviewNote, reconciliationNote: next.reconciliationNote || null });
        transaction.create(db.collection("auditLogs").doc(), { action: "manual_payment_under_review", paymentId: payment.id, paymentReference: payment.paymentReference, actorUid: owner.uid, at: now });
        return { payment: next, creditedWallet: false };
      }

      if (parsed.data.action === "reject") {
        const next = { ...payment, status: "rejected" as const, updatedAt: now, reviewedAt: now, reviewedBy: owner.uid, reviewNote: parsed.data.note || "رُفض التحويل بعد المراجعة" };
        transaction.update(paymentReference, { status: next.status, updatedAt: next.updatedAt, reviewedAt: next.reviewedAt, reviewedBy: next.reviewedBy, reviewNote: next.reviewNote });
        transaction.create(db.collection("auditLogs").doc(), { action: "manual_payment_rejected", paymentId: payment.id, paymentReference: payment.paymentReference, actorUid: owner.uid, at: now, note: next.reviewNote });
        return { payment: next, creditedWallet: false };
      }

      if (!payment.proof) throw new PaymentReviewError("لا يمكن تأكيد الدفع قبل أن يرفق العميل إثبات التحويل", 409);
      if (new Date(payment.referenceExpiresAt).getTime() < Date.now()) throw new PaymentReviewError("انتهت صلاحية مرجع التحويل؛ راجع العملية يدويًا أو أنشئ مرجعًا جديدًا", 409);

      if (payment.purpose === "order") {
        if (!payment.orderId) throw new PaymentReviewError("بيانات الطلب المرتبط غير مكتملة", 409);
        const orderReference = db.collection("orders").doc(payment.orderId);
        const orderSnapshot = await transaction.get(orderReference);
        if (!orderSnapshot.exists) throw new PaymentReviewError("الطلب المرتبط لم يعد موجودًا", 404);
        const order = orderSnapshot.data() as { customerId?: unknown; status?: unknown; statusHistory?: unknown[] };
        if (order.customerId !== payment.customerId || !["new", "waiting"].includes(String(order.status))) throw new PaymentReviewError("لا يمكن بدء معالجة هذا الطلب بحالته الحالية", 409);
        const statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
        transaction.update(orderReference, {
          status: "processing",
          updatedAt: now,
          statusHistory: [...statusHistory, { status: "processing", at: now, note: `تم تأكيد التحويل اليدوي (${payment.paymentReference})` }],
        });
      } else {
        const topUpAmount = payment.walletTopUpAmountMad;
        if (typeof topUpAmount !== "number" || topUpAmount < 1) throw new PaymentReviewError("قيمة شحن الرصيد غير صحيحة", 409);
        const customerReference = db.collection("customers").doc(payment.customerId);
        const customerSnapshot = await transaction.get(customerReference);
        if (!customerSnapshot.exists) throw new PaymentReviewError("العميل المرتبط غير موجود", 404);
        const customer = customerSnapshot.data() as Customer;
        if (!Number.isFinite(customer.walletMad) || customer.walletMad < 0) throw new PaymentReviewError("رصيد العميل الحالي غير صالح؛ أوقف التأكيد للمراجعة", 409);
        const nextBalance = Math.round((customer.walletMad + topUpAmount) * 100) / 100;
        const walletEntryReference = db.collection("walletEntries").doc();
        const walletEntry: WalletEntry = { id: walletEntryReference.id, customerId: payment.customerId, amountMad: topUpAmount, reason: `شحن رصيد بتحويل يدوي ${payment.paymentReference}`, createdAt: now, createdBy: owner.uid };
        transaction.update(customerReference, { walletMad: nextBalance, lastActivity: now, updatedAt: now, updatedBy: owner.uid });
        transaction.create(walletEntryReference, walletEntry);
      }

      const next = { ...payment, status: "confirmed" as const, updatedAt: now, reviewedAt: now, reviewedBy: owner.uid, reviewNote: parsed.data.note || "تم تأكيد التحويل اليدوي", reconciliationNote: parsed.data.reconciliationNote || payment.reconciliationNote };
      transaction.update(paymentReference, { status: next.status, updatedAt: next.updatedAt, reviewedAt: next.reviewedAt, reviewedBy: next.reviewedBy, reviewNote: next.reviewNote, reconciliationNote: next.reconciliationNote || null });
      transaction.create(db.collection("auditLogs").doc(), { action: "manual_payment_confirmed", paymentId: payment.id, paymentReference: payment.paymentReference, purpose: payment.purpose, amountMad: payment.amountMad, customerId: payment.customerId, actorUid: owner.uid, at: now });
      return { payment: next, creditedWallet: payment.purpose === "wallet_topup" };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PaymentReviewError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Failed to review manual payment", error);
    return NextResponse.json({ error: "تعذر حفظ مراجعة التحويل" }, { status: 500 });
  }
}

class PaymentReviewError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
