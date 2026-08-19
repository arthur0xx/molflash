import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { requireOwner } from "@/lib/api/admin-auth";
import { blogPostPatchSchema, blogPostSchema } from "@/lib/blog";
import type { BlogPost } from "@/lib/types";

type Context = { params: Promise<{ id: string }> };

async function validatePostReferences(db: NonNullable<ReturnType<typeof adminDb>>, input: { categoryId: string; serviceIds: string[]; status: "draft" | "published" | "archived" }) {
  const category = await db.collection("blogCategories").doc(input.categoryId).get();
  if (!category.exists) return "تصنيف المدونة غير موجود";
  if (input.status === "published" && category.data()?.isActive !== true) return "لا يمكن نشر مقال ضمن تصنيف غير نشط";
  if (!input.serviceIds.length) return null;
  const serviceDocuments = await db.getAll(...input.serviceIds.map((serviceId) => db.collection("services").doc(serviceId)));
  if (serviceDocuments.some((document) => !document.exists)) return "إحدى الخدمات المرتبطة لم تعد موجودة";
  if (input.status === "published" && serviceDocuments.some((document) => document.data()?.isActive !== true)) return "لا يمكن نشر مقال مرتبط بخدمة غير نشطة";
  return null;
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  const db = adminDb();
  if (!db) return NextResponse.json({ error: "إعداد Firebase الخادمي غير مكتمل" }, { status: 503 });
  const { id } = await params;

  try {
    const parsed = blogPostPatchSchema.safeParse(await request.json());
    if (!parsed.success || Object.keys(parsed.data).length === 0) return NextResponse.json({ error: parsed.error?.issues[0]?.message || "بيانات المقال غير صحيحة" }, { status: 400 });
    const document = db.collection("blogPosts").doc(id);
    const existing = await document.get();
    if (!existing.exists) return NextResponse.json({ error: "المقال غير موجود" }, { status: 404 });
    const current = { id: existing.id, ...existing.data() } as BlogPost;
    const { clearCoverImage, ...patch } = parsed.data;
    const candidate = { ...current, ...patch, ...(clearCoverImage ? { coverImageUrl: undefined, coverImagePublicId: undefined, coverImageAlt: undefined } : {}) } as BlogPost;
    const fullPost = blogPostSchema.safeParse(candidate);
    if (!fullPost.success) return NextResponse.json({ error: fullPost.error.issues[0]?.message || "بيانات المقال غير صحيحة" }, { status: 400 });
    const next = fullPost.data;
    if (patch.slug && patch.slug !== current.slug) {
      const duplicate = await db.collection("blogPosts").where("slug", "==", patch.slug).limit(1).get();
      if (!duplicate.empty) return NextResponse.json({ error: "رابط المقال مستخدم بالفعل" }, { status: 409 });
    }
    const referenceError = await validatePostReferences(db, next);
    if (referenceError) return NextResponse.json({ error: referenceError }, { status: 400 });
    const now = new Date().toISOString();
    const publicationChanged = patch.status === "published" && current.status !== "published";
    await document.update({ ...patch, ...(clearCoverImage ? { coverImageUrl: FieldValue.delete(), coverImagePublicId: FieldValue.delete(), coverImageAlt: FieldValue.delete() } : {}), updatedAt: now, updatedBy: owner.uid, ...(publicationChanged ? { publishedAt: now } : {}) });
    await db.collection("auditLogs").add({ action: "blog_post_updated", blogPostId: id, status: next.status, actorUid: owner.uid, at: now });
    const updated = await document.get();
    return NextResponse.json({ post: { id: updated.id, ...updated.data() } });
  } catch (error) {
    console.error("Failed to update blog post", error);
    return NextResponse.json({ error: "تعذر تحديث المقال" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  const db = adminDb();
  if (!db) return NextResponse.json({ error: "إعداد Firebase الخادمي غير مكتمل" }, { status: 503 });
  const { id } = await params;
  const document = db.collection("blogPosts").doc(id);
  const existing = await document.get();
  if (!existing.exists) return NextResponse.json({ error: "المقال غير موجود" }, { status: 404 });
  if (existing.data()?.status === "published") return NextResponse.json({ error: "أرشف المقال المنشور بدل حذفه للحفاظ على الروابط والبيانات." }, { status: 409 });
  const now = new Date().toISOString();
  await document.delete();
  await db.collection("auditLogs").add({ action: "blog_post_deleted", blogPostId: id, actorUid: owner.uid, at: now });
  return NextResponse.json({ ok: true });
}
