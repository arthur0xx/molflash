import { getIdTokenResult, onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { firebaseServices } from "@/lib/firebase/client";
import type { Role } from "@/lib/types";

const DEMO_SESSION_KEY = "chrigsm:demo-session";
const SESSION_EVENT = "chrigsm:demo-session";
let observerStarted = false;

export type DemoSession = { uid: string; role: Role; fullName: string; phone: string; email: string; signedInAt: string };
type DemoCredential = DemoSession & { password: string };

const demoCredentials: DemoCredential[] = [
  { uid: "admin-demo", role: "admin", fullName: "مدير ChriGsm", phone: "0600000000", email: "admin@chrigsm.test", password: "AdminDemo2026!", signedInAt: "" },
  { uid: "cus-yassine", role: "customer", fullName: "ياسين الفاسي", phone: "0611111111", email: "yassine.demo@chrigsm.test", password: "ClientDemo2026!", signedInAt: "" },
];

function browserReady() { return typeof window !== "undefined"; }
function emit() { if (browserReady()) window.dispatchEvent(new Event(SESSION_EVENT)); }
function persist(session: DemoSession | null) {
  if (!browserReady()) return;
  if (session) window.localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
  else window.localStorage.removeItem(DEMO_SESSION_KEY);
  emit();
}

async function firebaseSession(user: User): Promise<DemoSession> {
  const claims = await getIdTokenResult(user, true);
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
  const services = firebaseServices();
  if (!services) return;
  observerStarted = true;
  onAuthStateChanged(services.auth, async (user) => {
    try { persist(user ? await firebaseSession(user) : null); }
    catch { persist(null); }
  });
}

export function getDemoSession(): DemoSession | null {
  if (!browserReady()) return null;
  startFirebaseObserver();
  try { const stored = window.localStorage.getItem(DEMO_SESSION_KEY); return stored ? JSON.parse(stored) as DemoSession : null; }
  catch { return null; }
}

function normalizedEmail(identifier: string) {
  const compact = identifier.replace(/\s/g, "");
  return demoCredentials.find((account) => account.phone === compact)?.email || compact.toLowerCase();
}

/** Uses Firebase Auth whenever public Firebase configuration exists; local credentials remain only as a no-config fallback. */
export async function signInDemo(identifier: string, password: string): Promise<DemoSession | null> {
  const services = firebaseServices();
  if (services) {
    try {
      const credential = await signInWithEmailAndPassword(services.auth, normalizedEmail(identifier), password);
      const session = await firebaseSession(credential.user);
      persist(session);
      return session;
    } catch {
      return null;
    }
  }

  const normalized = identifier.replace(/\s/g, "").toLowerCase();
  const match = demoCredentials.find((account) => (account.phone === identifier.replace(/\s/g, "") || account.email.toLowerCase() === normalized) && account.password === password);
  if (!match || !browserReady()) return null;
  const { password: _password, ...base } = match;
  const session: DemoSession = { ...base, signedInAt: new Date().toISOString() };
  persist(session);
  return session;
}

export function signOutDemo() {
  persist(null);
  const services = firebaseServices();
  if (services) void signOut(services.auth).catch(() => undefined);
}

export const demoLoginHints = {
  admin: { phone: "0600000000", password: "AdminDemo2026!" },
  customer: { phone: "0611111111", password: "ClientDemo2026!" },
};
