import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/api/admin-auth";
import { adminDb } from "@/lib/firebase/admin";
import { blogAiActions, blogAiStatus, requestBlogAiDraft } from "@/lib/blog-ai";

const requestSchema = z.object({
  action: z.enum(blogAiActions),
  prompt: z.string().trim().min(8, "اكتب طلبًا واضحًا من 8 أحرف على الأقل.").max(5000, "طلب الكتابة طويل جدًا."),
  title: z.string().trim().max(180).optional(),
  excerpt: z.string().trim().max(420).optional(),
  markdown: z.string().max(60_000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
});

function dailyLimit() {
  const value = Number(process.env.CONTENT_AI_DAILY_LIMIT || "12");
  return Number.isInteger(value) && value >= 1 && value <= 100 ? value : 12;
}

async function reserveDailyRequest(uid: string) {
  const db = adminDb();
  if (!db) throw new Error("FIREBASE_UNAVAILABLE");
  const date = new Date().toISOString().slice(0, 10);
  const document = db.collection("blogAiUsage").doc(`${date}_${uid}`);
  const limit = dailyLimit();
  let count = 0;
  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(document);
    const previousCount = Number(current.data()?.count || 0);
    if (previousCount >= limit) throw new Error("CONTENT_AI_LIMIT_REACHED");
    count = previousCount + 1;
    transaction.set(document, { uid, date, count, limit, updatedAt: new Date().toISOString() }, { merge: true });
  });
  return { count, limit };
}

export async function GET(request: NextRequest) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  return NextResponse.json({ ai: blogAiStatus(), dailyLimit: dailyLimit() });
}

export async function POST(request: NextRequest) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "طلب الذكاء الاصطناعي غير صحيح." }, { status: 400 });
  const status = blogAiStatus();
  if (!status.configured || !status.enabled) return NextResponse.json({ error: "موصل كتابة المدونة غير مفعّل أو لم يكتمل إعداده على الخادم." }, { status: 503 });

  try {
    const usage = await reserveDailyRequest(owner.uid);
    const result = await requestBlogAiDraft(parsed.data);
    const db = adminDb();
    await db?.collection("auditLogs").add({ action: "blog_ai_draft_requested", actorUid: owner.uid, aiAction: parsed.data.action, provider: result.provider, model: result.model, at: new Date().toISOString() });
    return NextResponse.json({ draft: result.draft, provider: result.provider, model: result.model, usage: { used: usage.count, limit: usage.limit } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "CONTENT_AI_PROVIDER_FAILED";
    if (code === "CONTENT_AI_LIMIT_REACHED") return NextResponse.json({ error: `وصلت إلى الحد اليومي لمساعد المدونة (${dailyLimit()} طلبًا).` }, { status: 429 });
    if (code === "CONTENT_AI_TIMEOUT") return NextResponse.json({ error: "تأخر مزود الذكاء الاصطناعي في الرد. أعد المحاولة لاحقًا." }, { status: 504 });
    if (code === "CONTENT_AI_EMPTY_RESPONSE") return NextResponse.json({ error: "لم يُرجع المزود نصًا صالحًا للمراجعة." }, { status: 502 });
    if (code === "FIREBASE_UNAVAILABLE") return NextResponse.json({ error: "إعداد Firebase الخادمي غير متاح حاليًا." }, { status: 503 });
    console.error("Blog AI request failed", { code, actorUid: owner.uid });
    return NextResponse.json({ error: "تعذر إنشاء مسودة AI الآن. راجع إعداد المزود أو حاول لاحقًا." }, { status: 502 });
  }
}
