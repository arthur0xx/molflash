import type { OrderStatus } from "@/lib/types";

const DEMO_ORDERS_KEY = "chrigsm:demo-orders";

export type BrowserDemoOrder = {
  id: string;
  serviceId: string;
  serviceTitle: string;
  totalMad: number;
  status: OrderStatus;
  createdAt: string;
  answers: Record<string, string>;
};

export function getBrowserDemoOrders(): BrowserDemoOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(DEMO_ORDERS_KEY);
    return stored ? JSON.parse(stored) as BrowserDemoOrder[] : [];
  } catch {
    return [];
  }
}

export function saveBrowserDemoOrder(order: BrowserDemoOrder) {
  if (typeof window === "undefined") return;
  const next = [order, ...getBrowserDemoOrders()];
  window.localStorage.setItem(DEMO_ORDERS_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("chrigsm:demo-order"));
}
