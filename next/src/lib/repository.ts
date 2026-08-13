import { demoSnapshot } from "./demo-data";
import { adminDb } from "./firebase/admin";
import type { DemoSnapshot, OrderStatus } from "./types";

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
