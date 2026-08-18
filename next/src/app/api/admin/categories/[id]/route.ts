import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireOwner, requireStaff } from "@/lib/api/admin-auth";

const updateCategorySchema = z.object({
  name: z.string().trim().min(2, "اسم التصنيف قصير جدًا").max(80, "اسم التصنيف طويل جدًا").optional(),
  icon: z.string().trim().min(1, "الأيقونة مطلوبة").max(160, "قيمة الأيقونة طويلة جدًا").optional(),
  color: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, "لون التصنيف غير صحيح").optional(),
  description: z.string().trim().max(500, "وصف التصنيف طويل جدًا").optional(),
  order: z.number().int().min(0).max(10000).optional(),
  isActive: z.boolean().optional(),
}).refine((body) => Object.keys(body).length > 0, "لا توجد بيانات للتعديل");

function categoryReferenceId(params: { id: string }) {
  return params.id.trim();
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await requireStaff(request, "catalog");
  if (!admin) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const db = adminDb();
  if (!db) return NextResponse.json({ error: "إعداد Firebase الخادمي غير مكتمل" }, { status: 503 });

  try {
    const { id } = await context.params;
    const categoryId = categoryReferenceId({ id });
    if (!categoryId) return NextResponse.json({ error: "معرف التصنيف غير صحيح" }, { status: 400 });

    const parsed = updateCategorySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "بيانات التصنيف غير صحيحة" }, { status: 400 });
    }

    if (admin.role === "manager" && Object.prototype.hasOwnProperty.call(parsed.data, "isActive")) return NextResponse.json({ error: "إتاحة التصنيف للعملاء يراجعها المالك فقط." }, { status: 403 });

    const reference = db.collection("categories").doc(categoryId);
    const snapshot = await reference.get();
    if (!snapshot.exists) return NextResponse.json({ error: "التصنيف غير موجود" }, { status: 404 });

    const now = new Date().toISOString();
    await reference.update({ ...parsed.data, updatedAt: now, updatedBy: admin.uid });
    await db.collection("auditLogs").add({
      action: "category_updated",
      categoryId,
      fields: Object.keys(parsed.data),
      actorUid: admin.uid,
      at: now,
    });

    return NextResponse.json({ category: { id: categoryId, ...snapshot.data(), ...parsed.data, updatedAt: now } });
  } catch (error) {
    console.error("Failed to update category", error);
    return NextResponse.json({ error: "تعذر تعديل التصنيف" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await requireOwner(request);
  if (!admin) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const db = adminDb();
  if (!db) return NextResponse.json({ error: "إعداد Firebase الخادمي غير مكتمل" }, { status: 503 });

  try {
    const { id } = await context.params;
    const categoryId = categoryReferenceId({ id });
    if (!categoryId) return NextResponse.json({ error: "معرف التصنيف غير صحيح" }, { status: 400 });

    const categoryReference = db.collection("categories").doc(categoryId);
    const category = await categoryReference.get();
    if (!category.exists) return NextResponse.json({ error: "التصنيف غير موجود" }, { status: 404 });

    const services = await db.collection("services").where("categoryId", "==", categoryId).get();
    const linkedOrderChecks = await Promise.all(
      services.docs.map((service) => db.collection("orders").where("serviceId", "==", service.id).limit(1).get()),
    );
    if (linkedOrderChecks.some((orders) => !orders.empty)) {
      return NextResponse.json({ error: "لا يمكن حذف تصنيف يحتوي خدمات مرتبطة بطلبات. عطّل التصنيف أو انقل الخدمات بدلًا من ذلك." }, { status: 409 });
    }

    const now = new Date().toISOString();
    const batch = db.batch();
    services.docs.forEach((service) => batch.delete(service.ref));
    batch.delete(categoryReference);
    await batch.commit();

    await db.collection("auditLogs").add({
      action: "category_deleted_cascade",
      categoryId,
      deletedServiceCount: services.size,
      actorUid: admin.uid,
      at: now,
    });

    return NextResponse.json({ ok: true, deletedServiceCount: services.size });
  } catch (error) {
    console.error("Failed to delete category", error);
    return NextResponse.json({ error: "تعذر حذف التصنيف" }, { status: 500 });
  }
}
