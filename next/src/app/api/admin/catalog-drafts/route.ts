import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/api/admin-auth";

const dynamicFieldSchema = z.object({
  id: z.string().trim().regex(/^[a-z0-9-]{2,50}$/i, "معرف الحقل غير صحيح"),
  label: z.string().trim().min(2).max(120),
  type: z.enum(["text", "email", "select", "textarea"]),
  required: z.boolean(),
  placeholder: z.string().trim().max(160).optional(),
  options: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
});

const privateSupplierSchema = z.object({
  supplierServiceId: z.string().trim().regex(/^\d{1,20}$/, "مرجع خدمة المورد غير صحيح"),
  supplierNameSnapshot: z.string().trim().min(2).max(240),
  supplierCostSnapshot: z.number().finite().min(0).max(1000000),
  sourceCurrency: z.enum(["USD", "EUR", "MAD"]),
  sourceSyncedAt: z.string().datetime(),
  fxRateSnapshot: z.number().finite().positive().max(100000),
  fxBufferPercent: z.number().finite().min(0).max(100),
  markupPercent: z.number().finite().min(0).max(500),
  minimumGrossProfitMad: z.number().finite().min(0).max(1000000),
  otherCostMad: z.number().finite().min(0).max(1000000).default(0),
});

const draftSchema = z.object({
  id: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i).min(3).max(100),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i).min(3).max(100),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(4).max(2000),
  priceMad: z.number().finite().positive().max(1000000),
  delivery: z.string().trim().min(2).max(200),
  badge: z.string().trim().min(2).max(80),
  catalogFamily: z.enum(["unlock", "timed-access", "rental", "tool", "processing"]),
  visualPreset: z.string().trim().regex(/^[a-z0-9-]{3,80}$/).max(80),
  termValue: z.number().int().positive().max(120),
  termUnit: z.enum(["days", "months", "years"]),
  fields: z.array(dynamicFieldSchema).max(20),
  supplier: privateSupplierSchema,
}).superRefine((draft, context) => {
  const ids = draft.fields.map((field) => field.id);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: "custom", message: "معرفات حقول الخدمة يجب أن تكون فريدة" });
  if (draft.priceMad <= draft.supplier.supplierCostSnapshot * draft.supplier.fxRateSnapshot) {
    context.addIssue({ code: "custom", message: "سعر البيع يجب أن يكون أعلى من كلفة المورد المحولة" });
  }
});

const payloadSchema = z.object({
  category: z.object({
    id: z.string().trim().regex(/^[a-z0-9-]{3,100}$/),
    name: z.string().trim().min(2).max(80),
    icon: z.string().trim().min(1).max(80),
    color: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/),
    description: z.string().trim().max(500),
    order: z.number().int().min(0).max(10000),
  }),
  drafts: z.array(draftSchema).min(1).max(25),
}).superRefine((payload, context) => {
  const ids = payload.drafts.map((draft) => draft.id);
  const slugs = payload.drafts.map((draft) => draft.slug);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: "custom", message: "معرفات المسودات يجب أن تكون فريدة" });
  if (new Set(slugs).size !== slugs.length) context.addIssue({ code: "custom", message: "روابط المسودات يجب أن تكون فريدة" });
});

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const db = adminDb();
  if (!db) return NextResponse.json({ error: "إعداد Firebase الخادمي غير مكتمل" }, { status: 503 });

  try {
    const parsed = payloadSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "بيانات مسودات الكتالوج غير صحيحة" }, { status: 400 });

    const { category, drafts } = parsed.data;
    const documentRefs = drafts.map((draft) => db.collection("services").doc(draft.id));
    const [existingCategory, ...existingServices] = await db.getAll(db.collection("categories").doc(category.id), ...documentRefs);
    if (existingCategory.exists || existingServices.some((document) => document.exists)) {
      return NextResponse.json({ error: "توجد فئة أو مسودة بهذا المعرف بالفعل؛ لا يمكن تكرار الاستيراد." }, { status: 409 });
    }

    const slugChecks = await Promise.all(drafts.map((draft) => db.collection("services").where("slug", "==", draft.slug).limit(1).get()));
    if (slugChecks.some((snapshot) => !snapshot.empty)) return NextResponse.json({ error: "أحد روابط الخدمات مستخدم بالفعل" }, { status: 409 });

    const now = new Date().toISOString();
    const batch = db.batch();
    const categoryRef = db.collection("categories").doc(category.id);
    batch.create(categoryRef, { ...category, isActive: false, createdAt: now, updatedAt: now, createdBy: admin.uid });

    for (const draft of drafts) {
      const { supplier, id, ...publicDraft } = draft;
      const serviceRef = db.collection("services").doc(id);
      const privateRef = db.collection("servicePrivate").doc(id);
      batch.create(serviceRef, {
        id,
        ...publicDraft,
        categoryId: category.id,
        imageUrl: "",
        imagePublicId: "",
        isActive: false,
        publicationStatus: "draft",
        createdAt: now,
        updatedAt: now,
        createdBy: admin.uid,
      });
      batch.create(privateRef, {
        serviceId: id,
        ...supplier,
        salePriceSnapshot: draft.priceMad,
        grossProfitSnapshot: Number((draft.priceMad - supplier.supplierCostSnapshot * supplier.fxRateSnapshot).toFixed(2)),
        createdAt: now,
        updatedAt: now,
        createdBy: admin.uid,
      });
    }

    const auditRef = db.collection("auditLogs").doc();
    batch.create(auditRef, {
      action: "catalog_drafts_imported",
      categoryId: category.id,
      serviceIds: drafts.map((draft) => draft.id),
      serviceCount: drafts.length,
      actorUid: admin.uid,
      at: now,
    });
    await batch.commit();

    return NextResponse.json({
      category: { ...category, isActive: false },
      services: drafts.map((draft) => ({
        id: draft.id,
        slug: draft.slug,
        title: draft.title,
        priceMad: draft.priceMad,
        publicationStatus: "draft",
      })),
    }, { status: 201 });
  } catch (error) {
    console.error("Failed to import catalog drafts", error);
    return NextResponse.json({ error: "تعذر إنشاء مسودات الكتالوج" }, { status: 500 });
  }
}
