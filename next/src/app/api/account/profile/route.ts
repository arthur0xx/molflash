import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireVerifiedUser } from "@/lib/api/admin-auth";
import { deleteCloudinaryImage } from "@/lib/cloudinary";
import type { CustomerProfile } from "@/lib/types";

const profileSchema = z.object({
  fullName: z.string().trim().min(2, "الاسم الكامل قصير جدًا").max(90, "الاسم الكامل طويل جدًا"),
  phone: z.string().trim().min(7, "رقم الهاتف قصير جدًا").max(24, "رقم الهاتف طويل جدًا").regex(/^[+0-9][0-9\s()-]*$/, "رقم الهاتف غير صحيح"),
});
const avatarUrlSchema = z.string().trim().url("رابط الصورة غير صحيح").refine((value) => {
  try { return new URL(value).protocol === "https:" && new URL(value).hostname === "res.cloudinary.com"; } catch { return false; }
}, "صورة الملف يجب أن تأتي من Cloudinary المهيأ").max(2000, "رابط الصورة طويل جدًا");
const avatarPublicIdSchema = z.string().trim().regex(/^chrigsm\/profiles\/[a-z0-9_-]{3,180}$/i, "معرف صورة الملف غير صحيح").max(220);
const notificationPreferencesSchema = z.object({
  email: z.boolean(),
  whatsapp: z.boolean(),
});
const avatarSchema = z.object({
  avatarUrl: avatarUrlSchema.nullable(),
  avatarPublicId: avatarPublicIdSchema.nullable(),
}).superRefine((value, context) => {
  if (Boolean(value.avatarUrl) !== Boolean(value.avatarPublicId)) context.addIssue({ code: "custom", message: "صورة الملف تحتاج رابطًا ومعرفًا صالحين من Cloudinary" });
});

function serializeProfile(raw: Record<string, unknown>, fallbackEmail: string | undefined): CustomerProfile {
  return {
    fullName: String(raw.fullName || "عميل ChriGsm"),
    phone: String(raw.phone || ""),
    email: String(raw.email || fallbackEmail || ""),
    avatarUrl: typeof raw.avatarUrl === "string" && raw.avatarUrl.startsWith("https://") ? raw.avatarUrl : undefined,
    avatarPublicId: typeof raw.avatarPublicId === "string" && raw.avatarPublicId.startsWith("chrigsm/profiles/") ? raw.avatarPublicId : undefined,
    phoneVerifiedAt: typeof raw.phoneVerifiedAt === "string" ? raw.phoneVerifiedAt : undefined,
    notificationPreferences: raw.notificationPreferences && typeof raw.notificationPreferences === "object" ? {
      email: (raw.notificationPreferences as Record<string, unknown>).email !== false,
      whatsapp: (raw.notificationPreferences as Record<string, unknown>).whatsapp === true,
    } : { email: true, whatsapp: raw.whatsappEnabled === true },
  };
}

function hasOwn(body: Record<string, unknown>, field: string) {
  return Object.prototype.hasOwnProperty.call(body, field);
}

function cleanupAvatarAsset(publicId: string) {
  void deleteCloudinaryImage(publicId, "profile").catch((error) => console.error("Failed to delete replaced profile image", error));
}

export async function PATCH(request: NextRequest) {
  const user = await requireVerifiedUser(request);
  if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const db = adminDb();
  if (!db) return NextResponse.json({ error: "خدمة الحساب غير متاحة حاليًا" }, { status: 503 });

  try {
    const body = await request.json() as Record<string, unknown>;
    const wantsProfile = hasOwn(body, "fullName") || hasOwn(body, "phone");
    const wantsAvatar = hasOwn(body, "avatarUrl") || hasOwn(body, "avatarPublicId");
    const wantsNotifications = hasOwn(body, "notificationPreferences");
    if (!wantsProfile && !wantsAvatar && !wantsNotifications) return NextResponse.json({ error: "لا توجد بيانات للحفظ" }, { status: 400 });

    const parsedProfile = wantsProfile ? profileSchema.safeParse(body) : null;
    if (parsedProfile && !parsedProfile.success) return NextResponse.json({ error: parsedProfile.error.issues[0]?.message || "بيانات الحساب غير صحيحة" }, { status: 400 });
    const parsedAvatar = wantsAvatar ? avatarSchema.safeParse(body) : null;
    if (parsedAvatar && !parsedAvatar.success) return NextResponse.json({ error: parsedAvatar.error.issues[0]?.message || "بيانات صورة الحساب غير صحيحة" }, { status: 400 });
    const parsedNotifications = wantsNotifications ? notificationPreferencesSchema.safeParse(body.notificationPreferences) : null;
    if (parsedNotifications && !parsedNotifications.success) return NextResponse.json({ error: "تفضيلات الإشعار غير صحيحة" }, { status: 400 });

    const customerReference = db.collection("customers").doc(user.uid);
    const result = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(customerReference);
      if (!snapshot.exists) throw new Error("CUSTOMER_NOT_FOUND");

      const current = snapshot.data() as Record<string, unknown>;
      const profile = serializeProfile(current, user.email);
      const update: Record<string, unknown> = {};
      const changedFields: string[] = [];

      if (parsedProfile?.success) {
        if (profile.fullName !== parsedProfile.data.fullName) { update.fullName = parsedProfile.data.fullName; changedFields.push("fullName"); }
        if (profile.phone !== parsedProfile.data.phone) { update.phone = parsedProfile.data.phone; changedFields.push("phone"); }
      }
      if (parsedNotifications?.success) {
        const verified = typeof current.phoneVerifiedAt === "string" && current.phoneVerifiedAt.length > 0;
        if (parsedNotifications.data.whatsapp && !verified) throw new Error("WHATSAPP_PHONE_UNVERIFIED");
        update.notificationPreferences = parsedNotifications.data;
        update.whatsappEnabled = parsedNotifications.data.whatsapp;
        changedFields.push("notificationPreferences");
      }
      if (parsedAvatar?.success) {
        const nextUrl = parsedAvatar.data.avatarUrl || "";
        const nextPublicId = parsedAvatar.data.avatarPublicId || "";
        if ((profile.avatarUrl || "") !== nextUrl) { update.avatarUrl = nextUrl; changedFields.push("avatarUrl"); }
        if ((profile.avatarPublicId || "") !== nextPublicId) { update.avatarPublicId = nextPublicId; changedFields.push("avatarPublicId"); }
      }
      if (changedFields.length === 0) return { profile, changed: false, previousAvatarPublicId: "" };

      const now = new Date().toISOString();
      transaction.update(customerReference, { ...update, updatedAt: now });
      transaction.create(db.collection("auditLogs").doc(), {
        action: wantsAvatar && !wantsProfile ? "customer_avatar_updated" : "customer_profile_updated",
        customerId: user.uid,
        actorUid: user.uid,
        changedFields,
        at: now,
      });
      return {
        profile: { ...profile, ...update },
        changed: true,
        previousAvatarPublicId: profile.avatarPublicId || "",
      };
    });

    const nextAvatarPublicId = result.profile.avatarPublicId || "";
    if (result.previousAvatarPublicId && result.previousAvatarPublicId !== nextAvatarPublicId) cleanupAvatarAsset(result.previousAvatarPublicId);
    return NextResponse.json({ profile: result.profile, changed: result.changed });
  } catch (error) {
    if (error instanceof Error && error.message === "CUSTOMER_NOT_FOUND") return NextResponse.json({ error: "ملف العميل غير موجود" }, { status: 404 });
    if (error instanceof Error && error.message === "WHATSAPP_PHONE_UNVERIFIED") return NextResponse.json({ error: "أكّد رقم واتساب أولًا قبل تفعيل إشعاراته." }, { status: 400 });
    console.error("Failed to update customer profile", error);
    return NextResponse.json({ error: "تعذر حفظ إعدادات الحساب" }, { status: 500 });
  }
}
