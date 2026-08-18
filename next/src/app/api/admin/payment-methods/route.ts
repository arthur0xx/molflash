import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireOwner } from "@/lib/api/admin-auth";
import { paymentMethodCreateSchema, providerForPaymentMethod } from "@/lib/payment-method-validation";
import type { PaymentMethod } from "@/lib/types";

export async function GET(request: NextRequest) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const db = adminDb();
  if (!db) return NextResponse.json({ error: "إعداد الدفع غير متاح حاليًا" }, { status: 503 });

  try {
    const methods = await db.collection("paymentMethods").orderBy("sortOrder", "asc").get();
    return NextResponse.json({ methods: methods.docs.map((document) => ({ id: document.id, ...document.data() })) as PaymentMethod[] });
  } catch (error) {
    console.error("Failed to list payment methods", error);
    return NextResponse.json({ error: "تعذر تحميل وسائل الدفع" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const db = adminDb();
  if (!db) return NextResponse.json({ error: "إعداد الدفع غير متاح حاليًا" }, { status: 503 });

  try {
    const parsed = paymentMethodCreateSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "بيانات وسيلة الدفع غير صحيحة" }, { status: 400 });

    const existing = await db.collection("paymentMethods").where("code", "==", parsed.data.code).limit(1).get();
    if (!existing.empty) return NextResponse.json({ error: "معرف وسيلة الدفع مستخدم بالفعل" }, { status: 409 });

    const now = new Date().toISOString();
    const reference = db.collection("paymentMethods").doc();
    const method: PaymentMethod = {
      id: reference.id,
      ...parsed.data,
      provider: providerForPaymentMethod(parsed.data),
      createdAt: now,
      updatedAt: now,
      createdBy: owner.uid,
      updatedBy: owner.uid,
    };

    const auditReference = db.collection("auditLogs").doc();
    const batch = db.batch();
    batch.create(reference, method);
    batch.create(auditReference, { action: "payment_method_created", paymentMethodId: reference.id, code: method.code, type: method.type, status: method.status, actorUid: owner.uid, at: now });
    await batch.commit();

    return NextResponse.json({ method }, { status: 201 });
  } catch (error) {
    console.error("Failed to create payment method", error);
    return NextResponse.json({ error: "تعذر إنشاء وسيلة الدفع" }, { status: 500 });
  }
}
