import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api/admin-auth";
import { sendVerificationEmailForUser } from "@/lib/auth-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return response({ error: "انتهت جلستك. سجّل الدخول ثم أعد المحاولة." }, 401);

  const result = await sendVerificationEmailForUser(user.uid);
  if (result === "sent") return response({ status: "sent" });
  if (result === "already-verified") return response({ status: "already-verified" });
  return response({ error: "تعذر إرسال رابط التأكيد حاليًا. حاول لاحقًا." }, 503);
}
