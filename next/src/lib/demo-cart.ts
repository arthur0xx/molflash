import type { Service } from "@/lib/types";

const DEMO_CART_KEY = "chrigsm:demo-cart";
export type BrowserCartItem = Pick<Service, "id" | "slug" | "title" | "priceMad" | "categoryId">;

function read(): BrowserCartItem[] {
  if (typeof window === "undefined") return [];
  try { const raw = window.localStorage.getItem(DEMO_CART_KEY); return raw ? JSON.parse(raw) as BrowserCartItem[] : []; } catch { return []; }
}
function save(items: BrowserCartItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEMO_CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("chrigsm:demo-cart"));
}

export function getBrowserCartItems() { return read(); }
export function addBrowserCartItem(service: Service) {
  const items = read();
  if (!items.some((item) => item.id === service.id)) save([...items, { id: service.id, slug: service.slug, title: service.title, priceMad: service.priceMad, categoryId: service.categoryId }]);
}
export function removeBrowserCartItem(serviceId: string) { save(read().filter((item) => item.id !== serviceId)); }
