import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/api/admin-auth";
import { adminDb } from "@/lib/firebase/admin";
import { blogImagePublicId, cloudinaryUploadStatus, createCloudinaryUploadSignature } from "@/lib/cloudinary";

const requestSchema = z.object({ postId: z.string().trim().min(1).max(128).optional(), title: z.string().trim().min(2).max(180) });

export async function GET(request: NextRequest) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  return NextResponse.json(cloudinaryUploadStatus());
}

export async function POST(request: NextRequest) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  const db = adminDb();
  if (!db) return NextResponse.json({ error: "إعداد Firebase الخادمي غير مكتمل" }, { status: 503 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "بيانات الصورة غير صحيحة" }, { status: 400 });
  const stableId = parsed.data.postId || `draft-${owner.uid.slice(0, 12)}`;
  if (parsed.data.postId) {
    const post = await db.collection("blogPosts").doc(parsed.data.postId).get();
    if (!post.exists) return NextResponse.json({ error: "المقال غير موجود" }, { status: 404 });
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const upload = createCloudinaryUploadSignature({ kind: "blog", publicId: blogImagePublicId(parsed.data.title, stableId) }, timestamp);
  if (!upload) return NextResponse.json({ error: "إعداد رفع الصور غير مكتمل" }, { status: 503 });
  return NextResponse.json(upload);
}
