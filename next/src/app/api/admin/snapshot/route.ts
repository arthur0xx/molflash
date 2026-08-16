import { NextRequest, NextResponse } from "next/server";
import { emptyStoreSnapshot, getOrderStaffSnapshot, getSnapshot } from "@/lib/repository";
import { requireStaff } from "@/lib/api/admin-auth";

export async function GET(request: NextRequest) {
  const staff = await requireStaff(request);
  if (!staff) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  try {
    if (staff.role === "admin" || staff.role === "owner") {
      return NextResponse.json({ snapshot: await getSnapshot(), scope: "owner" as const });
    }

    const permissions = staff.managerPermissions as Record<string, unknown> | undefined;
    if (permissions?.orders === true) {
      return NextResponse.json({ snapshot: await getOrderStaffSnapshot(), scope: "orders" as const });
    }

    if (permissions?.support === true) {
      return NextResponse.json({ snapshot: emptyStoreSnapshot(), scope: "support" as const });
    }

    return NextResponse.json({ error: "لا تملك صلاحية الوصول إلى CMC." }, { status: 403 });
  } catch (error) {
    console.error("Failed to load protected admin snapshot", error);
    return NextResponse.json({ error: "تعذر تحميل بيانات CMC" }, { status: 500 });
  }
}
