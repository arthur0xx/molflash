import type { Role } from "@/lib/types";

const SESSION_KEY = "chrigsm:session";
const SESSION_EVENT = "chrigsm:session";
const PASSWORD_RESET_CONTINUE_PATH = "/login?reset=sent";
let observerStarted = false;

export type DemoSession = { uid: string; role: Role; fullName: string; phone: string; email: string; signedInAt: string };
export type PasswordResetResult = "sent" | "invalid-email" | "unavailable";

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
  const [{ getIdTokenResult, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut }, { firebaseServices }] = await Promise.all([
    import("firebase/auth"),
    import("@/lib/firebase/client"),
  ]);
  return { getIdTokenResult, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, firebaseServices };
}

async function firebaseSession(user: { uid: string; displayName: string | null; phoneNumber: string | null; email: string | null; getIdToken: (forceRefresh?: boolean) => Promise<string> }): Promise<DemoSession> {
  const { getIdTokenResult } = await authModules();
  const claims = await getIdTokenResult(user as never, true);
  return {
    uid: user.uid,
    role: claims.claims.role === "admin" ? "admin" : "customer",
    fullName: user.displayName || user.email?.split("@")[0] || "عميل ChriGsm",
    phone: user.phoneNumber || "",
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
