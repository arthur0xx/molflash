import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireOwner } from "@/lib/api/admin-auth";
import { blogCategorySchema } from "@/lib/blog";

export async function GET(request: NextRequest) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  const db = adminDb();
  if (!db) return NextResponse.json({ error: "إعداد Firebase الخادمي غير مكتمل" }, { status: 503 });
  const categories = await db.collection("blogCategories").orderBy("order", "asc").get();
  return NextResponse.json({ categories: categories.docs.map((document) => ({ id: document.id, ...document.data() })) });
}

export async function POST(request: NextRequest) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  const db = adminDb();
  if (!db) return NextResponse.json({ error: "إعداد Firebase الخادمي غير مكتمل" }, { status: 503 });

  try {
    const parsed = blogCategorySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "بيانات التصنيف غير صحيحة" }, { status: 400 });
    const existing = await db.collection("blogCategories").where("slug", "==", parsed.data.slug).limit(1).get();
    if (!existing.empty) return NextResponse.json({ error: "رابط التصنيف مستخدم بالفعل" }, { status: 409 });
    const now = new Date().toISOString();
    const document = db.collection("blogCategories").doc();
    const category = { id: document.id, ...parsed.data, createdAt: now, updatedAt: now };
    await document.create(category);
    await db.collection("auditLogs").add({ action: "blog_category_created", blogCategoryId: document.id, actorUid: owner.uid, at: now });
    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    console.error("Failed to create blog category", error);
    return NextResponse.json({ error: "تعذر إضافة تصنيف المدونة" }, { status: 500 });
  }
}
