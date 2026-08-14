import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api/admin-auth";
import { adminDb } from "@/lib/firebase/admin";
import { cloudinaryUploadStatus, createCloudinaryUploadSignature, profileImagePublicId } from "@/lib/cloudinary";

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  return NextResponse.json(cloudinaryUploadStatus());
}

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const db = adminDb();
  if (!db) return NextResponse.json({ error: "إعداد Firebase الخادمي غير مكتمل" }, { status: 503 });
  const customer = await db.collection("customers").doc(user.uid).get();
  if (!customer.exists) return NextResponse.json({ error: "ملف العميل غير موجود" }, { status: 404 });

  const timestamp = Math.floor(Date.now() / 1000);
  const payload = createCloudinaryUploadSignature({
    kind: "profile",
    publicId: profileImagePublicId(String(customer.data()?.fullName || "customer"), user.uid),
  }, timestamp);
  if (!payload) return NextResponse.json({ error: "تهيئة Cloudinary الخادمية غير مكتملة" }, { status: 503 });
  return NextResponse.json(payload, { status: 201 });
}
