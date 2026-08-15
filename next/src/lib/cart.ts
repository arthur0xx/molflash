import type { Service } from "@/lib/types";

const CART_KEY = "chrigsm:cart";
const CART_EVENT = "chrigsm:cart-changed";
export type BrowserCartItem = Pick<Service, "id">;

function read(): BrowserCartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    const parsed = raw ? JSON.parse(raw) as Array<Partial<BrowserCartItem>> : [];
    return parsed.filter((item): item is BrowserCartItem => typeof item?.id === "string").map((item) => ({ id: item.id }));
  } catch { return []; }
}

function save(items: BrowserCartItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(CART_EVENT));
}

export function getCartItems() { return read(); }
export function addCartItem(service: Service) {
  const items = read();
  if (!items.some((item) => item.id === service.id)) save([...items, { id: service.id }]);
}
export function removeCartItem(serviceId: string) { save(read().filter((item) => item.id !== serviceId)); }
