import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { requireOwner } from "@/lib/api/admin-auth";
import type { Customer } from "@/lib/types";

const createManagerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  phone: z.string().trim().max(30).default(""),
  temporaryPassword: z.string().min(8).max(128),
  orders: z.boolean().default(true),
  support: z.boolean().default(false),
  catalog: z.boolean().default(false),
}).refine((value) => Number(value.orders) + Number(value.support) + Number(value.catalog) === 1, "اختر صلاحية فريق واحدة فقط لكل مشرف.");
const updateManagerSchema = z.object({ uid: z.string().trim().min(1), disabled: z.boolean() });

function serializeManager(uid: string, raw: Record<string, unknown>): Customer {
  return {
    id: uid,
    fullName: String(raw.fullName || "مشرف ChriGsm"),
    phone: String(raw.phone || ""),
    email: String(raw.email || ""),
    walletMad: typeof raw.walletMad === "number" ? raw.walletMad : 0,
    ordersCount: typeof raw.ordersCount === "number" ? raw.ordersCount : 0,
    lastActivity: String(raw.lastActivity || ""),
    whatsappEnabled: raw.whatsappEnabled === true,
    role: "manager",
    managerPermissions: raw.managerPermissions && typeof raw.managerPermissions === "object" ? raw.managerPermissions as Customer["managerPermissions"] : { orders: true, support: false, catalog: false },
    accountStatus: raw.accountStatus === "blocked" ? "blocked" : "active",
  };
}

export async function GET(request: NextRequest) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  const db = adminDb();
  if (!db) return NextResponse.json({ error: "إعداد Firebase الخادمي غير مكتمل" }, { status: 503 });
  const snapshot = await db.collection("customers").where("role", "==", "manager").get();
  return NextResponse.json({ managers: snapshot.docs.map((doc) => serializeManager(doc.id, doc.data())) });
}

export async function POST(request: NextRequest) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  const auth = adminAuth();
  const db = adminDb();
  if (!auth || !db) return NextResponse.json({ error: "إعداد Firebase الخادمي غير مكتمل" }, { status: 503 });
  const parsed = createManagerSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "بيانات المشرف غير صحيحة" }, { status: 400 });
  try {
    const { fullName, email, phone, temporaryPassword, orders, support, catalog } = parsed.data;
    const managerPermissions = { orders, support, catalog };
    const user = await auth.createUser({ email, password: temporaryPassword, displayName: fullName, disabled: false, emailVerified: false });
    await auth.setCustomUserClaims(user.uid, { role: "manager", managerPermissions });
    const now = new Date().toISOString();
    const manager = { fullName, phone, email, walletMad: 0, ordersCount: 0, lastActivity: now, whatsappEnabled: Boolean(phone), role: "manager", managerPermissions, accountStatus: "active", createdAt: now, createdBy: owner.uid };
    await db.collection("customers").doc(user.uid).set(manager);
    await db.collection("auditLogs").add({ action: "manager_created", managerUid: user.uid, actorUid: owner.uid, at: now, permissions: managerPermissions });
    return NextResponse.json({ manager: serializeManager(user.uid, manager), temporaryPasswordProvided: true }, { status: 201 });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code.includes("email-already-exists")) return NextResponse.json({ error: "هذا البريد مستخدم بالفعل" }, { status: 409 });
    console.error("Failed to create manager", error);
    return NextResponse.json({ error: "تعذر إنشاء المشرف" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  const auth = adminAuth();
  const db = adminDb();
  if (!auth || !db) return NextResponse.json({ error: "إعداد Firebase الخادمي غير مكتمل" }, { status: 503 });
  const parsed = updateManagerSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "بيانات المشرف غير صحيحة" }, { status: 400 });
  const { uid, disabled } = parsed.data;
  try {
    const user = await auth.getUser(uid);
    const claims = user.customClaims || {};
    if (claims.role !== "manager") return NextResponse.json({ error: "الحساب ليس مشرفًا فرعيًا" }, { status: 409 });
    await auth.updateUser(uid, { disabled });
    const now = new Date().toISOString();
    await db.collection("customers").doc(uid).set({ accountStatus: disabled ? "blocked" : "active", updatedAt: now, updatedBy: owner.uid }, { merge: true });
    await db.collection("auditLogs").add({ action: disabled ? "manager_disabled" : "manager_enabled", managerUid: uid, actorUid: owner.uid, at: now });
    return NextResponse.json({ ok: true, disabled });
  } catch (error) {
    console.error("Failed to update manager", error);
    return NextResponse.json({ error: "تعذر تحديث المشرف" }, { status: 500 });
  }
}
