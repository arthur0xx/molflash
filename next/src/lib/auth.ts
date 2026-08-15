import type { Role } from "@/lib/types";

const SESSION_KEY = "chrigsm:session";
const SESSION_EVENT = "chrigsm:auth-session";
let observerStarted = false;

export type AuthSession = { uid: string; role: Role; fullName: string; phone: string; email: string; emailVerified: boolean; signedInAt: string; managerPermissions?: { orders: boolean; support: boolean } };
export type PasswordResetResult = "sent" | "invalid-email" | "unavailable";
export type RegistrationResult = "created" | "email-in-use" | "weak-password" | "invalid-email" | "verification-unavailable" | "unavailable";
export type VerificationResult = "sent" | "already-verified" | "unavailable";
export type GoogleSignInResult = "signed-in" | "existing-account" | "unavailable";

type FirebaseUserLike = {
  uid: string;
  displayName: string | null;
  phoneNumber: string | null;
  email: string | null;
  emailVerified: boolean;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
  reload: () => Promise<void>;
};

function browserReady() { return typeof window !== "undefined"; }
function emit() { if (browserReady()) window.dispatchEvent(new Event(SESSION_EVENT)); }
function persist(session: AuthSession | null) {
  if (!browserReady()) return;
  if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else window.localStorage.removeItem(SESSION_KEY);
  emit();
}

export function normalizedEmail(value: string) { return value.trim().toLowerCase(); }
function validEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }

async function authModules() {
  const [
    { GoogleAuthProvider, applyActionCode, confirmPasswordReset, createUserWithEmailAndPassword, deleteUser, getAdditionalUserInfo, getIdTokenResult, onAuthStateChanged, reload, signInWithEmailAndPassword, signInWithPopup, signOut, updateProfile, verifyPasswordResetCode },
    { doc, getDoc },
    { firebaseServices },
  ] = await Promise.all([import("firebase/auth"), import("firebase/firestore"), import("@/lib/firebase/client")]);
  return { GoogleAuthProvider, applyActionCode, confirmPasswordReset, createUserWithEmailAndPassword, deleteUser, getAdditionalUserInfo, getIdTokenResult, onAuthStateChanged, reload, signInWithEmailAndPassword, signInWithPopup, signOut, updateProfile, verifyPasswordResetCode, doc, getDoc, firebaseServices };
}

async function firebaseSession(user: FirebaseUserLike): Promise<AuthSession> {
  const { getIdTokenResult, doc, getDoc, firebaseServices } = await authModules();
  const claims = await getIdTokenResult(user as never, true);
  const claimRole = claims.claims.role;
  const role: Role = claimRole === "admin" || claimRole === "manager" ? claimRole : "customer";
  const claimedPermissions = claims.claims.managerPermissions;
  const managerPermissions = claimedPermissions && typeof claimedPermissions === "object"
    ? { orders: (claimedPermissions as Record<string, unknown>).orders === true, support: (claimedPermissions as Record<string, unknown>).support === true }
    : undefined;
  let fullName = user.displayName || user.email?.split("@")[0] || "عميل ChriGsm";
  let phone = user.phoneNumber || "";
  try {
    const services = firebaseServices();
    const customer = services ? await getDoc(doc(services.db, "customers", user.uid)) : null;
    if (customer?.exists()) {
      const profile = customer.data() as Record<string, unknown>;
      if (typeof profile.fullName === "string" && profile.fullName.trim()) fullName = profile.fullName;
      if (typeof profile.phone === "string") phone = profile.phone;
    }
  } catch {
    // لا يمنح تعذر قراءة الملف أي صلاحية إدارية.
  }
  return { uid: user.uid, role, fullName, phone, email: user.email || "", emailVerified: user.emailVerified, signedInAt: new Date().toISOString(), managerPermissions };
}

async function requestCustomVerificationEmail(user: FirebaseUserLike): Promise<VerificationResult> {
  if (user.emailVerified) return "already-verified";
  try {
    const token = await user.getIdToken();
    const response = await fetch("/api/auth/send-verification", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) return "unavailable";
    const body = await response.json().catch(() => null) as { status?: string } | null;
    return body?.status === "already-verified" ? "already-verified" : "sent";
  } catch {
    return "unavailable";
  }
}

function startFirebaseObserver() {
  if (!browserReady() || observerStarted) return;
  observerStarted = true;
  void (async () => {
    const { firebaseServices, onAuthStateChanged } = await authModules();
    const services = firebaseServices();
    if (!services) { persist(null); return; }
    onAuthStateChanged(services.auth, async (user) => {
      try { persist(user ? await firebaseSession(user as FirebaseUserLike) : null); }
      catch { persist(null); }
    });
  })();
}

export function getAuthSession(): AuthSession | null {
  if (!browserReady()) return null;
  startFirebaseObserver();
  try { const stored = window.localStorage.getItem(SESSION_KEY); return stored ? JSON.parse(stored) as AuthSession : null; }
  catch { return null; }
}

export async function refreshAuthSession(): Promise<AuthSession | null> {
  const { firebaseServices, reload } = await authModules();
  const services = firebaseServices();
  const user = services?.auth.currentUser;
  if (!user) { persist(null); return null; }
  await reload(user);
  const session = await firebaseSession(user as FirebaseUserLike);
  persist(session);
  return session;
}

export async function signIn(email: string, password: string): Promise<AuthSession | null> {
  const { firebaseServices, signInWithEmailAndPassword } = await authModules();
  const services = firebaseServices();
  if (!services) return null;
  try {
    const credential = await signInWithEmailAndPassword(services.auth, normalizedEmail(email), password);
    const session = await firebaseSession(credential.user as FirebaseUserLike);
    persist(session);
    return session;
  } catch { return null; }
}

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  const { GoogleAuthProvider, deleteUser, firebaseServices, getAdditionalUserInfo, signInWithPopup, signOut: firebaseSignOut } = await authModules();
  const services = firebaseServices();
  if (!services) return "unavailable";

  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const credential = await signInWithPopup(services.auth, provider);
    const user = credential.user as FirebaseUserLike;
    const token = await user.getIdToken();
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ fullName: user.displayName?.trim() || user.email?.split("@")[0] || "عميل ChriGsm", phone: "" }),
    });

    if (!response.ok) {
      const details = getAdditionalUserInfo(credential);
      if (details?.isNewUser) await deleteUser(credential.user).catch(() => undefined);
      await firebaseSignOut(services.auth).catch(() => undefined);
      return "unavailable";
    }

    persist(await firebaseSession(user));
    return "signed-in";
  } catch (reason) {
    const code = typeof reason === "object" && reason && "code" in reason ? String(reason.code) : "";
    if (code === "auth/account-exists-with-different-credential") return "existing-account";
    return "unavailable";
  }
}

export async function registerCustomer(fullName: string, phone: string, email: string, password: string): Promise<RegistrationResult> {
  const normalized = normalizedEmail(email);
  const name = fullName.trim();
  if (!validEmail(normalized)) return "invalid-email";
  if (name.length < 2 || password.length < 8) return "weak-password";

  const { createUserWithEmailAndPassword, deleteUser, firebaseServices, signOut, updateProfile } = await authModules();
  const services = firebaseServices();
  if (!services) return "unavailable";
  try {
    const credential = await createUserWithEmailAndPassword(services.auth, normalized, password);
    await updateProfile(credential.user, { displayName: name });
    const token = await credential.user.getIdToken();
    const response = await fetch("/api/auth/register", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ fullName: name, phone: phone.trim() }) });
    if (!response.ok) {
      await deleteUser(credential.user).catch(() => undefined);
      await signOut(services.auth).catch(() => undefined);
      return "unavailable";
    }
    persist(await firebaseSession(credential.user as FirebaseUserLike));
    const verification = await requestCustomVerificationEmail(credential.user as FirebaseUserLike);
    return verification === "sent" || verification === "already-verified" ? "created" : "verification-unavailable";
  } catch (reason) {
    const code = typeof reason === "object" && reason && "code" in reason ? String(reason.code) : "";
    if (code === "auth/email-already-in-use") return "email-in-use";
    if (code === "auth/weak-password") return "weak-password";
    if (code === "auth/invalid-email") return "invalid-email";
    return "unavailable";
  }
}

export async function sendVerificationEmail(): Promise<VerificationResult> {
  const { firebaseServices } = await authModules();
  const user = firebaseServices()?.auth.currentUser;
  return user ? requestCustomVerificationEmail(user as FirebaseUserLike) : "unavailable";
}

export async function completeEmailVerification(actionCode: string): Promise<"verified" | "invalid"> {
  const { applyActionCode, firebaseServices, reload } = await authModules();
  const services = firebaseServices();
  if (!services || !actionCode) return "invalid";
  try {
    await applyActionCode(services.auth, actionCode);
    if (services.auth.currentUser) {
      await reload(services.auth.currentUser);
      persist(await firebaseSession(services.auth.currentUser as FirebaseUserLike));
    }
    return "verified";
  } catch { return "invalid"; }
}

export async function checkPasswordReset(actionCode: string): Promise<"valid" | "invalid"> {
  const { firebaseServices, verifyPasswordResetCode } = await authModules();
  const services = firebaseServices();
  if (!services || !actionCode) return "invalid";
  try { await verifyPasswordResetCode(services.auth, actionCode); return "valid"; }
  catch { return "invalid"; }
}

export async function completePasswordReset(actionCode: string, password: string): Promise<"completed" | "weak-password" | "invalid"> {
  if (password.length < 8) return "weak-password";
  const { confirmPasswordReset, firebaseServices } = await authModules();
  const services = firebaseServices();
  if (!services || !actionCode) return "invalid";
  try { await confirmPasswordReset(services.auth, actionCode, password); return "completed"; }
  catch (reason) {
    const code = typeof reason === "object" && reason && "code" in reason ? String(reason.code) : "";
    return code === "auth/weak-password" ? "weak-password" : "invalid";
  }
}

export async function requestPasswordReset(email: string): Promise<PasswordResetResult> {
  const normalized = normalizedEmail(email);
  if (!validEmail(normalized)) return "invalid-email";
  try {
    const response = await fetch("/api/auth/password-reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: normalized }),
    });
    return response.ok ? "sent" : "unavailable";
  } catch {
    return "unavailable";
  }
}

export function signOut() {
  persist(null);
  void (async () => {
    const { firebaseServices, signOut: firebaseSignOut } = await authModules();
    const services = firebaseServices();
    if (services) await firebaseSignOut(services.auth).catch(() => undefined);
  })();
}
