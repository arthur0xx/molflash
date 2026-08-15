import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/api/admin-auth";

const fieldSchema = z.object({ id: z.string().regex(/^[a-z0-9-]{2,50}$/i), label: z.string().min(2).max(120), type: z.enum(["text", "email", "select", "textarea"]), required: z.boolean(), placeholder: z.string().max(160).optional(), options: z.array(z.string().min(1).max(120)).max(50).optional() });
const supplierSchema = z.object({ supplierServiceId: z.string().regex(/^\d{1,20}$/), supplierNameSnapshot: z.string().min(2).max(240), supplierCostSnapshot: z.number().finite().min(0), sourceCurrency: z.enum(["USD", "EUR", "MAD"]), sourceSyncedAt: z.string().datetime(), fxRateSnapshot: z.number().positive(), fxBufferPercent: z.number().min(0).max(100), markupPercent: z.number().min(0).max(500), minimumGrossProfitMad: z.number().min(0), otherCostMad: z.number().min(0).default(0) });
const draftSchema = z.object({ id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i).min(3).max(100), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i).min(3).max(100), title: z.string().min(2).max(160), description: z.string().min(4).max(2000), priceMad: z.number().positive().max(1000000), delivery: z.string().min(2).max(200), badge: z.string().min(2).max(80), catalogFamily: z.enum(["unlock", "timed-access", "rental", "tool", "processing"]), visualPreset: z.string().regex(/^[a-z0-9-]{3,80}$/), termValue: z.number().int().positive(), termUnit: z.enum(["days", "months", "years"]), fields: z.array(fieldSchema).max(20), supplier: supplierSchema });
const bodySchema = z.object({ categoryId: z.string().min(1).max(128), drafts: z.array(draftSchema).min(1).max(25) });

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  const db = adminDb();
  if (!db) return NextResponse.json({ error: "إعداد Firebase الخادمي غير مكتمل" }, { status: 503 });
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "بيانات المسودات غير صحيحة" }, { status: 400 });
    const { categoryId, drafts } = parsed.data;
    const category = await db.collection("categories").doc(categoryId).get();
    if (!category.exists) return NextResponse.json({ error: "التصنيف غير موجود" }, { status: 404 });
    const refs = drafts.map((draft) => db.collection("services").doc(draft.id));
    const existing = await db.getAll(...refs);
    if (existing.some((doc) => doc.exists)) return NextResponse.json({ error: "إحدى الخدمات موجودة بالفعل" }, { status: 409 });
    const slugChecks = await Promise.all(drafts.map((draft) => db.collection("services").where("slug", "==", draft.slug).limit(1).get()));
    if (slugChecks.some((snapshot) => !snapshot.empty)) return NextResponse.json({ error: "أحد روابط الخدمات مستخدم بالفعل" }, { status: 409 });
    const now = new Date().toISOString();
    const batch = db.batch();
    for (const draft of drafts) {
      const { supplier, id, ...publicDraft } = draft;
      const serviceRef = db.collection("services").doc(id);
      const privateRef = db.collection("servicePrivate").doc(id);
      batch.create(serviceRef, { id, ...publicDraft, categoryId, imageUrl: "", imagePublicId: "", isActive: false, publicationStatus: "draft", createdAt: now, updatedAt: now, createdBy: admin.uid });
      batch.create(privateRef, { serviceId: id, ...supplier, salePriceSnapshot: draft.priceMad, grossProfitSnapshot: Number((draft.priceMad - supplier.supplierCostSnapshot * supplier.fxRateSnapshot).toFixed(2)), createdAt: now, updatedAt: now, createdBy: admin.uid });
    }
    const auditRef = db.collection("auditLogs").doc();
    batch.create(auditRef, { action: "catalog_drafts_appended", categoryId, serviceIds: drafts.map((draft) => draft.id), serviceCount: drafts.length, actorUid: admin.uid, at: now });
    await batch.commit();
    return NextResponse.json({ ok: true, serviceIds: drafts.map((draft) => draft.id) }, { status: 201 });
  } catch (error) {
    console.error("Failed to append catalog drafts", error);
    return NextResponse.json({ error: "تعذر إلحاق مسودات الكتالوج" }, { status: 500 });
  }
}
