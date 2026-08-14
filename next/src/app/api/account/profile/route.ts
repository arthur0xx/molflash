import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser } from "@/lib/api/admin-auth";
import type { CustomerProfile } from "@/lib/types";

const profileSchema = z.object({
  fullName: z.string().trim().min(2, "الاسم الكامل قصير جدًا").max(90, "الاسم الكامل طويل جدًا"),
  phone: z.string().trim().min(7, "رقم الهاتف قصير جدًا").max(24, "رقم الهاتف طويل جدًا").regex(/^[+0-9][0-9\s()-]*$/, "رقم الهاتف غير صحيح"),
});

function serializeProfile(raw: Record<string, unknown>, fallbackEmail: string | undefined): CustomerProfile {
  return {
    fullName: String(raw.fullName || "عميل ChriGsm"),
    phone: String(raw.phone || ""),
    email: String(raw.email || fallbackEmail || ""),
  };
}

export async function PATCH(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const db = adminDb();
  if (!db) return NextResponse.json({ error: "إعداد Firebase الخادمي غير مكتمل" }, { status: 503 });

  try {
    const parsed = profileSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "بيانات الحساب غير صحيحة" }, { status: 400 });

    const customerReference = db.collection("customers").doc(user.uid);
    const result = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(customerReference);
      if (!snapshot.exists) throw new Error("CUSTOMER_NOT_FOUND");

      const current = snapshot.data() as Record<string, unknown>;
      const profile = serializeProfile(current, user.email);
      const changedFields = (["fullName", "phone"] as const).filter((field) => profile[field] !== parsed.data[field]);
      if (changedFields.length === 0) return { profile, changed: false };

      const now = new Date().toISOString();
      transaction.update(customerReference, {
        fullName: parsed.data.fullName,
        phone: parsed.data.phone,
        updatedAt: now,
      });
      transaction.create(db.collection("auditLogs").doc(), {
        action: "customer_profile_updated",
        customerId: user.uid,
        actorUid: user.uid,
        changedFields,
        at: now,
      });
      return {
        profile: { ...profile, fullName: parsed.data.fullName, phone: parsed.data.phone },
        changed: true,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "CUSTOMER_NOT_FOUND") return NextResponse.json({ error: "ملف العميل غير موجود" }, { status: 404 });
    console.error("Failed to update customer profile", error);
    return NextResponse.json({ error: "تعذر حفظ إعدادات الحساب" }, { status: 500 });
  }
}
