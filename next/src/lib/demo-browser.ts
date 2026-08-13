import type { OrderStatus } from "@/lib/types";

const DEMO_ORDERS_KEY = "chrigsm:demo-orders";
const DEMO_PROFILE_KEY = "chrigsm:demo-profile";
const DEMO_SUPPORT_KEY = "chrigsm:demo-support";

export type BrowserDemoOrder = {
  id: string;
  serviceId: string;
  serviceTitle: string;
  totalMad: number;
  status: OrderStatus;
  createdAt: string;
  answers: Record<string, string>;
};

export type BrowserDemoProfile = { fullName: string; phone: string; email: string };
export type BrowserSupportTicket = { id: string; subject: string; message: string; status: "open" | "answered"; createdAt: string };

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const stored = window.localStorage.getItem(key); return stored ? JSON.parse(stored) as T : fallback; } catch { return fallback; }
}
function save<T>(key: string, value: T, eventName: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value)); window.dispatchEvent(new Event(eventName));
}

export function getBrowserDemoOrders(): BrowserDemoOrder[] { return read<BrowserDemoOrder[]>(DEMO_ORDERS_KEY, []); }
export function saveBrowserDemoOrder(order: BrowserDemoOrder) { save(DEMO_ORDERS_KEY, [order, ...getBrowserDemoOrders()], "chrigsm:demo-order"); }
export function getBrowserDemoProfile(): BrowserDemoProfile | null { return read<BrowserDemoProfile | null>(DEMO_PROFILE_KEY, null); }
export function saveBrowserDemoProfile(profile: BrowserDemoProfile) { save(DEMO_PROFILE_KEY, profile, "chrigsm:demo-profile"); }
export function getBrowserSupportTickets(): BrowserSupportTicket[] { return read<BrowserSupportTicket[]>(DEMO_SUPPORT_KEY, []); }
export function saveBrowserSupportTicket(ticket: BrowserSupportTicket) { save(DEMO_SUPPORT_KEY, [ticket, ...getBrowserSupportTickets()], "chrigsm:demo-support"); }
