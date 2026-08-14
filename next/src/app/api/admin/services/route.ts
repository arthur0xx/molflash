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

const serviceSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, "رابط الخدمة غير صحيح").min(2).max(100),
  title: z.string().trim().min(2, "اسم الخدمة قصير جدًا").max(160, "اسم الخدمة طويل جدًا"),
  categoryId: z.string().trim().min(1, "اختر تصنيفًا صالحًا").max(128),
  description: z.string().trim().min(4, "وصف الخدمة قصير جدًا").max(2000, "وصف الخدمة طويل جدًا"),
  priceMad: z.number().finite().min(0, "السعر لا يمكن أن يكون سالبًا").max(1000000, "السعر أكبر من الحد المسموح"),
  delivery: z.string().trim().min(2, "مدة أو نوع التسليم مطلوب").max(200, "معلومة التسليم طويلة جدًا"),
  badge: z.string().trim().max(80, "الشارة طويلة جدًا").optional(),
  isActive: z.boolean().default(false),
  fields: z.array(dynamicFieldSchema).max(20, "عدد الحقول كبير جدًا").default([]),
}).superRefine((service, context) => {
  const ids = service.fields.map((field) => field.id);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", message: "معرفات الحقول يجب أن تكون فريدة" });
  }
});

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const db = adminDb();
  if (!db) return NextResponse.json({ error: "إعداد Firebase الخادمي غير مكتمل" }, { status: 503 });

  try {
    const parsed = serviceSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "بيانات الخدمة غير صحيحة" }, { status: 400 });
    }

    const [category, existingSlug] = await Promise.all([
      db.collection("categories").doc(parsed.data.categoryId).get(),
      db.collection("services").where("slug", "==", parsed.data.slug).limit(1).get(),
    ]);
    if (!category.exists) return NextResponse.json({ error: "التصنيف غير موجود" }, { status: 400 });
    if (!category.data()?.isActive) return NextResponse.json({ error: "لا يمكن إضافة خدمة إلى تصنيف غير نشط" }, { status: 400 });
    if (!existingSlug.empty) return NextResponse.json({ error: "رابط الخدمة مستخدم بالفعل" }, { status: 409 });

    const now = new Date().toISOString();
    const document = db.collection("services").doc();
    const service = { id: document.id, ...parsed.data, createdAt: now, updatedAt: now, createdBy: admin.uid };
    await document.create(service);
    await db.collection("auditLogs").add({ action: "service_created", serviceId: document.id, categoryId: service.categoryId, actorUid: admin.uid, at: now });

    return NextResponse.json({ service }, { status: 201 });
  } catch (error) {
    console.error("Failed to create service", error);
    return NextResponse.json({ error: "تعذر إضافة الخدمة" }, { status: 500 });
  }
}
