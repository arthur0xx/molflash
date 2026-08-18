import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireOwner } from "@/lib/api/admin-auth";
import { paymentMethodPatchSchema, providerForPaymentMethod, validatePaymentMethod } from "@/lib/payment-method-validation";
import type { PaymentMethod } from "@/lib/types";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const db = adminDb();
  if (!db) return NextResponse.json({ error: "إعداد الدفع غير متاح حاليًا" }, { status: 503 });

  try {
    const { id } = await context.params;
    const methodId = id.trim();
    if (!methodId) return NextResponse.json({ error: "معرف وسيلة الدفع غير صحيح" }, { status: 400 });

    const parsed = paymentMethodPatchSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "بيانات وسيلة الدفع غير صحيحة" }, { status: 400 });

    const reference = db.collection("paymentMethods").doc(methodId);
    const now = new Date().toISOString();
    const result = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) throw new PaymentMethodRouteError("وسيلة الدفع غير موجودة", 404);
      const current = { id: snapshot.id, ...snapshot.data() } as PaymentMethod;
      const nextType = parsed.data.type || current.type;
      const next = {
        ...current,
        ...parsed.data,
        type: nextType,
        updatedAt: now,
        updatedBy: owner.uid,
      } as PaymentMethod;
      if (nextType !== "bank_transfer") delete next.bankDetails;
      if (nextType !== "cash_transfer") delete next.cashTransferDetails;
      if (nextType !== "electronic_gateway") delete next.gatewayConfig;
      next.provider = providerForPaymentMethod(next);
      const validationError = validatePaymentMethod(next);
      if (validationError) throw new PaymentMethodRouteError(validationError, 409);

      if (parsed.data.code && parsed.data.code !== current.code) {
        const duplicate = await transaction.get(db.collection("paymentMethods").where("code", "==", parsed.data.code).limit(1));
        if (!duplicate.empty) throw new PaymentMethodRouteError("معرف وسيلة الدفع مستخدم بالفعل", 409);
      }

      transaction.update(reference, next);
      transaction.create(db.collection("auditLogs").doc(), {
        action: "payment_method_updated",
        paymentMethodId: methodId,
        previousStatus: current.status,
        nextStatus: next.status,
        actorUid: owner.uid,
        at: now,
      });
      return next;
    });

    return NextResponse.json({ method: result });
  } catch (error) {
    if (error instanceof PaymentMethodRouteError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Failed to update payment method", error);
    return NextResponse.json({ error: "تعذر حفظ وسيلة الدفع" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const db = adminDb();
  if (!db) return NextResponse.json({ error: "إعداد الدفع غير متاح حاليًا" }, { status: 503 });

  try {
    const { id } = await context.params;
    const methodId = id.trim();
    if (!methodId) return NextResponse.json({ error: "معرف وسيلة الدفع غير صحيح" }, { status: 400 });
    const reference = db.collection("paymentMethods").doc(methodId);
    const now = new Date().toISOString();
    await db.runTransaction(async (transaction) => {
      const [methodSnapshot, linkedPayments] = await Promise.all([
        transaction.get(reference),
        transaction.get(db.collection("payments").where("methodId", "==", methodId).limit(1)),
      ]);
      if (!methodSnapshot.exists) throw new PaymentMethodRouteError("وسيلة الدفع غير موجودة", 404);
      if (!linkedPayments.empty) throw new PaymentMethodRouteError("لا يمكن حذف وسيلة دفع مرتبطة بسجل تحويل. عطّلها بدلًا من ذلك.", 409);
      transaction.delete(reference);
      transaction.create(db.collection("auditLogs").doc(), { action: "payment_method_deleted", paymentMethodId: methodId, actorUid: owner.uid, at: now });
    });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof PaymentMethodRouteError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Failed to delete payment method", error);
    return NextResponse.json({ error: "تعذر حذف وسيلة الدفع" }, { status: 500 });
  }
}

class PaymentMethodRouteError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
