import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireOwner } from "@/lib/api/admin-auth";
import type { PaymentMethod, PaymentMethodType } from "@/lib/types";

const patchSchema = z.object({
  title: z.string().trim().min(2, "اسم وسيلة الدفع قصير جدًا").max(100, "اسم وسيلة الدفع طويل جدًا").optional(),
  code: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "معرف وسيلة الدفع غير صحيح").min(2).max(60).optional(),
  type: z.enum(["cash_transfer", "bank_transfer", "electronic_gateway"]).optional(),
  status: z.enum(["draft", "active", "disabled"]).optional(),
  scope: z.enum(["order", "wallet_topup", "both"]).optional(),
  instructions: z.string().trim().max(2400, "تعليمات الدفع طويلة جدًا").optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
  provider: z.enum(["cmi", "payzone", "custom"]).optional(),
}).refine((value) => Object.keys(value).length > 0, "لا يوجد تغيير للحفظ");

function validateEffectiveMethod(method: Pick<PaymentMethod, "type" | "status" | "instructions" | "provider">) {
  if (method.type === "electronic_gateway" && method.status === "active") return "لا يمكن تفعيل بوابة إلكترونية قبل اكتمال الربط الخادمي واختبارها.";
  if (method.type !== "electronic_gateway" && method.status === "active" && method.instructions.trim().length < 8) return "اكتب تعليمات تحويل واضحة قبل تفعيل الوسيلة.";
  if (method.type === "electronic_gateway" && !method.provider) return "حدد مزود البوابة الإلكترونية.";
  return null;
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const db = adminDb();
  if (!db) return NextResponse.json({ error: "إعداد الدفع غير متاح حاليًا" }, { status: 503 });

  try {
    const { id } = await context.params;
    const methodId = id.trim();
    if (!methodId) return NextResponse.json({ error: "معرف وسيلة الدفع غير صحيح" }, { status: 400 });

    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "بيانات وسيلة الدفع غير صحيحة" }, { status: 400 });

    const reference = db.collection("paymentMethods").doc(methodId);
    const now = new Date().toISOString();
    const result = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) throw new PaymentMethodRouteError("وسيلة الدفع غير موجودة", 404);
      const current = { id: snapshot.id, ...snapshot.data() } as PaymentMethod;
      const nextType = parsed.data.type || current.type;
      const nextProvider = nextType === "electronic_gateway" ? parsed.data.provider || current.provider || "custom" : "custom";
      const next = {
        ...current,
        ...parsed.data,
        type: nextType as PaymentMethodType,
        provider: nextProvider,
        updatedAt: now,
        updatedBy: owner.uid,
      } as PaymentMethod;
      const validationError = validateEffectiveMethod(next);
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
