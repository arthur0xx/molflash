import "server-only";

import { adminDb } from "./firebase/admin";
import type { BlogCategory, BlogPost, OrderStatus, Service, StoreSnapshot } from "./types";

export type StorefrontSnapshot = Pick<StoreSnapshot, "categories" | "services">;

export function emptyStoreSnapshot(): StoreSnapshot {
  return { categories: [], services: [], customers: [], orders: [], walletEntries: [], paymentMethods: [], payments: [] };
}

/** Reads only active catalog data for public storefront pages. */
export async function getStorefrontSnapshot(): Promise<StorefrontSnapshot> {
  const db = adminDb();
  if (!db) return { categories: [], services: [] };

  const [categories, services] = await Promise.all([
    db.collection("categories").orderBy("order").get(),
    db.collection("services").get(),
  ]);

  const publicCategories = categories.docs.map((document) => ({ id: document.id, ...document.data() })) as StorefrontSnapshot["categories"];
  const activeServices = services.docs.map((document) => ({ id: document.id, ...document.data() })) as StorefrontSnapshot["services"];
  const visibleServices = activeServices.filter((service) => service.isActive).sort((left, right) => {
    const promotedDifference = Number(right.promoteInCatalog === true) - Number(left.promoteInCatalog === true);
    if (promotedDifference) return promotedDifference;
    const updatedDifference = String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""));
    if (updatedDifference) return updatedDifference;
    return String(left.title || "").localeCompare(String(right.title || ""), "ar");
  });
  const visibleCategoryIds = new Set(visibleServices.map((service) => service.categoryId));
  return {
    categories: publicCategories.filter((category) => category.isActive && visibleCategoryIds.has(category.id)),
    services: visibleServices,
  };
}

/** Reads the full operational snapshot for an owner-only, already authorized server request. */
export async function getSnapshot(): Promise<StoreSnapshot> {
  const db = adminDb();
  if (!db) return emptyStoreSnapshot();

  const [categories, services, customers, orders, walletEntries, paymentMethods, payments] = await Promise.all([
    db.collection("categories").orderBy("order").get(),
    db.collection("services").orderBy("title").get(),
    db.collection("customers").orderBy("fullName").get(),
    db.collection("orders").orderBy("updatedAt", "desc").get(),
    db.collection("walletEntries").orderBy("createdAt", "desc").get(),
    db.collection("paymentMethods").orderBy("sortOrder", "asc").get(),
    db.collection("payments").orderBy("updatedAt", "desc").get(),
  ]);

  return {
    categories: categories.docs.map((document) => ({ id: document.id, ...document.data() })) as StoreSnapshot["categories"],
    services: services.docs.map((document) => ({ id: document.id, ...document.data() })) as StoreSnapshot["services"],
    customers: customers.docs.map((document) => ({ id: document.id, ...document.data() })) as StoreSnapshot["customers"],
    orders: orders.docs.map((document) => ({ id: document.id, ...document.data() })) as StoreSnapshot["orders"],
    walletEntries: walletEntries.docs.map((document) => ({ id: document.id, ...document.data() })) as StoreSnapshot["walletEntries"],
    paymentMethods: paymentMethods.docs.map((document) => ({ id: document.id, ...document.data() })) as StoreSnapshot["paymentMethods"],
    payments: payments.docs.map((document) => ({ id: document.id, ...document.data() })) as StoreSnapshot["payments"],
  };
}

/**
 * Returns only the order-related records a limited manager needs to process orders.
 * Wallet entries and customers without an assigned order are intentionally omitted.
 */
/** Returns catalogue records only for a manager with the signed catalog permission. */
export async function getCatalogStaffSnapshot(): Promise<StoreSnapshot> {
  const db = adminDb();
  if (!db) return emptyStoreSnapshot();

  const [categories, services] = await Promise.all([
    db.collection("categories").orderBy("order").get(),
    db.collection("services").orderBy("title").get(),
  ]);

  return {
    categories: categories.docs.map((document) => ({ id: document.id, ...document.data() })) as StoreSnapshot["categories"],
    services: services.docs.map((document) => ({ id: document.id, ...document.data() })) as StoreSnapshot["services"],
    customers: [],
    orders: [],
    walletEntries: [],
    paymentMethods: [],
    payments: [],
  };
}

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
    paymentMethods: [],
    payments: [],
  };
}

export type PublicBlogSnapshot = { categories: BlogCategory[]; posts: BlogPost[]; services: Service[] };

export async function getPublicBlogSnapshot(): Promise<PublicBlogSnapshot> {
  const db = adminDb();
  if (!db) return { categories: [], posts: [], services: [] };

  const [categories, posts, services] = await Promise.all([
    db.collection("blogCategories").orderBy("order", "asc").get(),
    db.collection("blogPosts").where("status", "==", "published").get(),
    db.collection("services").get(),
  ]);

  const publicCategories = categories.docs.map((document) => ({ id: document.id, ...document.data() })) as BlogCategory[];
  const publishedPosts = posts.docs.map((document) => ({ id: document.id, ...document.data() })) as BlogPost[];
  const activeServices = services.docs.map((document) => ({ id: document.id, ...document.data() })) as Service[];
  return {
    categories: publicCategories.filter((category) => category.isActive),
    posts: publishedPosts.sort((left, right) => String(right.publishedAt || right.updatedAt).localeCompare(String(left.publishedAt || left.updatedAt))),
    services: activeServices.filter((service) => service.isActive),
  };
}

export async function getPublicBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  const db = adminDb();
  if (!db) return null;
  const result = await db.collection("blogPosts").where("slug", "==", slug).limit(1).get();
  const document = result.docs[0];
  if (!document) return null;
  const post = { id: document.id, ...document.data() } as BlogPost;
  return post.status === "published" ? post : null;
}

export async function getBlogAdminSnapshot() {
  const db = adminDb();
  if (!db) return { categories: [] as BlogCategory[], posts: [] as BlogPost[], services: [] as Service[] };
  const [categories, posts, services] = await Promise.all([
    db.collection("blogCategories").orderBy("order", "asc").get(),
    db.collection("blogPosts").orderBy("updatedAt", "desc").get(),
    db.collection("services").orderBy("title", "asc").get(),
  ]);
  return {
    categories: categories.docs.map((document) => ({ id: document.id, ...document.data() })) as BlogCategory[],
    posts: posts.docs.map((document) => ({ id: document.id, ...document.data() })) as BlogPost[],
    services: services.docs.map((document) => ({ id: document.id, ...document.data() })) as Service[],
  };
}

export function orderTone(status: OrderStatus) {
  return { new: "blue", processing: "amber", waiting: "violet", completed: "green", rejected: "red" }[status];
}
