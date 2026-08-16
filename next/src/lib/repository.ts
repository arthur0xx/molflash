import "server-only";

import { adminDb } from "./firebase/admin";
import type { OrderStatus, StoreSnapshot } from "./types";

export type StorefrontSnapshot = Pick<StoreSnapshot, "categories" | "services">;

export function emptyStoreSnapshot(): StoreSnapshot {
  return { categories: [], services: [], customers: [], orders: [], walletEntries: [] };
}

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

/** Reads the full operational snapshot for an owner-only, already authorized server request. */
export async function getSnapshot(): Promise<StoreSnapshot> {
  const db = adminDb();
  if (!db) return emptyStoreSnapshot();

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

/**
 * Returns only the order-related records a limited manager needs to process orders.
 * Wallet entries and customers without an assigned order are intentionally omitted.
 */
export async function getOrderStaffSnapshot(): Promise<StoreSnapshot> {
  const db = adminDb();
  if (!db) return emptyStoreSnapshot();

  const ordersSnapshot = await db.collection("orders").orderBy("updatedAt", "desc").get();
  const orders = ordersSnapshot.docs.map((document) => ({ id: document.id, ...document.data() })) as StoreSnapshot["orders"];
  const customerIds = [...new Set(orders.map((order) => order.customerId).filter(Boolean))];
  const serviceIds = [...new Set(orders.map((order) => order.serviceId).filter(Boolean))];

  const [customerDocuments, serviceDocuments] = await Promise.all([
    customerIds.length ? db.getAll(...customerIds.map((id) => db.collection("customers").doc(id))) : Promise.resolve([]),
    serviceIds.length ? db.getAll(...serviceIds.map((id) => db.collection("services").doc(id))) : Promise.resolve([]),
  ]);

  return {
    categories: [],
    services: serviceDocuments.filter((document) => document.exists).map((document) => {
      const raw = document.data() || {};
      return { id: document.id, slug: "", title: String(raw.title || "خدمة رقمية"), categoryId: "", description: "", priceMad: 0, delivery: "", isActive: false, fields: [] };
    }) as StoreSnapshot["services"],
    customers: customerDocuments.filter((document) => document.exists).map((document) => {
      const raw = document.data() || {};
      return { id: document.id, fullName: String(raw.fullName || "عميل"), phone: String(raw.phone || ""), email: String(raw.email || ""), walletMad: 0, ordersCount: 0, lastActivity: "", whatsappEnabled: false, accountStatus: "active" };
    }) as StoreSnapshot["customers"],
    orders,
    walletEntries: [],
  };
}

export function orderTone(status: OrderStatus) {
  return { new: "blue", processing: "amber", waiting: "violet", completed: "green", rejected: "red" }[status];
}
