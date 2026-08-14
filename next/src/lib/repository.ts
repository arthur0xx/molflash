import { demoSnapshot } from "./demo-data";
import { adminDb } from "./firebase/admin";
import type { DemoSnapshot, OrderStatus } from "./types";

export type StorefrontSnapshot = Pick<DemoSnapshot, "categories" | "services">;

function demoStorefrontSnapshot(): StorefrontSnapshot {
  return {
    categories: demoSnapshot.categories.filter((category) => category.isActive),
    services: demoSnapshot.services.filter((service) => service.isActive),
  };
}

/** Reads only catalog data for public storefront pages. */
export async function getStorefrontSnapshot(): Promise<StorefrontSnapshot> {
  const db = adminDb();
  if (!db) return demoStorefrontSnapshot();

  const [categories, services] = await Promise.all([
    db.collection("categories").orderBy("order").get(),
    db.collection("services").orderBy("title").get(),
  ]);

  const publicCategories = categories.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as StorefrontSnapshot["categories"];
  const publicServices = services.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as StorefrontSnapshot["services"];
  return {
    categories: publicCategories.filter((category) => category.isActive),
    services: publicServices.filter((service) => service.isActive),
  };
}

/** Reads the full operational snapshot for the protected CMC server page only. */
export async function getSnapshot(): Promise<DemoSnapshot> {
  const db = adminDb();
  if (!db) return demoSnapshot;

  const [categories, services, customers, orders, walletEntries] = await Promise.all([
    db.collection("categories").orderBy("order").get(),
    db.collection("services").orderBy("title").get(),
    db.collection("customers").orderBy("fullName").get(),
    db.collection("orders").orderBy("updatedAt", "desc").get(),
    db.collection("walletEntries").orderBy("createdAt", "desc").get(),
  ]);

  return {
    categories: categories.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as DemoSnapshot["categories"],
    services: services.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as DemoSnapshot["services"],
    customers: customers.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as DemoSnapshot["customers"],
    orders: orders.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as DemoSnapshot["orders"],
    walletEntries: walletEntries.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as DemoSnapshot["walletEntries"],
  };
}

export function orderTone(status: OrderStatus) {
  return { new: "blue", processing: "amber", waiting: "violet", completed: "green", rejected: "red" }[status];
}
