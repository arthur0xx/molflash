import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api/admin-auth";
import { sendVerificationEmailForUser } from "@/lib/auth-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT = 3;
type RateEntry = { count: number; resetAt: number };
const verificationRateLimit = new Map<string, RateEntry>();

function withinRateLimit(uid: string) {
  const now = Date.now();
  const current = verificationRateLimit.get(uid);
  if (!current || current.resetAt <= now) {
    verificationRateLimit.set(uid, { count: 1, resetAt: now + RATE_WINDOW_MS });
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
  const user = await requireUser(request);
  if (!user) return response({ error: "انتهت جلستك. سجّل الدخول ثم أعد المحاولة." }, 401);
  if (!withinRateLimit(user.uid)) return response({ error: "تم إرسال طلبات كثيرة. انتظر قليلًا ثم أعد المحاولة." }, 429);

  const result = await sendVerificationEmailForUser(user.uid);
  if (result === "sent") return response({ status: "sent" });
  if (result === "already-verified") return response({ status: "already-verified" });
  return response({ error: "تعذر إرسال رابط التأكيد حاليًا. حاول لاحقًا." }, 503);
}
