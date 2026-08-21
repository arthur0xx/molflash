import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireVerifiedUser } from "@/lib/api/admin-auth";
import { registerExpoPushToken, unregisterExpoPushTokens } from "@/lib/expo-push";

const pushTokenSchema = z.object({
  expoPushToken: z.string().trim().min(20).max(260),
  platform: z.enum(["android", "ios"]),
});

function response(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const user = await requireVerifiedUser(request);
  if (!user) return response({ error: "أكد بريدك الإلكتروني ثم سجّل الدخول لتفعيل الإشعارات." }, 401);
  const parsed = pushTokenSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return response({ error: "بيانات إشعارات الجهاز غير صحيحة." }, 400);
  try {
    await registerExpoPushToken({ customerId: user.uid, token: parsed.data.expoPushToken, platform: parsed.data.platform });
    return response({ ok: true }, 201);
  } catch (error) {
    console.error("Failed to register Expo push token", error);
    return response({ error: "تعذر تفعيل الإشعارات على هذا الجهاز." }, 503);
  }
}

export async function DELETE(request: NextRequest) {
  const user = await requireVerifiedUser(request);
  if (!user) return response({ ok: true });
  try {
    await unregisterExpoPushTokens(user.uid);
    return response({ ok: true });
  } catch (error) {
    console.error("Failed to unregister Expo push tokens", error);
    return response({ error: "تعذر إلغاء إشعارات الجهاز." }, 503);
  }
}
