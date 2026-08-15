import { createHash, randomInt } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireVerifiedUser } from "@/lib/api/admin-auth";
import { normalizeMoroccanMobile, phoneVerificationTemplate, sendWhatsAppTemplate, whatsappConfigured } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({ phone: z.string().trim().min(7).max(32) });
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT = 3;
const requestLimit = new Map<string, { count: number; resetAt: number }>();

function canRequest(uid: string) {
  const now = Date.now();
  const current = requestLimit.get(uid);
  if (!current || current.resetAt <= now) { requestLimit.set(uid, { count: 1, resetAt: now + RATE_WINDOW_MS }); return true; }
  if (current.count >= RATE_LIMIT) return false;
  current.count += 1;
  return true;
}
function response(body: Record<string, unknown>, status = 200) { return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } }); }

export async function POST(request: NextRequest) {
  const user = await requireVerifiedUser(request);
  if (!user) return response({ error: "انتهت جلستك. سجّل الدخول ثم أعد المحاولة." }, 401);
  if (!canRequest(user.uid)) return response({ error: "تم إرسال طلبات كثيرة. انتظر 15 دقيقة ثم أعد المحاولة." }, 429);
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return response({ error: "رقم الهاتف غير صحيح." }, 400);
  const phone = normalizeMoroccanMobile(parsed.data.phone);
  if (!phone) return response({ error: "أدخل رقم هاتف مغربي صحيح يبدأ بـ06 أو 07." }, 400);
  const template = phoneVerificationTemplate();
  if (!whatsappConfigured() || !template) return response({ error: "تأكيد واتساب غير مفعّل حاليًا. يمكنك حفظ الرقم والمحاولة لاحقًا." }, 503);
  const db = adminDb();
  if (!db) return response({ error: "خدمة التأكيد غير متاحة حاليًا." }, 503);

  const code = String(randomInt(100000, 1000000));
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  try {
    await db.collection("phoneVerificationChallenges").doc(user.uid).set({ phone, codeHash: createHash("sha256").update(`${user.uid}:${code}`).digest("hex"), expiresAt, attempts: 0, createdAt: now, updatedAt: now });
    await sendWhatsAppTemplate({ to: phone, template, bodyParameters: [code] });
    await db.collection("notificationLogs").doc(`phone:${user.uid}:${now.slice(0, 13)}`).set({ eventType: "phone_verification", customerId: user.uid, direction: "outbound", status: "sent", createdAt: now, updatedAt: now });
    return response({ status: "sent", expiresAt });
  } catch (error) {
    console.error("Failed to send WhatsApp verification", error);
    return response({ error: "تعذر إرسال رمز واتساب حاليًا. حاول لاحقًا." }, 503);
  }
}
