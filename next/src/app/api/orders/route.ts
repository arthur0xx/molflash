import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

type CreateOrderBody = { serviceId?: string; formData?: Record<string, string> };

async function requireUser(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const auth = adminAuth();
  if (!token || !auth) return null;
  return auth.verifyIdToken(token);
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (!user) return NextResponse.json({ error: "سجّل الدخول أولًا" }, { status: 401 });
    const db = adminDb();
    if (!db) return NextResponse.json({ error: "إعداد Firebase الخادمي غير مكتمل" }, { status: 503 });

    const body = await request.json() as CreateOrderBody;
    if (!body.serviceId || !body.formData || typeof body.formData !== "object") return NextResponse.json({ error: "بيانات الطلب غير مكتملة" }, { status: 400 });
    const service = await db.collection("services").doc(body.serviceId).get();
    if (!service.exists || service.data()?.isActive !== true) return NextResponse.json({ error: "الخدمة غير متاحة" }, { status: 404 });

    const now = new Date().toISOString();
    const id = `ORD-${String(Date.now()).slice(-8)}`;
    const serviceData = service.data() as { priceMad: number; title: string };
    await db.collection("orders").doc(id).set({
      customerId: user.uid,
      serviceId: body.serviceId,
      status: "new",
      totalMad: serviceData.priceMad,
      createdAt: now,
      updatedAt: now,
      formData: body.formData,
      statusHistory: [{ status: "new", at: now, note: "تم إنشاء الطلب" }],
      demo: true,
    });
    await db.collection("auditLogs").add({ action: "order_created", orderId: id, actorUid: user.uid, at: now, demo: true });
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error("Failed to create order", error);
    return NextResponse.json({ error: "تعذر إنشاء الطلب" }, { status: 500 });
  }
}
