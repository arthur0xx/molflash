import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendPasswordResetEmailForAddress } from "@/lib/auth-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  email: z.string().trim().toLowerCase().email("أدخل بريدًا إلكترونيًا صالحًا.").max(254),
});

type RateEntry = { count: number; resetAt: number };
const rateLimitStore = new Map<string, RateEntry>();
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT = 5;

function clientKey(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

function withinRateLimit(key: string) {
  const now = Date.now();
  const current = rateLimitStore.get(key);
  if (!current || current.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (current.count >= RATE_LIMIT) return false;
  current.count += 1;
  return true;
}

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!withinRateLimit(clientKey(request))) {
    return response({ error: "تم إرسال طلبات كثيرة من هذا الاتصال. انتظر قليلًا ثم أعد المحاولة." }, 429);
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return response({ error: parsed.error.issues[0]?.message || "بيانات غير صحيحة." }, 400);

  const result = await sendPasswordResetEmailForAddress(parsed.data.email);
  if (result === "unavailable") return response({ error: "استعادة كلمة المرور غير متاحة حاليًا. حاول لاحقًا." }, 503);

  // النتيجة موحدة عمدًا حتى لا يكشف المسار ما إذا كان البريد مرتبطًا بحساب.
  return response({ status: "sent" });
}
