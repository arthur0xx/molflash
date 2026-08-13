import type { OrderNotification, OrderStatus, OrderStatusEvent } from "@/lib/types";

const DEMO_ORDERS_KEY = "chrigsm:demo-orders";
const DEMO_PROFILE_KEY = "chrigsm:demo-profile";
const DEMO_SUPPORT_KEY = "chrigsm:demo-support";

export type BrowserDemoOrder = {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  serviceId: string;
  serviceTitle: string;
  totalMad: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  answers: Record<string, string>;
  statusHistory: OrderStatusEvent[];
  deliveryCode?: string;
  deliveryNote?: string;
  notification?: OrderNotification;
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
function normalizeOrder(order: Partial<BrowserDemoOrder> & Pick<BrowserDemoOrder, "id" | "serviceId" | "serviceTitle" | "totalMad" | "status" | "createdAt" | "answers">): BrowserDemoOrder {
  const createdAt = order.createdAt || new Date().toISOString();
  return {
    id: order.id,
    customerId: order.customerId || "cus-yassine",
    customerName: order.customerName || "ياسين الفاسي",
    customerPhone: order.customerPhone || "+212 600-111222",
    customerEmail: order.customerEmail || "yassine.demo@chrigsm.test",
    serviceId: order.serviceId,
    serviceTitle: order.serviceTitle,
    totalMad: order.totalMad,
    status: order.status,
    createdAt,
    updatedAt: order.updatedAt || createdAt,
    answers: order.answers || {},
    statusHistory: order.statusHistory?.length ? order.statusHistory : [{ status: order.status, at: createdAt, note: "تم إنشاء الطلب" }],
    deliveryCode: order.deliveryCode,
    deliveryNote: order.deliveryNote,
    notification: order.notification,
  };
}

export function getBrowserDemoOrders(): BrowserDemoOrder[] { return read<Partial<BrowserDemoOrder>[]>(DEMO_ORDERS_KEY, []).map((order) => normalizeOrder(order as BrowserDemoOrder)); }
export function saveBrowserDemoOrder(order: BrowserDemoOrder) { save(DEMO_ORDERS_KEY, [normalizeOrder(order), ...getBrowserDemoOrders()], "chrigsm:demo-order"); }
export function updateBrowserDemoOrder(orderId: string, update: (order: BrowserDemoOrder) => BrowserDemoOrder) {
  const next = getBrowserDemoOrders().map((order) => order.id === orderId ? normalizeOrder(update(order)) : order);
  save(DEMO_ORDERS_KEY, next, "chrigsm:demo-order");
}
export function getBrowserDemoProfile(): BrowserDemoProfile | null { return read<BrowserDemoProfile | null>(DEMO_PROFILE_KEY, null); }
export function saveBrowserDemoProfile(profile: BrowserDemoProfile) { save(DEMO_PROFILE_KEY, profile, "chrigsm:demo-profile"); }
export function getBrowserSupportTickets(): BrowserSupportTicket[] { return read<BrowserSupportTicket[]>(DEMO_SUPPORT_KEY, []); }
export function saveBrowserSupportTickets(tickets: BrowserSupportTicket[]) { save(DEMO_SUPPORT_KEY, tickets, "chrigsm:demo-support"); }
export function saveBrowserSupportTicket(ticket: BrowserSupportTicket) { saveBrowserSupportTickets([ticket, ...getBrowserSupportTickets()]); }
