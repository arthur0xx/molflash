import { NextRequest } from "next/server";
import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export async function requireUser(request: NextRequest): Promise<DecodedIdToken | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const auth = adminAuth();

  if (!token || !auth) return null;

  try {
    return await auth.verifyIdToken(token);
  } catch {
    return null;
  }
}

export async function requireAdmin(request: NextRequest): Promise<DecodedIdToken | null> {
  const decoded = await requireUser(request);
  if (!decoded) return null;
  if (decoded.role === "admin") return decoded;

  const db = adminDb();
  if (!db) return null;
  try {
    const customer = await db.collection("customers").doc(decoded.uid).get();
    return customer.get("role") === "admin" ? decoded : null;
  } catch {
    return null;
  }
}
