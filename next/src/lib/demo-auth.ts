import type { Role } from "@/lib/types";

const SESSION_KEY = "chrigsm:session";
const SESSION_EVENT = "chrigsm:demo-session";
const PASSWORD_RESET_CONTINUE_PATH = "/login?reset=sent";
let observerStarted = false;

export type DemoSession = { uid: string; role: Role; fullName: string; phone: string; email: string; signedInAt: string };
export type PasswordResetResult = "sent" | "invalid-email" | "unavailable";
export type RegistrationResult = "created" | "email-in-use" | "weak-password" | "invalid-email" | "unavailable";

type FirebaseUserLike = {
  uid: string;
  displayName: string | null;
  phoneNumber: string | null;
  email: string | null;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
};

function browserReady() { return typeof window !== "undefined"; }
function emit() { if (browserReady()) window.dispatchEvent(new Event(SESSION_EVENT)); }
function persist(session: DemoSession | null) {
  if (!browserReady()) return;
  if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else window.localStorage.removeItem(SESSION_KEY);
  emit();
}

export function normalizedEmail(value: string) { return value.trim().toLowerCase(); }
function validEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }

async function authModules() {
  const [
    { createUserWithEmailAndPassword, getIdTokenResult, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updateProfile },
    { doc, getDoc },
    { firebaseServices },
  ] = await Promise.all([
    import("firebase/auth"),
    import("firebase/firestore"),
    import("@/lib/firebase/client"),
  ]);
  return { createUserWithEmailAndPassword, getIdTokenResult, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updateProfile, doc, getDoc, firebaseServices };
}

async function firebaseSession(user: FirebaseUserLike): Promise<DemoSession> {
  const { getIdTokenResult, doc, getDoc, firebaseServices } = await authModules();
  const claims = await getIdTokenResult(user as never, true);
  let role: Role = claims.claims.role === "admin" ? "admin" : "customer";
  let fullName = user.displayName || user.email?.split("@")[0] || "عميل ChriGsm";
  let phone = user.phoneNumber || "";

  // يطابق التفويض في الواجهة منطق requireAdmin الخادمي: Custom Claim أولًا، ثم ملف العميل المملوك للمستخدم.
  try {
    const services = firebaseServices();
    const customer = services ? await getDoc(doc(services.db, "customers", user.uid)) : null;
    if (customer?.exists()) {
      const profile = customer.data() as Record<string, unknown>;
      if (profile.role === "admin") role = "admin";
      if (typeof profile.fullName === "string" && profile.fullName.trim()) fullName = profile.fullName;
      if (typeof profile.phone === "string") phone = profile.phone;
    }
  } catch {
    // يبقى المستخدم عميلًا عند تعذر قراءة ملفه؛ لا يمنح الفشل أي صلاحية إدارية.
  }

  return {
    uid: user.uid,
    role,
    fullName,
    phone,
    email: user.email || "",
    signedInAt: new Date().toISOString(),
  };
}

function startFirebaseObserver() {
  if (!browserReady() || observerStarted) return;
  observerStarted = true;
  void (async () => {
    const { firebaseServices, onAuthStateChanged } = await authModules();
    const services = firebaseServices();
    if (!services) { persist(null); return; }
    onAuthStateChanged(services.auth, async (user) => {
      try { persist(user ? await firebaseSession(user) : null); }
      catch { persist(null); }
    });
  })();
}

export function getDemoSession(): DemoSession | null {
  if (!browserReady()) return null;
  startFirebaseObserver();
  try { const stored = window.localStorage.getItem(SESSION_KEY); return stored ? JSON.parse(stored) as DemoSession : null; }
  catch { return null; }
}

export async function signInDemo(email: string, password: string): Promise<DemoSession | null> {
  const { firebaseServices, signInWithEmailAndPassword } = await authModules();
  const services = firebaseServices();
  if (!services) return null;
  try {
    const credential = await signInWithEmailAndPassword(services.auth, normalizedEmail(email), password);
    const session = await firebaseSession(credential.user);
    persist(session);
    return session;
  } catch {
    return null;
  }
}

export async function registerCustomer(fullName: string, phone: string, email: string, password: string): Promise<RegistrationResult> {
  const normalized = normalizedEmail(email);
  const name = fullName.trim();
  if (!validEmail(normalized)) return "invalid-email";
  if (name.length < 2 || password.length < 8) return "weak-password";

  const { createUserWithEmailAndPassword, firebaseServices, signOut, updateProfile } = await authModules();
  const services = firebaseServices();
  if (!services) return "unavailable";

  try {
    const credential = await createUserWithEmailAndPassword(services.auth, normalized, password);
    await updateProfile(credential.user, { displayName: name });
    const token = await credential.user.getIdToken();
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ fullName: name, phone: phone.trim() }),
    });
    if (!response.ok) {
      await signOut(services.auth).catch(() => undefined);
      return "unavailable";
    }

    persist(await firebaseSession(credential.user));
    return "created";
  } catch (reason) {
    const code = typeof reason === "object" && reason && "code" in reason ? String(reason.code) : "";
    if (code === "auth/email-already-in-use") return "email-in-use";
    if (code === "auth/weak-password") return "weak-password";
    if (code === "auth/invalid-email") return "invalid-email";
    return "unavailable";
  }
}

export async function requestPasswordReset(email: string): Promise<PasswordResetResult> {
  const normalized = normalizedEmail(email);
  if (!validEmail(normalized)) return "invalid-email";

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl || !/^https:\/\/[^/?#]+$/i.test(appUrl)) return "unavailable";

  const { firebaseServices, sendPasswordResetEmail } = await authModules();
  const services = firebaseServices();
  if (!services) return "unavailable";

  try {
    services.auth.languageCode = "ar";
    await sendPasswordResetEmail(services.auth, normalized, {
      url: `${appUrl}${PASSWORD_RESET_CONTINUE_PATH}`,
      handleCodeInApp: false,
    });
    return "sent";
  } catch (reason) {
    const code = typeof reason === "object" && reason && "code" in reason ? String(reason.code) : "";
    if (code === "auth/user-not-found" || code === "auth/invalid-credential") return "sent";
    return "unavailable";
  }
}

export function signOutDemo() {
  persist(null);
  void (async () => {
    const { firebaseServices, signOut } = await authModules();
    const services = firebaseServices();
    if (services) await signOut(services.auth).catch(() => undefined);
  })();
}
