import { adminDb } from "./firebase/admin";
import type { OrderStatus, StoreSnapshot } from "./types";

export type StorefrontSnapshot = Pick<StoreSnapshot, "categories" | "services">;

const emptySnapshot: StoreSnapshot = { categories: [], services: [], customers: [], orders: [], walletEntries: [] };

/** Reads only active catalog data for public storefront pages. */
export async function getStorefrontSnapshot(): Promise<StorefrontSnapshot> {
  const db = adminDb();
  if (!db) return { categories: [], services: [] };

  const [categories, services] = await Promise.all([
    db.collection("categories").orderBy("order").get(),
    db.collection("services").orderBy("title").get(),
  ]);

  const publicCategories = categories.docs.map((document) => ({ id: document.id, ...document.data() })) as StorefrontSnapshot["categories"];
  const publicServices = services.docs.map((document) => ({ id: document.id, ...document.data() })) as StorefrontSnapshot["services"];
  return { categories: publicCategories.filter((category) => category.isActive), services: publicServices.filter((service) => service.isActive) };
}

/** Reads the full operational snapshot for the protected CMC server page only. */
export async function getSnapshot(): Promise<StoreSnapshot> {
  const db = adminDb();
  if (!db) return emptySnapshot;

  const [categories, services, customers, orders, walletEntries] = await Promise.all([
    db.collection("categories").orderBy("order").get(),
    db.collection("services").orderBy("title").get(),
    db.collection("customers").orderBy("fullName").get(),
    db.collection("orders").orderBy("updatedAt", "desc").get(),
    db.collection("walletEntries").orderBy("createdAt", "desc").get(),
  ]);

  return {
    categories: categories.docs.map((document) => ({ id: document.id, ...document.data() })) as StoreSnapshot["categories"],
    services: services.docs.map((document) => ({ id: document.id, ...document.data() })) as StoreSnapshot["services"],
    customers: customers.docs.map((document) => ({ id: document.id, ...document.data() })) as StoreSnapshot["customers"],
    orders: orders.docs.map((document) => ({ id: document.id, ...document.data() })) as StoreSnapshot["orders"],
    walletEntries: walletEntries.docs.map((document) => ({ id: document.id, ...document.data() })) as StoreSnapshot["walletEntries"],
  };
}

export function orderTone(status: OrderStatus) {
  return { new: "blue", processing: "amber", waiting: "violet", completed: "green", rejected: "red" }[status];
}
