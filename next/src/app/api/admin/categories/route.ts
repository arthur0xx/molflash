import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/api/admin-auth";

const categorySchema = z.object({
  name: z.string().trim().min(2, "اسم التصنيف قصير جدًا").max(80, "اسم التصنيف طويل جدًا"),
  icon: z.string().trim().min(1, "الأيقونة مطلوبة").max(160, "قيمة الأيقونة طويلة جدًا"),
  color: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, "لون التصنيف غير صحيح"),
  description: z.string().trim().max(500, "وصف التصنيف طويل جدًا").default(""),
  order: z.number().int().min(0).max(10000).optional(),
  isActive: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const db = adminDb();
  if (!db) return NextResponse.json({ error: "إعداد Firebase الخادمي غير مكتمل" }, { status: 503 });

  try {
    const snapshot = await db.collection("categories").get();
    const categories = snapshot.docs
      .map((document) => ({ id: document.id, ...(document.data() as { order?: number; [key: string]: unknown }) }))
      .sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Failed to list categories", error);
    return NextResponse.json({ error: "تعذر تحميل التصنيفات" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const db = adminDb();
  if (!db) return NextResponse.json({ error: "إعداد Firebase الخادمي غير مكتمل" }, { status: 503 });

  try {
    const parsed = categorySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "بيانات التصنيف غير صحيحة" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const document = db.collection("categories").doc();
    const category = {
      id: document.id,
      ...parsed.data,
      order: parsed.data.order ?? Date.now(),
      createdAt: now,
      updatedAt: now,
      createdBy: admin.uid,
    };

    await document.create(category);
    await db.collection("auditLogs").add({
      action: "category_created",
      categoryId: document.id,
      actorUid: admin.uid,
      at: now,
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    console.error("Failed to create category", error);
    return NextResponse.json({ error: "تعذر إضافة التصنيف" }, { status: 500 });
  }
}
