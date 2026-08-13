import type { Role } from "@/lib/types";

const DEMO_SESSION_KEY = "chrigsm:demo-session";
export type DemoSession = { uid: string; role: Role; fullName: string; phone: string; email: string; signedInAt: string };
type DemoCredential = DemoSession & { password: string };

const demoCredentials: DemoCredential[] = [
  { uid: "admin-demo", role: "admin", fullName: "مدير ChriGsm", phone: "0600000000", email: "admin@chrigsm.test", password: "AdminDemo2026!", signedInAt: "" },
  { uid: "customer-demo", role: "customer", fullName: "ياسين الفاسي", phone: "0611111111", email: "yassine.demo@chrigsm.test", password: "ClientDemo2026!", signedInAt: "" },
];

function browserReady() { return typeof window !== "undefined"; }

export function getDemoSession(): DemoSession | null {
  if (!browserReady()) return null;
  try { const stored = window.localStorage.getItem(DEMO_SESSION_KEY); return stored ? JSON.parse(stored) as DemoSession : null; } catch { return null; }
}

export function signInDemo(identifier: string, password: string): DemoSession | null {
  const normalized = identifier.replace(/\s/g, "").toLowerCase();
  const match = demoCredentials.find((account) => (account.phone === identifier.replace(/\s/g, "") || account.email.toLowerCase() === normalized) && account.password === password);
  if (!match || !browserReady()) return null;
  const { password: _password, ...base } = match;
  const session: DemoSession = { ...base, signedInAt: new Date().toISOString() };
  window.localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event("chrigsm:demo-session"));
  return session;
}

export function signOutDemo() {
  if (!browserReady()) return;
  window.localStorage.removeItem(DEMO_SESSION_KEY);
  window.dispatchEvent(new Event("chrigsm:demo-session"));
}

export const demoLoginHints = {
  admin: { phone: "0600000000", password: "AdminDemo2026!" },
  customer: { phone: "0611111111", password: "ClientDemo2026!" },
};
