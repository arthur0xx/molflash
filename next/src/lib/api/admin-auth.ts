import { NextRequest } from "next/server";
import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth } from "@/lib/firebase/admin";

export async function requireUser(request: NextRequest): Promise<DecodedIdToken | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const auth = adminAuth();

  if (!token || !auth) return null;

  try {
    return await auth.verifyIdToken(token, true);
  } catch {
    return null;
  }
}

export async function requireVerifiedUser(request: NextRequest): Promise<DecodedIdToken | null> {
  const decoded = await requireUser(request);
  if (!decoded) return null;
  // حسابات الإدارة تعتمد Custom Claim موقّعًا، ولا تستخدم دورًا محفوظًا في ملف العميل.
  return decoded.role === "admin" || decoded.email_verified === true ? decoded : null;
}

/**
 * لا تُمنح صلاحية CMC إلا من Custom Claim موقّع في Firebase Authentication.
 * لا يُستخدم customers/{uid}.role مصدرًا للتفويض، لأنه جزء من ملف قابل للتغيير
 * عبر عمليات خادمية مستقبلية أو أخطاء عقد البيانات.
 */
export async function requireOwner(request: NextRequest): Promise<DecodedIdToken | null> {
  const decoded = await requireUser(request);
  return decoded?.role === "admin" || decoded?.role === "owner" ? decoded : null;
}

export async function requireStaff(request: NextRequest, permission?: "orders" | "support" | "catalog"): Promise<DecodedIdToken | null> {
  const decoded = await requireUser(request);
  if (decoded?.role === "admin" || decoded?.role === "owner") return decoded;
  if (decoded?.role !== "manager") return null;
  if (!permission) return decoded;
  const permissions = decoded.managerPermissions;
  return permissions && typeof permissions === "object" && (permissions as Record<string, unknown>)[permission] === true ? decoded : null;
}

/** Backwards-compatible alias for owner-only routes. */
export const requireAdmin = requireOwner;
