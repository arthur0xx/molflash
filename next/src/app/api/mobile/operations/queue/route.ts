import { NextRequest, NextResponse } from "next/server";

import { requireStaff } from "@/lib/api/admin-auth";
import { adminDb } from "@/lib/firebase/admin";

type PermissionSet = { orders: boolean; support: boolean };

function staffPermissions(user: Awaited<ReturnType<typeof requireStaff>>): PermissionSet {
  if (!user) return { orders: false, support: false };
  if (user.role === "admin" || user.role === "owner") return { orders: true, support: true };
  const claims = user.managerPermissions as Record<string, unknown> | undefined;
  return { orders: claims?.orders === true, support: claims?.support === true };
}

function stringRecord(value: unknown) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([, item]) => typeof item === "string" && item.length <= 4000));
}

export async function GET(request: NextRequest) {
  const user = await requireStaff(request);
  if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  const capabilities = staffPermissions(user);
  if (!capabilities.orders && !capabilities.support) return NextResponse.json({ error: "لا تملك صلاحية عمليات على الهاتف." }, { status: 403 });
  const db = adminDb();
  if (!db) return NextResponse.json({ error: "إعداد Firebase الخادمي غير مكتمل" }, { status: 503 });

  try {
    const [orderSnapshot, supportSnapshot] = await Promise.all([
      capabilities.orders ? db.collection("orders").orderBy("updatedAt", "desc").limit(50).get() : Promise.resolve(null),
      capabilities.support ? db.collection("supportTickets").orderBy("updatedAt", "desc").limit(50).get() : Promise.resolve(null),
    ]);
    const orders = orderSnapshot?.docs.map((item) => {
      const raw = item.data() as Record<string, unknown>;
      return {
        id: item.id,
        customerId: String(raw.customerId || ""),
        serviceId: String(raw.serviceId || ""),
        status: String(raw.status || "new"),
        totalMad: typeof raw.totalMad === "number" ? raw.totalMad : 0,
        createdAt: String(raw.createdAt || ""),
        updatedAt: String(raw.updatedAt || raw.createdAt || ""),
        formData: stringRecord(raw.formData),
        deliveryCode: typeof raw.deliveryCode === "string" ? raw.deliveryCode : undefined,
        deliveryNote: typeof raw.deliveryNote === "string" ? raw.deliveryNote : undefined,
      };
    }).filter((item) => item.status !== "rejected" && item.status !== "completed") ?? [];
    const tickets = supportSnapshot?.docs.map((item) => {
      const raw = item.data() as Record<string, unknown>;
      return {
        id: item.id,
        customerId: String(raw.customerId || ""),
        subject: String(raw.subject || ""),
        message: String(raw.message || ""),
        status: raw.status === "answered" ? "answered" : "open",
        createdAt: String(raw.createdAt || ""),
        updatedAt: String(raw.updatedAt || raw.createdAt || ""),
      };
    }).filter((item) => item.status === "open") ?? [];
    return NextResponse.json({ capabilities, orders, tickets }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Failed to load mobile operations queue", error);
    return NextResponse.json({ error: "تعذر تحميل قائمة العمليات." }, { status: 500 });
  }
}
