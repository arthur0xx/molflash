import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireOwner } from "@/lib/api/admin-auth";
import { blogPostSchema } from "@/lib/blog";
import { getBlogAdminSnapshot } from "@/lib/repository";

async function validatePostReferences(db: NonNullable<ReturnType<typeof adminDb>>, input: { categoryId: string; serviceIds: string[]; status: "draft" | "published" | "archived" }) {
  const category = await db.collection("blogCategories").doc(input.categoryId).get();
  if (!category.exists) return "تصنيف المدونة غير موجود";
  if (input.status === "published" && category.data()?.isActive !== true) return "لا يمكن نشر مقال ضمن تصنيف غير نشط";
  if (!input.serviceIds.length) return null;
  const serviceDocuments = await db.getAll(...input.serviceIds.map((id) => db.collection("services").doc(id)));
  if (serviceDocuments.some((document) => !document.exists)) return "إحدى الخدمات المرتبطة لم تعد موجودة";
  if (input.status === "published" && serviceDocuments.some((document) => document.data()?.isActive !== true)) return "لا يمكن نشر مقال مرتبط بخدمة غير نشطة";
  return null;
}

export async function GET(request: NextRequest) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  return NextResponse.json({ snapshot: await getBlogAdminSnapshot() });
}

export async function POST(request: NextRequest) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  const db = adminDb();
  if (!db) return NextResponse.json({ error: "إعداد Firebase الخادمي غير مكتمل" }, { status: 503 });

  try {
    const parsed = blogPostSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "بيانات المقال غير صحيحة" }, { status: 400 });
    const [slugExists, referenceError] = await Promise.all([
      db.collection("blogPosts").where("slug", "==", parsed.data.slug).limit(1).get(),
      validatePostReferences(db, parsed.data),
    ]);
    if (!slugExists.empty) return NextResponse.json({ error: "رابط المقال مستخدم بالفعل" }, { status: 409 });
    if (referenceError) return NextResponse.json({ error: referenceError }, { status: 400 });

    const now = new Date().toISOString();
    const document = db.collection("blogPosts").doc();
    const post = {
      id: document.id,
      ...parsed.data,
      publishedAt: parsed.data.status === "published" ? now : undefined,
      createdAt: now,
      updatedAt: now,
      createdBy: owner.uid,
      updatedBy: owner.uid,
    };
    await document.create(post);
    await db.collection("auditLogs").add({ action: "blog_post_created", blogPostId: document.id, status: post.status, actorUid: owner.uid, at: now });
    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    console.error("Failed to create blog post", error);
    return NextResponse.json({ error: "تعذر إنشاء المقال" }, { status: 500 });
  }
}
