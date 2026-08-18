import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireVerifiedUser } from "@/lib/api/admin-auth";
import { adminDb } from "@/lib/firebase/admin";
import { createCloudinaryUploadSignature, paymentProofPublicId, readCloudinaryAuthenticatedImageMetadata } from "@/lib/cloudinary";
import type { PaymentRecord } from "@/lib/types";
import { notifyAdminPaymentProofUploaded } from "@/lib/payment-notifications";

const proofSchema = z.object({
  publicId: z.string().trim().min(5, "ملف الإثبات غير صالح").max(220, "معرف ملف الإثبات غير صالح"),
});

function paymentStillAcceptsProof(payment: PaymentRecord) {
  return payment.status === "manual_transfer_pending" && !payment.proof && Number.isFinite(new Date(payment.referenceExpiresAt).getTime()) && new Date(payment.referenceExpiresAt).getTime() >= Date.now();
}

async function getCustomerPayment(request: NextRequest, paymentId: string) {
  const user = await requireVerifiedUser(request);
  if (!user) throw new PaymentProofError("أكد بريدك الإلكتروني ثم سجّل الدخول لإرفاق إثبات التحويل", 401);

  const db = adminDb();
  if (!db) throw new PaymentProofError("خدمة إثبات التحويل غير متاحة حاليًا", 503);

  const paymentSnapshot = await db.collection("payments").doc(paymentId).get();
  if (!paymentSnapshot.exists) throw new PaymentProofError("عملية الدفع غير موجودة", 404);
  const payment = { id: paymentSnapshot.id, ...paymentSnapshot.data() } as PaymentRecord;
  if (payment.customerId !== user.uid) throw new PaymentProofError("غير مصرح بهذا التحويل", 403);
  return { db, user, payment };
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const paymentId = id.trim();
    if (!paymentId) throw new PaymentProofError("معرف عملية الدفع غير صحيح", 400);

    const { payment } = await getCustomerPayment(request, paymentId);
    if (!paymentStillAcceptsProof(payment)) throw new PaymentProofError("لا يمكن رفع إثبات لهذه العملية. راجع حالة التحويل أو أنشئ مرجعًا جديدًا عند انتهاء صلاحيته.", 409);

    const timestamp = Math.floor(Date.now() / 1000);
    const payload = createCloudinaryUploadSignature({ kind: "payment_proof", publicId: paymentProofPublicId(payment.paymentReference) }, timestamp);
    if (!payload) throw new PaymentProofError("تهيئة حفظ إثبات التحويل غير مكتملة حاليًا", 503);
    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    if (error instanceof PaymentProofError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Failed to create payment proof upload signature", error);
    return NextResponse.json({ error: "تعذر تجهيز رفع إثبات التحويل" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const paymentId = id.trim();
    if (!paymentId) throw new PaymentProofError("معرف عملية الدفع غير صحيح", 400);

    const parsed = proofSchema.safeParse(await request.json());
    if (!parsed.success) throw new PaymentProofError(parsed.error.issues[0]?.message || "بيانات إثبات التحويل غير صحيحة", 400);

    const { db, user, payment } = await getCustomerPayment(request, paymentId);
    if (!paymentStillAcceptsProof(payment)) throw new PaymentProofError("لا يمكن إرفاق إثبات بهذه العملية في حالتها الحالية", 409);

    const expectedPublicId = paymentProofPublicId(payment.paymentReference);
    if (parsed.data.publicId !== expectedPublicId) throw new PaymentProofError("ملف الإثبات لا يطابق مرجع التحويل", 409);

    const metadata = await readCloudinaryAuthenticatedImageMetadata(expectedPublicId);
    if (!metadata) throw new PaymentProofError("تعذر التحقق من صورة الإثبات. تأكد من اكتمال الرفع ثم حاول مرة أخرى.", 422);

    const now = new Date().toISOString();
    const paymentReference = db.collection("payments").doc(paymentId);
    const result = await db.runTransaction(async (transaction) => {
      const latestSnapshot = await transaction.get(paymentReference);
      if (!latestSnapshot.exists) throw new PaymentProofError("عملية الدفع غير موجودة", 404);
      const latest = { id: latestSnapshot.id, ...latestSnapshot.data() } as PaymentRecord;
      if (latest.customerId !== user.uid) throw new PaymentProofError("غير مصرح بهذا التحويل", 403);
      if (!paymentStillAcceptsProof(latest)) throw new PaymentProofError("تمت معالجة إثبات هذه العملية أو انتهت صلاحيتها", 409);

      const proof = { ...metadata, submittedAt: now };
      const next = { ...latest, proof, status: "proof_submitted" as const, updatedAt: now };
      transaction.update(paymentReference, { proof, status: next.status, updatedAt: next.updatedAt });
      transaction.create(db.collection("auditLogs").doc(), {
        action: "manual_payment_proof_submitted",
        paymentId: latest.id,
        paymentReference: latest.paymentReference,
        customerId: user.uid,
        purpose: latest.purpose,
        amountMad: latest.amountMad,
        actorUid: user.uid,
        at: now,
      });
      return next;
    });

    after(async () => { await notifyAdminPaymentProofUploaded(result); });
    return NextResponse.json({ payment: result });
  } catch (error) {
    if (error instanceof PaymentProofError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Failed to attach payment proof", error);
    return NextResponse.json({ error: "تعذر حفظ إثبات التحويل" }, { status: 500 });
  }
}

class PaymentProofError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
