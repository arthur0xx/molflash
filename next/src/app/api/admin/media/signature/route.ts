import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/api/admin-auth";
import { adminDb } from "@/lib/firebase/admin";
import { cloudinaryUploadStatus, createCloudinaryUploadSignature, serviceImagePublicId } from "@/lib/cloudinary";

const requestSchema = z.object({
  serviceId: z.string().trim().min(1).max(128).optional(),
  title: z.string().trim().min(2).max(160),
});

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  return NextResponse.json(cloudinaryUploadStatus());
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "اسم الخدمة مطلوب قبل رفع الصورة." }, { status: 400 });

  let stableId = `draft-${parsed.data.title}`;
  let title = parsed.data.title;
  let categoryId = "drafts";
  if (parsed.data.serviceId) {
    const db = adminDb();
    if (!db) return NextResponse.json({ error: "إعداد Firebase الخادمي غير مكتمل" }, { status: 503 });
    const service = await db.collection("services").doc(parsed.data.serviceId).get();
    if (!service.exists) return NextResponse.json({ error: "الخدمة غير موجودة" }, { status: 404 });
    stableId = service.id;
    title = String(service.data()?.title || title);
    categoryId = String(service.data()?.categoryId || categoryId);
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const payload = createCloudinaryUploadSignature({ kind: "service", publicId: serviceImagePublicId(title, stableId, categoryId) }, timestamp);
  if (!payload) return NextResponse.json({ error: "تهيئة Cloudinary الخادمية غير مكتملة" }, { status: 503 });
  return NextResponse.json(payload, { status: 201 });
}
