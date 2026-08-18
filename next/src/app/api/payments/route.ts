import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireVerifiedUser } from "@/lib/api/admin-auth";
import { expiresPaymentReference, generatePaymentReference, renderPaymentInstructions, toPaymentMethodSnapshot } from "@/lib/payments";
import type { PaymentMethod, PaymentRecord } from "@/lib/types";

const createPaymentSchema = z.discriminatedUnion("purpose", [
  z.object({ purpose: z.literal("order"), orderId: z.string().trim().min(1, "الطلب غير محدد").max(128), methodId: z.string().trim().min(1, "اختر وسيلة دفع").max(128) }),
  z.object({ purpose: z.literal("wallet_topup"), amountMad: z.number().finite().min(1, "قيمة شحن الرصيد غير صحيحة").max(1000000, "قيمة شحن الرصيد أكبر من الحد المسموح").refine((value) => Math.round(value * 100) === value * 100, "القيمة تتجاوز منزلتين عشريتين"), methodId: z.string().trim().min(1, "اختر وسيلة دفع").max(128) }),
]);

function supportsScope(method: PaymentMethod, purpose: PaymentRecord["purpose"]) {
  return method.scope === "both" || method.scope === purpose;
}

export async function GET(request: NextRequest) {
  const user = await requireVerifiedUser(request);
  if (!user) return NextResponse.json({ error: "أكد بريدك الإلكتروني ثم سجّل الدخول لاختيار وسيلة الدفع" }, { status: 401 });

  const db = adminDb();
  if (!db) return NextResponse.json({ error: "خدمة الدفع غير متاحة حاليًا" }, { status: 503 });

  try {
    // تجنب فهرس Firestore مركب غير ضروري: العدد صغير والترتيب يتم بعد قراءة الوسائل المفعلة فقط.
    const snapshot = await db.collection("paymentMethods").where("status", "==", "active").get();
    const methods = snapshot.docs
      .map((document) => ({ id: document.id, ...document.data() } as PaymentMethod))
      .filter((method) => method.type !== "electronic_gateway")
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((method) => ({ id: method.id, title: method.title, type: method.type, scope: method.scope }));
    return NextResponse.json({ methods });
  } catch (error) {
    console.error("Failed to list active payment methods", error);
    return NextResponse.json({ error: "تعذر تحميل وسائل الدفع" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await requireVerifiedUser(request);
  if (!user) return NextResponse.json({ error: "أكد بريدك الإلكتروني ثم سجّل الدخول لاختيار وسيلة الدفع" }, { status: 401 });

  const db = adminDb();
  if (!db) return NextResponse.json({ error: "خدمة الدفع غير متاحة حاليًا" }, { status: 503 });

  try {
    const parsed = createPaymentSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "بيانات الدفع غير صحيحة" }, { status: 400 });

    let lastCollision = false;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const paymentReference = generatePaymentReference();
      const paymentDocument = db.collection("payments").doc(paymentReference);
      const now = new Date().toISOString();
      try {
        const result = await db.runTransaction(async (transaction) => {
          const customerReference = db.collection("customers").doc(user.uid);
          const methodReference = db.collection("paymentMethods").doc(parsed.data.methodId);
          const reads = await Promise.all([transaction.get(customerReference), transaction.get(methodReference)]);
          const customerSnapshot = reads[0];
          const methodSnapshot = reads[1];
          if (!customerSnapshot.exists) throw new PaymentRouteError("ملف العميل غير موجود", 404);
          if (!methodSnapshot.exists) throw new PaymentRouteError("وسيلة الدفع غير متاحة", 404);

          const method = { id: methodSnapshot.id, ...methodSnapshot.data() } as PaymentMethod;
          if (method.status !== "active" || method.type === "electronic_gateway" || !supportsScope(method, parsed.data.purpose)) {
            throw new PaymentRouteError("وسيلة الدفع غير متاحة لهذه العملية", 409);
          }

          let amountMad: number;
          let orderId: string | undefined;
          let walletTopUpAmountMad: number | undefined;
          if (parsed.data.purpose === "order") {
            const orderReference = db.collection("orders").doc(parsed.data.orderId);
            const orderSnapshot = await transaction.get(orderReference);
            if (!orderSnapshot.exists || orderSnapshot.data()?.customerId !== user.uid) throw new PaymentRouteError("الطلب غير موجود", 404);
            const order = orderSnapshot.data() as { totalMad?: unknown; status?: unknown };
            if (typeof order.totalMad !== "number" || order.totalMad < 1 || !["new", "waiting"].includes(String(order.status))) {
              throw new PaymentRouteError("لا يمكن إنشاء تحويل يدوي لهذا الطلب حاليًا", 409);
            }
            amountMad = order.totalMad;
            orderId = orderReference.id;
            const existingPayments = await transaction.get(db.collection("payments").where("orderId", "==", orderId).limit(10));
            const hasOpenPayment = existingPayments.docs.some((document) => ["manual_transfer_pending", "under_review", "confirmed"].includes(String(document.data()?.status)));
            if (hasOpenPayment) throw new PaymentRouteError("يوجد بالفعل تحويل مسجل لهذا الطلب. تابع حالته من حسابك.", 409);
          } else {
            amountMad = parsed.data.amountMad;
            walletTopUpAmountMad = parsed.data.amountMad;
          }

          const existingPayment = await transaction.get(paymentDocument);
          if (existingPayment.exists) throw new PaymentReferenceCollision();
          const payment: PaymentRecord = {
            id: paymentReference,
            customerId: user.uid,
            purpose: parsed.data.purpose,
            ...(orderId ? { orderId } : {}),
            ...(walletTopUpAmountMad ? { walletTopUpAmountMad } : {}),
            amountMad,
            currency: "MAD",
            methodId: method.id,
            methodSnapshot: toPaymentMethodSnapshot(method),
            paymentReference,
            referenceExpiresAt: expiresPaymentReference(new Date(now)),
            status: "manual_transfer_pending",
            createdAt: now,
            updatedAt: now,
          };
          transaction.create(paymentDocument, payment);
          transaction.create(db.collection("auditLogs").doc(), { action: "manual_payment_created", paymentId: payment.id, paymentReference, purpose: payment.purpose, amountMad, customerId: user.uid, actorUid: user.uid, at: now });
          return payment;
        });

        return NextResponse.json({
          payment: result,
          instructions: renderPaymentInstructions(result.methodSnapshot.instructions, {
            amount: `${result.amountMad} د.م.`,
            paymentReference: result.paymentReference,
            orderNumber: result.orderId || "",
            walletTopUpNumber: result.purpose === "wallet_topup" ? result.id : "",
          }),
        }, { status: 201 });
      } catch (error) {
        if (error instanceof PaymentReferenceCollision) { lastCollision = true; continue; }
        throw error;
      }
    }
    if (lastCollision) return NextResponse.json({ error: "تعذر إنشاء مرجع دفع فريد. حاول مرة أخرى." }, { status: 503 });
    return NextResponse.json({ error: "تعذر إنشاء عملية الدفع" }, { status: 500 });
  } catch (error) {
    if (error instanceof PaymentRouteError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Failed to create manual payment", error);
    return NextResponse.json({ error: "تعذر إنشاء عملية الدفع" }, { status: 500 });
  }
}

class PaymentRouteError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
class PaymentReferenceCollision extends Error {}
