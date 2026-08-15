import { createHash, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireVerifiedUser } from "@/lib/api/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const confirmSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/, "أدخل رمزًا مكوّنًا من 6 أرقام") });
function response(body: Record<string, unknown>, status = 200) { return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } }); }
function safeEqual(left: string, right: string) {
  const a = Buffer.from(left, "utf8"); const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const user = await requireVerifiedUser(request);
  if (!user) return response({ error: "انتهت جلستك. سجّل الدخول ثم أعد المحاولة." }, 401);
  const parsed = confirmSchema.safeParse(await request.json());
  if (!parsed.success) return response({ error: parsed.error.issues[0]?.message || "رمز التأكيد غير صحيح." }, 400);
  const db = adminDb();
  if (!db) return response({ error: "خدمة التأكيد غير متاحة حاليًا." }, 503);
  const challengeReference = db.collection("phoneVerificationChallenges").doc(user.uid);
  const customerReference = db.collection("customers").doc(user.uid);
  const now = new Date().toISOString();
  try {
    const phone = await db.runTransaction(async (transaction) => {
      const challenge = await transaction.get(challengeReference);
      if (!challenge.exists) throw new Error("CHALLENGE_MISSING");
      const raw = challenge.data() as Record<string, unknown>;
      const expiresAt = typeof raw.expiresAt === "string" ? raw.expiresAt : "";
      const attempts = typeof raw.attempts === "number" ? raw.attempts : 0;
      if (!expiresAt || Date.parse(expiresAt) <= Date.now()) { transaction.delete(challengeReference); throw new Error("CHALLENGE_EXPIRED"); }
      if (attempts >= 5) { transaction.delete(challengeReference); throw new Error("CHALLENGE_LOCKED"); }
      const candidate = createHash("sha256").update(`${user.uid}:${parsed.data.code}`).digest("hex");
      if (!safeEqual(candidate, String(raw.codeHash || ""))) { transaction.update(challengeReference, { attempts: attempts + 1, updatedAt: now }); throw new Error("CODE_INVALID"); }
      const phone = String(raw.phone || "");
      if (!phone) throw new Error("CHALLENGE_MISSING");
      transaction.update(customerReference, { phone, phoneVerifiedAt: now, whatsappEnabled: true, notificationPreferences: { email: true, whatsapp: true }, updatedAt: now });
      transaction.delete(challengeReference);
      transaction.create(db.collection("auditLogs").doc(), { action: "customer_phone_verified", customerId: user.uid, actorUid: user.uid, at: now });
      return phone;
    });
    return response({ status: "verified", phone });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const messages: Record<string, string> = { CHALLENGE_MISSING: "اطلب رمزًا جديدًا ثم أعد المحاولة.", CHALLENGE_EXPIRED: "انتهت صلاحية الرمز. اطلب رمزًا جديدًا.", CHALLENGE_LOCKED: "تجاوزت محاولات الرمز. اطلب رمزًا جديدًا.", CODE_INVALID: "رمز التأكيد غير صحيح." };
    if (messages[code]) return response({ error: messages[code] }, 400);
    console.error("Failed to confirm WhatsApp phone", error);
    return response({ error: "تعذر تأكيد الرقم حاليًا. حاول لاحقًا." }, 503);
  }
}
