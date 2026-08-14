import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api/admin-auth";
import { cloudinaryUploadStatus, createCloudinaryUploadSignature } from "@/lib/cloudinary";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  return NextResponse.json(cloudinaryUploadStatus());
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const timestamp = Math.floor(Date.now() / 1000);
  const payload = createCloudinaryUploadSignature(timestamp);
  if (!payload) return NextResponse.json({ error: "تهيئة Cloudinary الخادمية غير مكتملة" }, { status: 503 });
  return NextResponse.json(payload, { status: 201 });
}
