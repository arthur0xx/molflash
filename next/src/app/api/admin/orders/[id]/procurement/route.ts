import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireStaff } from "@/lib/api/admin-auth";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff(request, "orders");
  if (!staff) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const db = adminDb();
  if (!db) return NextResponse.json({ error: "إعداد Firebase الخادمي غير مكتمل" }, { status: 503 });

  const { id } = await context.params;
  const orderId = id.trim();
  if (!orderId) return NextResponse.json({ error: "معرف الطلب غير صحيح" }, { status: 400 });

  const order = await db.collection("orders").doc(orderId).get();
  if (!order.exists) return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });

  const serviceId = order.data()?.serviceId;
  if (typeof serviceId !== "string" || !serviceId) return NextResponse.json({ error: "الخدمة المرتبطة بالطلب غير صحيحة" }, { status: 400 });

  const privateRecord = await db.collection("servicePrivate").doc(serviceId).get();
  const purchaseUrl = privateRecord.exists && typeof privateRecord.data()?.purchaseUrl === "string" ? privateRecord.data()?.purchaseUrl : null;
  return NextResponse.json({ purchaseUrl });
}
