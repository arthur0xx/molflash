import "server-only";

import type { ActionCodeSettings } from "firebase-admin/auth";
import { sendAuthEmail } from "@/lib/email";
import { adminAuth } from "@/lib/firebase/admin";

export type AuthEmailStatus = "sent" | "already-verified" | "unavailable";

function appOrigin() {
  const rawValue = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!rawValue) return null;
  try {
    const value = new URL(rawValue);
    if (value.protocol !== "https:" || value.username || value.password || value.search || value.hash) return null;
    return value.origin;
  } catch {
    return null;
  }
}

function actionCodeSettings(continuePath: "/account" | "/login"): ActionCodeSettings | null {
  const origin = appOrigin();
  if (!origin) return null;
  return { url: new URL(continuePath, origin).toString(), handleCodeInApp: false };
}

function customActionUrl(firebaseActionUrl: string) {
  const origin = appOrigin();
  if (!origin) throw new Error("APP_URL_UNAVAILABLE");

  const source = new URL(firebaseActionUrl);
  const target = new URL("/auth/action", origin);
  source.searchParams.forEach((value, key) => target.searchParams.append(key, value));

  const mode = target.searchParams.get("mode");
  const actionCode = target.searchParams.get("oobCode");
  if (!actionCode || (mode !== "verifyEmail" && mode !== "resetPassword")) throw new Error("INVALID_FIREBASE_ACTION_LINK");
  return target.toString();
}

export async function sendVerificationEmailForUser(uid: string): Promise<AuthEmailStatus> {
  const auth = adminAuth();
  const settings = actionCodeSettings("/account");
  if (!auth || !settings) return "unavailable";

  try {
    const user = await auth.getUser(uid);
    if (!user.email) return "unavailable";
    if (user.emailVerified) return "already-verified";

    const firebaseActionUrl = await auth.generateEmailVerificationLink(user.email, settings);
    await sendAuthEmail({ to: user.email, actionUrl: customActionUrl(firebaseActionUrl), kind: "verify" });
    return "sent";
  } catch {
    return "unavailable";
  }
}

export async function sendPasswordResetEmailForAddress(email: string): Promise<"sent" | "unavailable"> {
  const auth = adminAuth();
  const settings = actionCodeSettings("/login");
  if (!auth || !settings) return "unavailable";

  try {
    const firebaseActionUrl = await auth.generatePasswordResetLink(email, settings);
    await sendAuthEmail({ to: email, actionUrl: customActionUrl(firebaseActionUrl), kind: "reset" });
    return "sent";
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "auth/user-not-found") return "sent";
    return "unavailable";
  }
}
