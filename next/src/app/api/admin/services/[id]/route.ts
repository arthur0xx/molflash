import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/api/admin-auth";

const dynamicFieldSchema = z.object({
  id: z.string().trim().regex(/^[a-z0-9-]{2,50}$/i, "معرف الحقل غير صحيح"),
  label: z.string().trim().min(2, "اسم الحقل قصير جدًا").max(120, "اسم الحقل طويل جدًا"),
  type: z.enum(["text", "email", "select", "textarea"]),
  required: z.boolean(),
  placeholder: z.string().trim().max(160, "النص المساعد طويل جدًا").optional(),
  options: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
}).superRefine((field, context) => {
  if (field.type === "select" && (!field.options || field.options.length === 0)) {
    context.addIssue({ code: "custom", message: "حقل الاختيار يحتاج خيارات" });
  }
  if (field.type !== "select" && field.options?.length) {
    context.addIssue({ code: "custom", message: "الخيارات مسموحة لحقل الاختيار فقط" });
  }
});

const updateServiceSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, "رابط الخدمة غير صحيح").min(2).max(100).optional(),
  title: z.string().trim().min(2, "اسم الخدمة قصير جدًا").max(160, "اسم الخدمة طويل جدًا").optional(),
  categoryId: z.string().trim().min(1, "اختر تصنيفًا صالحًا").max(128).optional(),
  description: z.string().trim().min(4, "وصف الخدمة قصير جدًا").max(2000, "وصف الخدمة طويل جدًا").optional(),
  priceMad: z.number().finite().min(0, "السعر لا يمكن أن يكون سالبًا").max(1000000, "السعر أكبر من الحد المسموح").optional(),
  delivery: z.string().trim().min(2, "مدة أو نوع التسليم مطلوب").max(200, "معلومة التسليم طويلة جدًا").optional(),
  badge: z.string().trim().max(80, "الشارة طويلة جدًا").nullable().optional(),
  isActive: z.boolean().optional(),
  fields: z.array(dynamicFieldSchema).max(20, "عدد الحقول كبير جدًا").optional(),
}).refine((body) => Object.keys(body).length > 0, "لا توجد بيانات للتعديل").superRefine((service, context) => {
  if (service.fields) {
    const ids = service.fields.map((field) => field.id);
    if (new Set(ids).size !== ids.length) context.addIssue({ code: "custom", message: "معرفات الحقول يجب أن تكون فريدة" });
  }
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const db = adminDb();
  if (!db) return NextResponse.json({ error: "إعداد Firebase الخادمي غير مكتمل" }, { status: 503 });

  try {
    const { id } = await context.params;
    const serviceId = id.trim();
    if (!serviceId) return NextResponse.json({ error: "معرف الخدمة غير صحيح" }, { status: 400 });

    const parsed = updateServiceSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "بيانات الخدمة غير صحيحة" }, { status: 400 });

    const reference = db.collection("services").doc(serviceId);
    const service = await reference.get();
    if (!service.exists) return NextResponse.json({ error: "الخدمة غير موجودة" }, { status: 404 });

    if (parsed.data.categoryId) {
      const category = await db.collection("categories").doc(parsed.data.categoryId).get();
      if (!category.exists) return NextResponse.json({ error: "التصنيف غير موجود" }, { status: 400 });
      if (!category.data()?.isActive) return NextResponse.json({ error: "لا يمكن نقل الخدمة إلى تصنيف غير نشط" }, { status: 400 });
    }

    if (parsed.data.slug && parsed.data.slug !== service.data()?.slug) {
      const duplicate = await db.collection("services").where("slug", "==", parsed.data.slug).limit(1).get();
      if (!duplicate.empty) return NextResponse.json({ error: "رابط الخدمة مستخدم بالفعل" }, { status: 409 });
    }

    const now = new Date().toISOString();
    const update = { ...parsed.data, updatedAt: now, updatedBy: admin.uid };
    if (parsed.data.badge === null) update.badge = "";
    await reference.update(update);
    await db.collection("auditLogs").add({ action: "service_updated", serviceId, fields: Object.keys(parsed.data), actorUid: admin.uid, at: now });

    return NextResponse.json({ service: { id: serviceId, ...service.data(), ...update } });
  } catch (error) {
    console.error("Failed to update service", error);
    return NextResponse.json({ error: "تعذر تعديل الخدمة" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const db = adminDb();
  if (!db) return NextResponse.json({ error: "إعداد Firebase الخادمي غير مكتمل" }, { status: 503 });

  try {
    const { id } = await context.params;
    const serviceId = id.trim();
    if (!serviceId) return NextResponse.json({ error: "معرف الخدمة غير صحيح" }, { status: 400 });

    const reference = db.collection("services").doc(serviceId);
    const [service, linkedOrders] = await Promise.all([
      reference.get(),
      db.collection("orders").where("serviceId", "==", serviceId).limit(1).get(),
    ]);
    if (!service.exists) return NextResponse.json({ error: "الخدمة غير موجودة" }, { status: 404 });
    if (!linkedOrders.empty) {
      return NextResponse.json({ error: "لا يمكن حذف خدمة مرتبطة بطلبات. عطّلها بدلًا من حذفها." }, { status: 409 });
    }

    const now = new Date().toISOString();
    await reference.delete();
    await db.collection("auditLogs").add({ action: "service_deleted", serviceId, actorUid: admin.uid, at: now });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete service", error);
    return NextResponse.json({ error: "تعذر حذف الخدمة" }, { status: 500 });
  }
}
