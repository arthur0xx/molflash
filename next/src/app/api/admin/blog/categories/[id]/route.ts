import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireOwner } from "@/lib/api/admin-auth";
import { blogCategoryPatchSchema } from "@/lib/blog";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  const db = adminDb();
  if (!db) return NextResponse.json({ error: "إعداد Firebase الخادمي غير مكتمل" }, { status: 503 });
  const { id } = await params;

  try {
    const parsed = blogCategoryPatchSchema.safeParse(await request.json());
    if (!parsed.success || Object.keys(parsed.data).length === 0) return NextResponse.json({ error: parsed.error?.issues[0]?.message || "بيانات التصنيف غير صحيحة" }, { status: 400 });
    const document = db.collection("blogCategories").doc(id);
    const existing = await document.get();
    if (!existing.exists) return NextResponse.json({ error: "التصنيف غير موجود" }, { status: 404 });
    if (parsed.data.slug && parsed.data.slug !== existing.data()?.slug) {
      const duplicate = await db.collection("blogCategories").where("slug", "==", parsed.data.slug).limit(1).get();
      if (!duplicate.empty) return NextResponse.json({ error: "رابط التصنيف مستخدم بالفعل" }, { status: 409 });
    }
    const now = new Date().toISOString();
    await document.update({ ...parsed.data, updatedAt: now });
    await db.collection("auditLogs").add({ action: "blog_category_updated", blogCategoryId: id, actorUid: owner.uid, at: now });
    const category = await document.get();
    return NextResponse.json({ category: { id: category.id, ...category.data() } });
  } catch (error) {
    console.error("Failed to update blog category", error);
    return NextResponse.json({ error: "تعذر تحديث تصنيف المدونة" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  const db = adminDb();
  if (!db) return NextResponse.json({ error: "إعداد Firebase الخادمي غير مكتمل" }, { status: 503 });
  const { id } = await params;
  const [category, posts] = await Promise.all([
    db.collection("blogCategories").doc(id).get(),
    db.collection("blogPosts").where("categoryId", "==", id).limit(1).get(),
  ]);
  if (!category.exists) return NextResponse.json({ error: "التصنيف غير موجود" }, { status: 404 });
  if (!posts.empty) return NextResponse.json({ error: "لا يمكن حذف تصنيف مرتبط بمقالات؛ انقل المقالات أو أرشفها أولًا." }, { status: 409 });
  const now = new Date().toISOString();
  await db.collection("blogCategories").doc(id).delete();
  await db.collection("auditLogs").add({ action: "blog_category_deleted", blogCategoryId: id, actorUid: owner.uid, at: now });
  return NextResponse.json({ ok: true });
}
