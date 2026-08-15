import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api/admin-auth";
import { adminDb } from "@/lib/firebase/admin";

const registrationSchema = z.object({
  fullName: z.string().trim().min(2, "أدخل الاسم الكامل.").max(80, "الاسم طويل جدًا."),
  phone: z.string().trim().max(32, "رقم الهاتف طويل جدًا.").optional().default(""),
});

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "انتهت جلسة التسجيل. أعد المحاولة." }, { status: 401 });

  const db = adminDb();
  if (!db) return NextResponse.json({ error: "إعداد خدمة التسجيل غير مكتمل حاليًا." }, { status: 503 });

  const parsed = registrationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "بيانات التسجيل غير صحيحة." }, { status: 400 });

  const email = typeof user.email === "string" ? user.email : "";
  if (!email) return NextResponse.json({ error: "تعذر التحقق من بريد الحساب." }, { status: 409 });

  const customerReference = db.collection("customers").doc(user.uid);
  const now = new Date().toISOString();

  try {
    await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(customerReference);
      if (existing.exists) return;

      transaction.create(customerReference, {
        email,
        fullName: parsed.data.fullName,
        phone: parsed.data.phone,
        role: "customer",
        accountStatus: "active",
        walletMad: 0,
        avatarUrl: "",
        createdAt: now,
        updatedAt: now,
      });
      transaction.create(db.collection("auditLogs").doc(), {
        action: "customer_registered",
        customerId: user.uid,
        actorUid: user.uid,
        at: now,
      });
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Failed to register customer profile", error);
    return NextResponse.json({ error: "تعذر إنشاء ملف العميل حاليًا." }, { status: 500 });
  }
}
