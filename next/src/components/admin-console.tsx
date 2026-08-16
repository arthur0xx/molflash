"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { Ban, Boxes, CreditCard, FolderTree, MessageCircle, Pencil, Plus, Send, Settings2, ShieldAlert, ShieldCheck, Trash2, UserRound, UserX, UsersRound } from "lucide-react";
import type { Category, Customer, DynamicField, StoreSnapshot, Order, OrderStatus, Service, SupportTicket } from "@/lib/types";
import { formatMAD, statusLabels } from "@/lib/types";
import { firebaseServices } from "@/lib/firebase/client";
import { AdminSessionControls } from "@/components/admin-session-controls";
import { getAuthSession } from "@/lib/auth";
import { MediaImageControl } from "@/components/media-image-control";
import { requestSignedMediaUpload, uploadSignedMediaImage } from "@/lib/media-upload";

const statusOptions: OrderStatus[] = ["new", "processing", "waiting", "completed", "rejected"];
const orderTone = (status: OrderStatus) => ({ new: "blue", processing: "amber", waiting: "violet", completed: "green", rejected: "red" }[status]);
const fieldLabels: Record<string, string> = { email: "البريد الإلكتروني", imei: "IMEI", model: "موديل الجهاز", serial: "Serial Number", username: "اسم المستخدم", plan: "الباقة", duration: "مدة الكراء", game: "اللعبة", playerId: "Player ID" };
type Tab = "overview" | "orders" | "products" | "categories" | "customers" | "support" | "team" | "settings";
type DisplayOrder = Order;
type Editor = { kind: "category" | "service"; mode: "create" | "edit"; id?: string } | null;
type CategoryForm = { name: string; icon: string; color: string; description: string; order: string; isActive: boolean };
type ServiceForm = { slug: string; title: string; categoryId: string; description: string; priceMad: string; delivery: string; badge: string; imageUrl: string; imagePublicId: string; isActive: boolean; fields: DynamicField[] };
type MediaStatus = { configured: boolean; cloudName?: string };

const emptyCategoryForm = (order: number): CategoryForm => ({ name: "", icon: "Folder", color: "#1479FF", description: "", order: String(order), isActive: true });
const emptyServiceForm = (categoryId = ""): ServiceForm => ({ slug: "", title: "", categoryId, description: "", priceMad: "", delivery: "", badge: "", imageUrl: "", imagePublicId: "", isActive: false, fields: [] });
const walletBalance = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : 0;
const emptySnapshot = (): StoreSnapshot => ({ categories: [], services: [], customers: [], orders: [], walletEntries: [] });

const dynamicFieldTypes: { value: DynamicField["type"]; label: string }[] = [
  { value: "text", label: "نص قصير" },
  { value: "email", label: "بريد إلكتروني" },
  { value: "select", label: "قائمة اختيار" },
  { value: "textarea", label: "ملاحظة طويلة" },
];

function normalizeDynamicFields(fields: DynamicField[]): DynamicField[] {
  if (fields.length > 20) throw new Error("الحد الأقصى هو 20 حقلًا لكل خدمة.");
  const seenIds = new Set<string>();

  return fields.map((field, index) => {
    const id = field.id.trim();
    const label = field.label.trim();
    const placeholder = field.placeholder?.trim();
    if (!/^[a-z0-9-]{2,50}$/i.test(id)) throw new Error(`الحقل ${index + 1}: استخدم معرفًا من 2 إلى 50 حرفًا أو رقمًا أو شرطة فقط.`);
    if (seenIds.has(id.toLowerCase())) throw new Error(`معرف الحقل «${id}» مكرر.`);
    if (label.length < 2 || label.length > 120) throw new Error(`الحقل ${index + 1}: اكتب اسمًا من 2 إلى 120 حرفًا.`);
    if (placeholder && placeholder.length > 160) throw new Error(`الحقل ${index + 1}: النص المساعد طويل جدًا.`);
    seenIds.add(id.toLowerCase());

    if (field.type === "select") {
      const options = (field.options || []).map((option) => option.trim()).filter(Boolean);
      if (!options.length) throw new Error(`الحقل «${label}» يحتاج خيارًا واحدًا على الأقل.`);
      if (options.length > 50) throw new Error(`الحقل «${label}» يتجاوز الحد الأقصى للخيارات.`);
      return { id, label, type: field.type, required: field.required, ...(placeholder ? { placeholder } : {}), options };
    }

    return { id, label, type: field.type, required: field.required, ...(placeholder ? { placeholder } : {}) };
  });
}

export function AdminConsole() {
  const [data, setData] = useState<StoreSnapshot>(() => emptySnapshot());
  const [tab, setTab] = useState<Tab>("overview");
  const [session] = useState(() => typeof window === "undefined" ? null : getAuthSession());
  const isManager = session?.role === "manager";
  const managerPermissions = session?.managerPermissions || { orders: false, support: false };
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [typedName, setTypedName] = useState("");
  const firebase = useMemo(() => firebaseServices(), []);
  const [notice, setNotice] = useState(() => firebase ? "جارٍ تحميل بيانات CMC المحمية..." : "إعداد Firebase غير متاح حاليًا. لا يمكن عرض بيانات الإدارة بأمان.");
  const [snapshotState, setSnapshotState] = useState<"loading" | "ready" | "error">(() => firebase ? "loading" : "error");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [deliveryDrafts, setDeliveryDrafts] = useState<Record<string, string>>({});
  const [deliveryNotes, setDeliveryNotes] = useState<Record<string, string>>({});
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(() => emptyCategoryForm(1));
  const [serviceForm, setServiceForm] = useState<ServiceForm>(() => emptyServiceForm());
  const [isSaving, setIsSaving] = useState(false);
  const [walletReasons, setWalletReasons] = useState<Record<string, string>>({});
  const [walletAmounts, setWalletAmounts] = useState<Record<string, string>>({});
  const [walletSavingId, setWalletSavingId] = useState<string | null>(null);
  const [customerAction, setCustomerAction] = useState<{ id: string; kind: "block" | "unblock" | "delete" } | null>(null);
  const [customerActionReason, setCustomerActionReason] = useState("");
  const [customerActionSaving, setCustomerActionSaving] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [supportSavingId, setSupportSavingId] = useState<string | null>(null);
  const [mediaStatus, setMediaStatus] = useState<MediaStatus | null>(() => firebase ? null : { configured: false });
  const [imageUploading, setImageUploading] = useState(false);

  useEffect(() => {
    if (!firebase) return;
    return onAuthStateChanged(firebase.auth, async (user) => {
      if (!user) { setTickets([]); return; }
      try {
        const response = await fetch("/api/admin/support", { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
        const result = await response.json().catch(() => ({})) as { tickets?: SupportTicket[]; error?: string };
        if (!response.ok) throw new Error(result.error || "تعذر تحميل رسائل الدعم.");
        setTickets(result.tickets || []);
      } catch (reason) { setNotice(reason instanceof Error ? reason.message : "تعذر تحميل رسائل الدعم."); }
    });
  }, [firebase]);

  useEffect(() => {
    if (!firebase) return;
    return onAuthStateChanged(firebase.auth, async (user) => {
      if (!user) { setMediaStatus(null); return; }
      try {
        const response = await fetch("/api/admin/media/signature", { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
        const result = await response.json().catch(() => ({})) as MediaStatus & { error?: string };
        setMediaStatus(response.ok ? result : { configured: false });
      } catch { setMediaStatus({ configured: false }); }
    });
  }, [firebase]);

  useEffect(() => {
    let active = true;
    if (!firebase) return;

    const unsubscribe = onAuthStateChanged(firebase.auth, async (user) => {
      if (!user) {
        if (active) {
          setData(emptySnapshot());
          setSnapshotState("error");
          setNotice("انتهت جلسة الإدارة. سجّل الدخول من جديد.");
        }
        return;
      }

      try {
        if (active) setSnapshotState("loading");
        const response = await fetch("/api/admin/snapshot", { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
        const result = await response.json().catch(() => ({})) as { snapshot?: StoreSnapshot; error?: string };
        if (!response.ok || !result.snapshot) throw new Error(result.error || "تعذر تحميل بيانات CMC.");
        if (active) {
          setData(result.snapshot);
          setSnapshotState("ready");
          setNotice("تم تحميل بيانات CMC عبر جلسة الإدارة المحمية.");
        }
      } catch (reason) {
        if (active) {
          setData(emptySnapshot());
          setSnapshotState("error");
          setNotice(reason instanceof Error ? reason.message : "تعذر تحميل بيانات CMC.");
        }
      }
    });

    return () => { active = false; unsubscribe(); };
  }, [firebase]);

  const allOrders = useMemo<DisplayOrder[]>(() => data.orders, [data.orders]);
  const totalWallet = useMemo(() => data.customers.reduce((sum, item) => sum + walletBalance(item.walletMad), 0), [data.customers]);
  const processing = allOrders.filter((item) => item.status === "processing").length;
  const activeCategory = data.categories.find((item) => item.id === openFolder);
  const visibleOrders = selectedCustomerId ? allOrders.filter((order) => order.customerId === selectedCustomerId) : allOrders;
  const activeCategories = data.categories.filter((category) => category.isActive);
  const navItems: [Tab, string][] = isManager
    ? [["overview", "نظرة عامة"], ...(managerPermissions.orders ? [["orders", "الطلبات"] as [Tab, string]] : []), ...(managerPermissions.support ? [["support", "الدعم"] as [Tab, string]] : [])]
    : [["overview", "نظرة عامة"], ["orders", "الطلبات"], ["products", "المنتجات"], ["categories", "التصنيفات"], ["customers", "العملاء"], ["support", "الدعم"], ["team", "الفريق"], ["settings", "الإعدادات"]];
  const tabTitles: Record<Tab, string> = { overview: "نظرة عامة CMC", orders: "إدارة الطلبات", products: "مجلدات المنتجات", categories: "إدارة التصنيفات", customers: "العملاء والمحافظ", support: "رسائل الدعم", team: "إدارة الفريق", settings: "إعدادات المتجر" };

  async function adminRequest<T>(path: string, method: "GET" | "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
    const user = firebase?.auth.currentUser;
    if (!firebase || !user) throw new Error("سجّل الدخول بحساب مدير لإتمام هذا الإجراء.");

    const response = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({})) as { error?: string } & T;
    if (!response.ok) throw new Error(result.error || "تعذر حفظ التغيير.");
    return result;
  }

  async function uploadServiceImage(file: File) {
    if (!mediaStatus?.configured) throw new Error("خدمة رفع الصور غير متاحة حاليًا.");
    if (serviceForm.title.trim().length < 2) throw new Error("اكتب اسم الخدمة أولًا قبل رفع الصورة.");
    const user = firebase?.auth.currentUser;
    if (!user) throw new Error("سجّل الدخول بحساب مدير لرفع صورة الخدمة.");

    setImageUploading(true);
    try {
      const signed = await requestSignedMediaUpload(await user.getIdToken(), "/api/admin/media/signature", { serviceId: editor?.id, title: serviceForm.title.trim() });
      const asset = await uploadSignedMediaImage(file, signed, "chrigsm/catalog/", "رفع صورة الخدمة");
      setServiceForm((previous) => ({ ...previous, imageUrl: asset.imageUrl, imagePublicId: asset.imagePublicId }));
      setNotice("رُفعت صورة الخدمة. اضغط حفظ لتثبيت التغيير.");
    } finally { setImageUploading(false); }
  }

  async function patchOrder(orderId: string, payload: { status?: OrderStatus; deliveryCode?: string; deliveryNote?: string }) {
    const user = firebase?.auth.currentUser;
    if (!firebase || !user) return false;
    const response = await fetch(`/api/orders/${orderId}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify(payload) });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error || "تعذر حفظ تحديث الطلب.");
    return true;
  }

  async function updateOrder(orderId: string, status: OrderStatus) {
    const target = allOrders.find((order) => order.id === orderId);
    if (!target) return;
    const now = new Date().toISOString();
    const note = status === "processing" ? "بدأ فريق ChriGsm معالجة الطلب. بيانات العميل أصبحت مقفلة." : `غيّر فريق ChriGsm الحالة إلى «${statusLabels[status]}».`;
    try {
      await patchOrder(orderId, { status });
      setData((previous) => ({ ...previous, orders: previous.orders.map((order) => order.id === orderId ? { ...order, status, updatedAt: now, statusHistory: [...(order.statusHistory || []), { status, at: now, note }] } : order) }));
      setNotice(`تم تحديث الطلب ${orderId} إلى «${statusLabels[status]}».`);
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : "تعذر تحديث الطلب."); }
  }

  async function sendDelivery(orderId: string) {
    const target = allOrders.find((order) => order.id === orderId);
    const code = deliveryDrafts[orderId]?.trim();
    const deliveryNote = deliveryNotes[orderId]?.trim();
    if (!target || !code) { setNotice("أدخل كود التفعيل أو تفاصيل التسليم أولًا."); return; }
    const now = new Date().toISOString();
    const notification = { title: "تم إنجاز طلبك بنجاح", body: `تم تسليم ${data.services.find((service) => service.id === target.serviceId)?.title || "الخدمة"}. راجع كود التسليم في تفاصيل الطلب.`, createdAt: now, read: false };
    const history = { status: "completed" as const, at: now, note: "تم إرسال كود أو تفاصيل التسليم إلى حساب العميل." };
    try {
      await patchOrder(orderId, { deliveryCode: code, deliveryNote });
      setData((previous) => ({ ...previous, orders: previous.orders.map((order) => order.id === orderId ? { ...order, status: "completed", deliveryCode: code, deliveryNote, notification, updatedAt: now, statusHistory: [...(order.statusHistory || []), history] } : order) }));
      setNotice(`تم تسليم الطلب ${orderId} وإرسال إشعار إلى العميل.`);
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : "تعذر تسليم الطلب."); }
  }

  async function answerTicket(ticketId: string) {
    const reply = replyDrafts[ticketId]?.trim();
    if (!firebase) { setNotice("سجّل الدخول بحساب مدير للرد على الرسائل."); return; }
    if (!reply || reply.length < 4) { setNotice("اكتب ردًا واضحًا من 4 أحرف على الأقل قبل الحفظ."); return; }
    try {
      setSupportSavingId(ticketId);
      const result = await adminRequest<{ ticket: SupportTicket }>(`/api/admin/support/${ticketId}`, "PATCH", { reply });
      setTickets((previous) => previous.map((ticket) => ticket.id === ticketId ? result.ticket : ticket));
      setReplyDrafts((previous) => ({ ...previous, [ticketId]: "" }));
      setNotice("تم إرسال الرد وسيظهر للعميل في حسابه.");
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : "تعذر حفظ رد الدعم."); }
    finally { setSupportSavingId(null); }
  }

  async function adjustWallet(customerId: string, amountMad: number) {
    const reason = walletReasons[customerId]?.trim();
    if (!firebase) { setNotice("سجّل الدخول بحساب مدير لتعديل الرصيد."); return; }
    if (!reason || reason.length < 4) { setNotice("اكتب سببًا واضحًا من 4 أحرف على الأقل قبل تعديل الرصيد."); return; }

    try {
      setWalletSavingId(customerId);
      const result = await adminRequest<{ customer: { id: string; walletMad: number; lastActivity: string }; walletEntry: { amountMad: number } }>(`/api/admin/customers/${customerId}/wallet`, "POST", { amountMad, reason });
      setData((previous) => ({ ...previous, customers: previous.customers.map((customer) => customer.id === customerId ? { ...customer, walletMad: result.customer.walletMad, lastActivity: result.customer.lastActivity } : customer) }));
      setWalletReasons((previous) => ({ ...previous, [customerId]: "" }));
      setWalletAmounts((previous) => ({ ...previous, [customerId]: "" }));
      setNotice(`تم ${result.walletEntry.amountMad > 0 ? "إضافة" : "خصم"} ${formatMAD(Math.abs(result.walletEntry.amountMad))} من رصيد العميل.`);
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "تعذر تعديل رصيد العميل.");
    } finally {
      setWalletSavingId(null);
    }
  }

  function submitWalletAdjustment(customerId: string, operation: "credit" | "debit") {
    const rawValue = (walletAmounts[customerId] || "").trim().replace(",", ".");
    const amount = Number(rawValue);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
      setNotice("أدخل مبلغًا صحيحًا أكبر من صفر وفي حدود 1,000,000 د.م.");
      return;
    }
    const roundedAmount = Math.round(amount * 100) / 100;
    void adjustWallet(customerId, operation === "credit" ? roundedAmount : -roundedAmount);
  }

  async function submitCustomerAction() {
    if (!customerAction) return;
    const customer = data.customers.find((item) => item.id === customerAction.id);
    if (!customer) { setCustomerAction(null); return; }
    if (customerAction.kind === "block" && customerActionReason.trim().length < 4) {
      setNotice("اكتب سبب الحظر بوضوح قبل التنفيذ.");
      return;
    }
    if (customerAction.kind === "delete" && customerActionReason.trim() !== customer.fullName) {
      setNotice("اكتب الاسم الكامل للعميل كما يظهر للتأكيد.");
      return;
    }

    try {
      setCustomerActionSaving(true);
      if (customerAction.kind === "delete") {
        await adminRequest(`/api/admin/customers/${customer.id}`, "DELETE");
        setData((previous) => ({ ...previous, customers: previous.customers.filter((item) => item.id !== customer.id) }));
        if (selectedCustomerId === customer.id) setSelectedCustomerId(null);
        setNotice(`تم حذف حساب العميل «${customer.fullName}» وملفه الشخصي.`);
      } else {
        const result = await adminRequest<{ customer: Customer; message: string }>(`/api/admin/customers/${customer.id}`, "PATCH", { action: customerAction.kind, reason: customerActionReason.trim() });
        setData((previous) => ({ ...previous, customers: previous.customers.map((item) => item.id === result.customer.id ? result.customer : item) }));
        setNotice(result.message);
      }
      setCustomerAction(null);
      setCustomerActionReason("");
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "تعذر تنفيذ إجراء العميل.");
    } finally {
      setCustomerActionSaving(false);
    }
  }

  function openCategoryEditor(category?: Category) {
    if (!firebase) { setNotice("سجّل الدخول بحساب مدير لتعديل التصنيفات."); return; }
    if (category) {
      setCategoryForm({ name: category.name, icon: category.icon, color: category.color, description: category.description, order: String(category.order), isActive: category.isActive });
      setEditor({ kind: "category", mode: "edit", id: category.id });
    } else {
      setCategoryForm(emptyCategoryForm(data.categories.length + 1));
      setEditor({ kind: "category", mode: "create" });
    }
  }

  function openServiceEditor(categoryId?: string, service?: Service) {
    if (!firebase) { setNotice("سجّل الدخول بحساب مدير لتعديل الخدمات."); return; }
    if (service) {
      setServiceForm({ slug: service.slug, title: service.title, categoryId: service.categoryId, description: service.description, priceMad: String(service.priceMad), delivery: service.delivery, badge: service.badge || "", imageUrl: service.imageUrl || "", imagePublicId: service.imagePublicId || "", isActive: service.isActive, fields: Array.isArray(service.fields) ? service.fields : [] });
      setEditor({ kind: "service", mode: "edit", id: service.id });
    } else {
      setServiceForm(emptyServiceForm(categoryId || activeCategories[0]?.id));
      setEditor({ kind: "service", mode: "create" });
    }
  }

  async function saveEditor() {
    if (!editor) return;
    try {
      setIsSaving(true);
      if (editor.kind === "category") {
        const order = Number(categoryForm.order);
        if (!Number.isInteger(order) || order < 0) throw new Error("رتبة التصنيف يجب أن تكون رقمًا صحيحًا موجبًا أو صفرًا.");
        const payload = { ...categoryForm, name: categoryForm.name.trim(), icon: categoryForm.icon.trim(), color: categoryForm.color.trim(), description: categoryForm.description.trim(), order };
        if (editor.mode === "create") {
          const result = await adminRequest<{ category: Category }>("/api/admin/categories", "POST", payload);
          setData((previous) => ({ ...previous, categories: [...previous.categories, result.category].sort((left, right) => left.order - right.order) }));
          setNotice(`تمت إضافة التصنيف «${result.category.name}».`);
        } else {
          const result = await adminRequest<{ category: Category }>(`/api/admin/categories/${editor.id}`, "PATCH", payload);
          setData((previous) => ({ ...previous, categories: previous.categories.map((category) => category.id === result.category.id ? result.category : category).sort((left, right) => left.order - right.order) }));
          setNotice(`تم تعديل التصنيف «${result.category.name}».`);
        }
      } else {
        const priceMad = Number(serviceForm.priceMad);
        if (!Number.isFinite(priceMad) || priceMad < 0) throw new Error("أدخل سعرًا صالحًا بالدرهم المغربي.");
        const fields = normalizeDynamicFields(serviceForm.fields);
        const basePayload = { slug: serviceForm.slug.trim(), title: serviceForm.title.trim(), categoryId: serviceForm.categoryId, description: serviceForm.description.trim(), priceMad, delivery: serviceForm.delivery.trim(), imageUrl: serviceForm.imageUrl.trim() || undefined, imagePublicId: serviceForm.imagePublicId.trim() || undefined, isActive: serviceForm.isActive, fields };
        if (editor.mode === "create") {
          const result = await adminRequest<{ service: Service }>("/api/admin/services", "POST", { ...basePayload, badge: serviceForm.badge.trim() || undefined });
          setData((previous) => ({ ...previous, services: [...previous.services, result.service] }));
          setOpenFolder(result.service.categoryId);
          setNotice(`تمت إضافة الخدمة «${result.service.title}».`);
        } else {
          const result = await adminRequest<{ service: Service }>(`/api/admin/services/${editor.id}`, "PATCH", { ...basePayload, imageUrl: serviceForm.imageUrl.trim() || null, imagePublicId: serviceForm.imagePublicId.trim() || null, badge: serviceForm.badge.trim() || null });
          setData((previous) => ({ ...previous, services: previous.services.map((service) => service.id === result.service.id ? result.service : service) }));
          setNotice(`تم تعديل الخدمة «${result.service.title}».`);
        }
      }
      setEditor(null);
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "تعذر حفظ التغيير.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteCategory() {
    const category = data.categories.find((item) => item.id === deleteId);
    if (!category || typedName !== category.name) return;
    try {
      setIsSaving(true);
      const result = await adminRequest<{ deletedServiceCount: number }>(`/api/admin/categories/${category.id}`, "DELETE");
      setData((previous) => ({ ...previous, categories: previous.categories.filter((item) => item.id !== category.id), services: previous.services.filter((service) => service.categoryId !== category.id) }));
      setOpenFolder(null);
      setDeleteId(null);
      setTypedName("");
      setNotice(`تم حذف التصنيف «${category.name}» وخدماته (${result.deletedServiceCount}).`);
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "تعذر حذف التصنيف.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteService(service: Service) {
    if (!window.confirm(`حذف الخدمة «${service.title}»؟ لا يمكن حذف خدمة مرتبطة بطلبات.`)) return;
    try {
      setIsSaving(true);
      await adminRequest(`/api/admin/services/${service.id}`, "DELETE");
      setData((previous) => ({ ...previous, services: previous.services.filter((item) => item.id !== service.id) }));
      setNotice(`تم حذف الخدمة «${service.title}».`);
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "تعذر حذف الخدمة.");
    } finally {
      setIsSaving(false);
    }
  }

  if (snapshotState === "loading") return <div className="access-state"><span className="brand-mark">CG</span><p>جارٍ تحميل بيانات CMC المحمية...</p></div>;
  if (snapshotState === "error") return <div className="access-state"><span className="access-icon"><ShieldAlert size={30}/></span><p className="eyebrow">تعذر فتح CMC</p><h1>لا يمكن تحميل بيانات الإدارة الآن</h1><p>{notice}</p><button type="button" className="primary-button" onClick={() => window.location.reload()}>إعادة المحاولة</button></div>;

  return <div className="admin-console"><aside className="cmc-sidebar"><div className="cmc-title">ChriGsm <b>CMC</b></div><nav>{navItems.map(([id, label]) => <button className={tab === id ? "active" : ""} onClick={() => setTab(id)} key={id}>{label}</button>)}</nav><div className="cmc-summary"><b>لوحة الإدارة</b><span>أدر الطلبات والخدمات والعملاء من مكان واحد</span></div></aside><section className="cmc-content"><header className="cmc-heading"><div><p className="eyebrow">إدارة العمليات</p><h1>{tabTitles[tab]}</h1></div><span className="live-pill"><span/> إدارة المتجر</span></header><p className="admin-notice">{notice}</p><AdminOnboardingTour role={isManager ? "manager" : "admin"}/>
    {tab === "overview" && <><div className="metric-grid"><Metric icon={<UsersRound/>} label="عملاء نشطون" value={String(data.customers.length)} note="حسابات مسجلة"/><Metric icon={<Boxes/>} label="طلبات جديدة" value={String(allOrders.filter((item) => item.status === "new").length)} note="تصل من المتجر"/><Metric icon={<FolderTree/>} label="قيد المعالجة" value={String(processing)} note="بيانات مقفلة للعميل"/><Metric icon={<CreditCard/>} label="إجمالي الأرصدة" value={formatMAD(totalWallet)} note="محافظ العملاء"/></div><section className="cmc-card"><h2>آخر الطلبات</h2><OrderGrid orders={allOrders} data={data} onStatus={updateOrder} deliveryDrafts={deliveryDrafts} deliveryNotes={deliveryNotes} onDeliveryDraft={setDeliveryDrafts} onDeliveryNote={setDeliveryNotes} onSendDelivery={sendDelivery}/></section></>}
    {tab === "orders" && <section className="cmc-card"><div className="section-title"><div><p className="eyebrow">بيانات وتسليم واضح</p><h2>طلبات الخدمات</h2></div>{selectedCustomerId ? <button className="filter-button" onClick={() => setSelectedCustomerId(null)}>كل العملاء</button> : <span className="muted-text">يصل إشعار داخل الحساب عند الإكمال</span>}</div><OrderGrid orders={visibleOrders} data={data} onStatus={updateOrder} deliveryDrafts={deliveryDrafts} deliveryNotes={deliveryNotes} onDeliveryDraft={setDeliveryDrafts} onDeliveryNote={setDeliveryNotes} onSendDelivery={sendDelivery}/></section>}
    {tab === "products" && <section className="cmc-card"><div className="section-title"><div><p className="eyebrow">إدارة الكتالوج</p><h2>{activeCategory ? activeCategory.name : "مجلدات المنتجات"}</h2></div>{activeCategory && <button className="filter-button" onClick={() => setOpenFolder(null)}>رجوع للمجلدات</button>}</div>{!activeCategory ? <div className="folder-grid">{data.categories.map((category) => <article className="folder-card" key={category.id} style={{ "--folder-color": category.color } as CSSProperties}><button className="folder-open" onClick={() => setOpenFolder(category.id)}><span className="folder-icon">{category.icon.slice(0, 1)}</span><span><b>{category.name}</b><small>{data.services.filter((item) => item.categoryId === category.id).length} خدمات</small></span></button></article>)}</div> : <div className="product-list">{data.services.filter((item) => item.categoryId === activeCategory.id).map((service) => <article className="product-row" key={service.id}>{service.imageUrl ? <Image className="service-image" src={service.imageUrl} alt="" width={72} height={72} sizes="72px"/> : <span className="service-glyph">{service.title.slice(0, 2)}</span>}<div><h3>{service.title}</h3><p>{service.description}</p></div><strong>{formatMAD(service.priceMad)}</strong><div className="row-actions"><button className="filter-button" onClick={() => openServiceEditor(undefined, service)}><Pencil size={14}/> تعديل</button><button className="danger-button" onClick={() => deleteService(service)} disabled={isSaving}><Trash2 size={14}/> حذف</button></div></article>)}<button className="primary-button" onClick={() => openServiceEditor(activeCategory.id)} disabled={!firebase || isSaving}><Plus size={16}/> إضافة خدمة</button></div>}</section>}
    {tab === "categories" && <section className="cmc-card"><div className="section-title"><div><p className="eyebrow">تنظيم الكتالوج</p><h2>التصنيفات والأيقونات</h2></div><button className="primary-button small" onClick={() => openCategoryEditor()} disabled={!firebase || isSaving}><Plus size={15}/> إضافة تصنيف</button></div><div className="category-admin-list">{data.categories.map((category) => <article key={category.id} className="category-admin-row"><span className="folder-icon" style={{ "--folder-color": category.color } as CSSProperties}>{category.icon.slice(0, 1)}</span><div><h3>{category.name}</h3><p>{category.description || "من دون وصف"} · أيقونة: {category.icon}</p></div><span className="muted-text">{data.services.filter((item) => item.categoryId === category.id).length} خدمات</span><div className="row-actions"><button className="filter-button" onClick={() => openCategoryEditor(category)} disabled={!firebase || isSaving}><Pencil size={14}/> تعديل</button><button className="danger-button" onClick={() => setDeleteId(category.id)} disabled={!firebase || isSaving}><Trash2 size={15}/> حذف</button></div></article>)}</div></section>}
    {tab === "customers" && <section className="cmc-card"><div className="section-title"><div><p className="eyebrow">إدارة الأرصدة والحسابات</p><h2>العملاء</h2></div><span className="muted-text">إجراءات الحظر والحذف تُسجّل وتحتاج تأكيدًا</span></div><div className="customer-grid">{data.customers.map((customer) => { const isBlocked = customer.accountStatus === "blocked"; return <article className={`customer-card large${isBlocked ? " blocked" : ""}`} key={customer.id}><span className="avatar">{customer.avatarUrl ? <Image src={customer.avatarUrl} alt={`صورة ${customer.fullName}`} width={38} height={38} sizes="38px"/> : <UserRound size={19} aria-label="صورة افتراضية"/>}</span><div><h3>{customer.fullName}</h3><p>{customer.phone || customer.email}</p><strong>رصيد {formatMAD(walletBalance(customer.walletMad))} · {allOrders.filter((order) => order.customerId === customer.id).length} طلبات</strong><span className={`customer-status ${isBlocked ? "blocked" : "active"}`}>{isBlocked ? <><Ban size={12}/> محظور</> : <><ShieldCheck size={12}/> نشط</>}</span>{isBlocked && customer.blockedReason && <p className="customer-reason">سبب الحظر: {customer.blockedReason}</p>}</div><div className="wallet-actions"><input type="number" inputMode="decimal" min="0.01" max="1000000" step="0.01" aria-label={`مبلغ تعديل رصيد ${customer.fullName}`} value={walletAmounts[customer.id] || ""} onChange={(event) => setWalletAmounts((previous) => ({ ...previous, [customer.id]: event.target.value }))} placeholder="المبلغ (د.م.)" disabled={!firebase || walletSavingId === customer.id || customerActionSaving}/><input aria-label={`سبب تعديل رصيد ${customer.fullName}`} value={walletReasons[customer.id] || ""} onChange={(event) => setWalletReasons((previous) => ({ ...previous, [customer.id]: event.target.value }))} placeholder="سبب التعديل (مطلوب)" disabled={!firebase || walletSavingId === customer.id || customerActionSaving}/><div><button className="wallet-credit" onClick={() => submitWalletAdjustment(customer.id, "credit")} disabled={!firebase || walletSavingId === customer.id || customerActionSaving}>إضافة رصيد</button><button className="wallet-debit" onClick={() => submitWalletAdjustment(customer.id, "debit")} disabled={!firebase || walletSavingId === customer.id || customerActionSaving}>خصم رصيد</button><button onClick={() => { setSelectedCustomerId(customer.id); setTab("orders"); }} disabled={walletSavingId === customer.id || customerActionSaving}>طلبات</button></div><div className="customer-actions"><button className="filter-button" onClick={() => { setCustomerAction({ id: customer.id, kind: isBlocked ? "unblock" : "block" }); setCustomerActionReason(""); }} disabled={!firebase || customerActionSaving}>{isBlocked ? <><ShieldCheck size={14}/> إلغاء الحظر</> : <><Ban size={14}/> حظر الحساب</>}</button><button className="danger-button" onClick={() => { setCustomerAction({ id: customer.id, kind: "delete" }); setCustomerActionReason(""); }} disabled={!firebase || customerActionSaving}><UserX size={14}/> حذف الحساب</button></div></div></article>; })}</div></section>}
    {tab === "team" && !isManager && <TeamManagement onNotice={setNotice}/>}
    {tab === "support" && <section className="cmc-card"><div className="section-title"><div><p className="eyebrow">رسائل العملاء المحفوظة</p><h2>الدعم</h2></div><span className="muted-text">{tickets.length} رسائل</span></div>{tickets.length ? <div className="admin-ticket-list">{tickets.map((ticket) => { const ticketCustomer = data.customers.find((customer) => customer.id === ticket.customerId); return <article key={ticket.id}><MessageCircle size={20}/><div><b>{ticket.subject}</b><p>{ticket.message}</p><small>{ticketCustomer?.fullName || ticket.customerId} · {ticket.createdAt.slice(0, 10)}</small>{ticket.reply && <div className="ticket-reply"><b>رد CMC</b><p>{ticket.reply.message}</p></div>}</div><div><span className={`status-pill ${ticket.status === "open" ? "amber" : "green"}`}>{ticket.status === "open" ? "مفتوح" : "تم الرد"}</span>{ticket.status === "open" && <div className="support-reply-draft"><textarea value={replyDrafts[ticket.id] || ""} onChange={(event) => setReplyDrafts((previous) => ({ ...previous, [ticket.id]: event.target.value }))} placeholder="اكتب ردًا يظهر للعميل" disabled={!firebase || supportSavingId === ticket.id}/><button className="filter-button" onClick={() => answerTicket(ticket.id)} disabled={!firebase || supportSavingId === ticket.id}><Send size={14}/> {supportSavingId === ticket.id ? "جارٍ الحفظ..." : "إرسال الرد"}</button></div>}</div></article>; })}</div> : <div className="empty-state"><MessageCircle size={24}/><h2>لا توجد رسائل دعم محفوظة</h2><p>ستظهر رسائل العملاء هنا فور إرسالها من حساباتهم.</p></div>}</section>}
    {tab === "settings" && <section className="cmc-card"><div className="section-title"><div><p className="eyebrow">إعدادات المتجر</p><h2>إعدادات المتجر والإدارة</h2></div><Settings2 size={22}/></div><AdminSessionControls/><div className="admin-settings-grid"><article><p>اسم المتجر</p><strong>ChriGsm</strong><small>يظهر في الرأس ورسائل الحساب</small></article><article><p>عملة المتجر</p><strong>الدرهم المغربي (د.م.)</strong><small>معتمدة في الأسعار والمحافظ</small></article></div></section>}
  </section>{deleteId && <div className="dialog-backdrop"><div className="confirm-dialog"><p className="eyebrow">حذف متسلسل</p><h2>حذف التصنيف وخدماته؟</h2><p>سيُحذف التصنيف «{data.categories.find((item) => item.id === deleteId)?.name}» وجميع خدماته التابعة غير المرتبطة بطلبات. اكتب اسم التصنيف للتأكيد.</p><input autoFocus value={typedName} onChange={(event) => setTypedName(event.target.value)} placeholder="اسم التصنيف"/><div><button className="filter-button" onClick={() => { setDeleteId(null); setTypedName(""); }} disabled={isSaving}>إلغاء</button><button className="danger-button" disabled={isSaving || typedName !== data.categories.find((item) => item.id === deleteId)?.name} onClick={deleteCategory}>تأكيد الحذف</button></div></div></div>}{customerAction && <div className="dialog-backdrop"><div className="confirm-dialog customer-action-dialog"><p className="eyebrow">إدارة حساب العميل</p><h2>{customerAction.kind === "block" ? "حظر حساب العميل؟" : customerAction.kind === "unblock" ? "إلغاء حظر العميل؟" : "حذف حساب العميل نهائيًا؟"}</h2><p>{customerAction.kind === "block" ? "سيُمنع العميل من تسجيل الدخول وستُلغى جلساته الحالية فورًا. اكتب سبب الحظر ليُسجَّل في سجل الإدارة." : customerAction.kind === "unblock" ? "سيستطيع العميل تسجيل الدخول من جديد بعد إلغاء الحظر." : "سيُحذف حساب الدخول وملف العميل ورسائل الدعم وسجل الرصيد، بشرط ألّا يكون لديه طلبات أو رصيد. اكتب الاسم الكامل للعميل للتأكيد."}</p>{customerAction.kind === "block" && <textarea autoFocus value={customerActionReason} onChange={(event) => setCustomerActionReason(event.target.value)} placeholder="سبب الحظر (مطلوب)" disabled={customerActionSaving}/>} {customerAction.kind === "delete" && <input autoFocus value={customerActionReason} onChange={(event) => setCustomerActionReason(event.target.value)} placeholder={data.customers.find((item) => item.id === customerAction.id)?.fullName || "الاسم الكامل"} disabled={customerActionSaving}/>}<div><button className="filter-button" onClick={() => { setCustomerAction(null); setCustomerActionReason(""); }} disabled={customerActionSaving}>إلغاء</button><button className="danger-button" onClick={() => { void submitCustomerAction(); }} disabled={customerActionSaving || (customerAction.kind === "block" && customerActionReason.trim().length < 4) || (customerAction.kind === "delete" && customerActionReason.trim() !== data.customers.find((item) => item.id === customerAction.id)?.fullName)}>{customerActionSaving ? "جارٍ التنفيذ..." : customerAction.kind === "delete" ? "تأكيد الحذف" : customerAction.kind === "block" ? "حظر وإغلاق الجلسات" : "تأكيد إلغاء الحظر"}</button></div></div></div>}{editor && <EditorDialog editor={editor} categoryForm={categoryForm} serviceForm={serviceForm} categories={activeCategories} existingService={editor.id ? data.services.find((service) => service.id === editor.id) : undefined} saving={isSaving} mediaStatus={mediaStatus} imageUploading={imageUploading} onUploadImage={async (file) => { try { await uploadServiceImage(file); } catch (reason) { setNotice(reason instanceof Error ? reason.message : "تعذر رفع الصورة."); } }} onRemoveImage={() => setServiceForm((previous) => ({ ...previous, imageUrl: "", imagePublicId: "" }))} onClose={() => setEditor(null)} onSave={saveEditor} onCategoryChange={setCategoryForm} onServiceChange={setServiceForm}/>}</div>;
}

function EditorDialog({ editor, categoryForm, serviceForm, categories, existingService, saving, mediaStatus, imageUploading, onUploadImage, onRemoveImage, onClose, onSave, onCategoryChange, onServiceChange }: { editor: Exclude<Editor, null>; categoryForm: CategoryForm; serviceForm: ServiceForm; categories: Category[]; existingService?: Service; saving: boolean; mediaStatus: MediaStatus | null; imageUploading: boolean; onUploadImage: (file: File) => Promise<void>; onRemoveImage: () => void; onClose: () => void; onSave: () => void; onCategoryChange: React.Dispatch<React.SetStateAction<CategoryForm>>; onServiceChange: React.Dispatch<React.SetStateAction<ServiceForm>> }) {
  const isCategory = editor.kind === "category";
  const title = `${editor.mode === "create" ? "إضافة" : "تعديل"} ${isCategory ? "تصنيف" : "خدمة"}`;
  return <div className="dialog-backdrop"><div className="confirm-dialog editor-dialog"><p className="eyebrow">إدارة الكتالوج</p><h2>{title}</h2>{isCategory ? <div className="editor-grid"><FormField label="اسم التصنيف"><input value={categoryForm.name} onChange={(event) => onCategoryChange((previous) => ({ ...previous, name: event.target.value }))} placeholder="مثل خدمات Server"/></FormField><FormField label="الأيقونة أو الرابط"><input value={categoryForm.icon} onChange={(event) => onCategoryChange((previous) => ({ ...previous, icon: event.target.value }))} placeholder="Folder أو رابط أيقونة"/></FormField><FormField label="اللون"><input type="color" value={categoryForm.color} onChange={(event) => onCategoryChange((previous) => ({ ...previous, color: event.target.value }))}/></FormField><FormField label="الترتيب"><input type="number" min="0" value={categoryForm.order} onChange={(event) => onCategoryChange((previous) => ({ ...previous, order: event.target.value }))}/></FormField><FormField label="الوصف" wide><textarea value={categoryForm.description} onChange={(event) => onCategoryChange((previous) => ({ ...previous, description: event.target.value }))} placeholder="وصف قصير يظهر للعملاء"/></FormField><Toggle checked={categoryForm.isActive} onChange={(isActive) => onCategoryChange((previous) => ({ ...previous, isActive }))} label="تصنيف نشط"/></div> : <div className="editor-grid"><FormField label="اسم الخدمة" wide><input value={serviceForm.title} onChange={(event) => onServiceChange((previous) => ({ ...previous, title: event.target.value }))} placeholder="مثل TSL Tool Activation"/></FormField><FormField label="رابط الخدمة"><input dir="ltr" value={serviceForm.slug} onChange={(event) => onServiceChange((previous) => ({ ...previous, slug: event.target.value.toLowerCase().replace(/\s+/g, "-") }))} placeholder="tsl-tool-activation"/></FormField><FormField label="التصنيف"><select value={serviceForm.categoryId} onChange={(event) => onServiceChange((previous) => ({ ...previous, categoryId: event.target.value }))}><option value="">اختر التصنيف</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></FormField><FormField label="السعر (د.م.)"><input type="number" min="0" step="0.01" value={serviceForm.priceMad} onChange={(event) => onServiceChange((previous) => ({ ...previous, priceMad: event.target.value }))} placeholder="0"/></FormField><FormField label="التسليم"><input value={serviceForm.delivery} onChange={(event) => onServiceChange((previous) => ({ ...previous, delivery: event.target.value }))} placeholder="مثال: فوري بعد المعالجة"/></FormField><FormField label="شارة اختيارية"><input value={serviceForm.badge} onChange={(event) => onServiceChange((previous) => ({ ...previous, badge: event.target.value }))} placeholder="مثل الأكثر طلبًا"/></FormField>{mediaStatus?.configured ? <MediaImageControl imageUrl={serviceForm.imageUrl || undefined} alt={`صورة ${serviceForm.title || "الخدمة"}`} fallbackLabel={serviceForm.title || "خد"} kind="service" disabled={saving} uploading={imageUploading} onSelect={(file) => { void onUploadImage(file); }} onRemove={onRemoveImage}/> : <p className="editor-hint">رفع الصور غير متاح حاليًا.</p>}<FormField label="الوصف" wide><textarea value={serviceForm.description} onChange={(event) => onServiceChange((previous) => ({ ...previous, description: event.target.value }))} placeholder="وصف واضح للخدمة"/></FormField><Toggle checked={serviceForm.isActive} onChange={(isActive) => onServiceChange((previous) => ({ ...previous, isActive }))} label="إتاحة الخدمة للعملاء"/><DynamicFieldsEditor fields={serviceForm.fields} onChange={(fields) => onServiceChange((previous) => ({ ...previous, fields }))} disabled={saving}/>{existingService && <p className="editor-hint">تم تحميل {existingService.fields.length} حقل مرتبط بالخدمة. عدّله ثم احفظ لتحديث نموذج الطلب.</p>}</div>}<div><button className="filter-button" onClick={onClose} disabled={saving}>إلغاء</button><button className="primary-button" onClick={onSave} disabled={saving || (!isCategory && categories.length === 0)}>{saving ? "جارٍ الحفظ..." : "حفظ التغييرات"}</button></div></div></div>;
}

function DynamicFieldsEditor({ fields, onChange, disabled }: { fields: DynamicField[]; onChange: (fields: DynamicField[]) => void; disabled: boolean }) {
  function addField() {
    const existing = new Set(fields.map((field) => field.id.toLowerCase()));
    let number = fields.length + 1;
    while (existing.has(`field-${number}`)) number += 1;
    onChange([...fields, { id: `field-${number}`, label: "", type: "text", required: true, placeholder: "" }]);
  }

  function updateField(index: number, update: (field: DynamicField) => DynamicField) {
    onChange(fields.map((field, fieldIndex) => fieldIndex === index ? update(field) : field));
  }

  return <section className="dynamic-fields-editor"><div className="dynamic-fields-header"><div><span className="eyebrow">نموذج الطلب</span><h3>الحقول المطلوبة من العميل</h3><p>أضف فقط البيانات اللازمة لتنفيذ هذه الخدمة. يراجع الخادم كل حقل قبل الحفظ والطلب.</p></div><button className="filter-button" type="button" onClick={addField} disabled={disabled || fields.length >= 20}><Plus size={14}/> إضافة حقل</button></div>{fields.length === 0 ? <div className="dynamic-fields-empty"><b>لا توجد حقول مخصصة بعد.</b><span>سيطلب المتجر البريد الإلكتروني افتراضيًا إلى أن تضيف حقولًا خاصة بهذه الخدمة.</span></div> : <div className="dynamic-fields-list">{fields.map((field, index) => <article className="dynamic-field-card" key={`${field.id}-${index}`}><div className="dynamic-field-title"><b>حقل {index + 1}</b><button className="danger-button" type="button" onClick={() => onChange(fields.filter((_, fieldIndex) => fieldIndex !== index))} disabled={disabled}><Trash2 size={14}/> إزالة</button></div><div className="dynamic-field-grid"><label><span>المعرف الداخلي</span><input dir="ltr" value={field.id} onChange={(event) => updateField(index, (current) => ({ ...current, id: event.target.value }))} placeholder="username" disabled={disabled}/></label><label><span>اسم الحقل للعميل</span><input value={field.label} onChange={(event) => updateField(index, (current) => ({ ...current, label: event.target.value }))} placeholder="مثل اسم مستخدم UnlockTool.net" disabled={disabled}/></label><label><span>نوع الإدخال</span><select value={field.type} onChange={(event) => { const type = event.target.value as DynamicField["type"]; updateField(index, (current) => ({ ...current, type, ...(type === "select" ? { options: current.options?.length ? current.options : [""] } : { options: undefined }) })); }} disabled={disabled}>{dynamicFieldTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label><label><span>نص مساعد</span><input value={field.placeholder || ""} onChange={(event) => updateField(index, (current) => ({ ...current, placeholder: event.target.value }))} placeholder="مثال أو توضيح قصير" disabled={disabled}/></label><Toggle checked={field.required} onChange={(required) => updateField(index, (current) => ({ ...current, required }))} label="حقل مطلوب"/>{field.type === "select" && <label className="dynamic-options"><span>خيارات القائمة</span><textarea value={(field.options || []).join("\n")} onChange={(event) => updateField(index, (current) => ({ ...current, options: event.target.value.split("\n") }))} placeholder={"تفعيل جديد\nتجديد"} disabled={disabled}/><small>اكتب كل خيار في سطر مستقل.</small></label>}</div></article>)}</div>}</section>;
}

function FormField({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) { return <label className={`editor-field${wide ? " wide" : ""}`}><span>{label}</span>{children}</label>; }
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) { return <label className="editor-toggle"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)}/><span>{label}</span></label>; }
function Metric({ icon, label, value, note }: { icon: ReactNode; label: string; value: string; note: string }) { return <article className="metric-card"><span>{icon}</span><p>{label}</p><strong>{value}</strong><small>{note}</small></article>; }
function OrderGrid({ orders, data, onStatus, deliveryDrafts, deliveryNotes, onDeliveryDraft, onDeliveryNote, onSendDelivery }: { orders: DisplayOrder[]; data: StoreSnapshot; onStatus: (id: string, status: OrderStatus) => void; deliveryDrafts: Record<string, string>; deliveryNotes: Record<string, string>; onDeliveryDraft: React.Dispatch<React.SetStateAction<Record<string, string>>>; onDeliveryNote: React.Dispatch<React.SetStateAction<Record<string, string>>>; onSendDelivery: (id: string) => void }) { return <div className="cmc-order-grid">{orders.map((order) => { const customer = data.customers.find((item) => item.id === order.customerId); const service = data.services.find((item) => item.id === order.serviceId); const history = order.statusHistory?.length ? order.statusHistory : [{ status: order.status, at: order.updatedAt, note: `الحالة الحالية: ${statusLabels[order.status]}` }]; return <article className="cmc-order-card detailed-cmc-order" key={order.id}><div className="order-card-top"><span className={`status-pill ${orderTone(order.status)}`}>{statusLabels[order.status]}</span><span>{order.id}</span></div><h3>{service?.title || "خدمة رقمية"}</h3><p>{customer?.fullName || "عميل"} · {customer?.phone || "—"}</p><strong>{formatMAD(order.totalMad)}</strong><details className="cmc-order-details"><summary>البيانات المرسلة وسجل الطلب</summary><div><b>بيانات العميل</b><p>{customer?.email || "—"}</p></div><div><b>الحقول المرسلة</b>{Object.entries(order.formData).map(([key, value]) => <p key={key}><span>{fieldLabels[key] || key}</span>{value}</p>)}</div><div><b>سجل الحالة</b>{history.map((event, index) => <p key={`${event.at}-${index}`}><span className={`status-pill ${orderTone(event.status)}`}>{statusLabels[event.status]}</span>{event.note}</p>)}</div></details><select value={order.status} onChange={(event) => onStatus(order.id, event.target.value as OrderStatus)}>{statusOptions.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select>{order.status !== "completed" && <div className="delivery-box"><input value={deliveryDrafts[order.id] || ""} onChange={(event) => onDeliveryDraft((previous) => ({ ...previous, [order.id]: event.target.value }))} placeholder="كود التفعيل أو تفاصيل التسليم"/><textarea value={deliveryNotes[order.id] || ""} onChange={(event) => onDeliveryNote((previous) => ({ ...previous, [order.id]: event.target.value }))} placeholder="ملاحظة تظهر للعميل (اختياري)"/><button type="button" onClick={() => onSendDelivery(order.id)}>تسليم وإشعار العميل</button></div>}{order.deliveryCode && <code>{order.deliveryCode}</code>}</article>; })}</div>; }

function TeamManagement({ onNotice }: { onNotice: (message: string) => void }) {
  const firebase = useMemo(() => firebaseServices(), []);
  const [managers, setManagers] = useState<Customer[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", temporaryPassword: "", orders: true, support: true });

  const request = useCallback(async <T,>(path: string, method: "GET" | "POST" | "PATCH", body?: unknown) => {
    const user = firebase?.auth.currentUser;
    if (!user) throw new Error("سجّل الدخول بحساب المالك أولًا.");
    const response = await fetch(path, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: body === undefined ? undefined : JSON.stringify(body) });
    const result = await response.json().catch(() => ({})) as { error?: string } & T;
    if (!response.ok) throw new Error(result.error || "تعذر تنفيذ العملية.");
    return result;
  }, [firebase]);

  useEffect(() => {
    let cancelled = false;
    void request<{ managers: Customer[] }>("/api/admin/team", "GET").then((result) => { if (!cancelled) setManagers(result.managers || []); }).catch((reason) => { if (!cancelled) onNotice(reason instanceof Error ? reason.message : "تعذر تحميل الفريق."); });
    return () => { cancelled = true; };
  }, [onNotice, request]);

  async function createManager(event: React.FormEvent) {
    event.preventDefault();
    if (form.temporaryPassword.length < 8) { onNotice("كلمة المرور المؤقتة يجب أن تكون من 8 أحرف على الأقل."); return; }
    try {
      setBusy(true);
      const result = await request<{ manager: Customer }>("/api/admin/team", "POST", form);
      setManagers((previous) => [result.manager, ...previous]);
      setForm({ fullName: "", email: "", phone: "", temporaryPassword: "", orders: true, support: true });
      onNotice("تم إنشاء المشرف. سلّمه كلمة المرور المؤقتة عبر قناة آمنة واطلب منه تغييرها.");
    } catch (reason) { onNotice(reason instanceof Error ? reason.message : "تعذر إنشاء المشرف."); }
    finally { setBusy(false); }
  }

  async function toggleManager(manager: Customer) {
    try {
      setBusy(true);
      await request("/api/admin/team", "PATCH", { uid: manager.id, disabled: manager.accountStatus !== "blocked" });
      setManagers((previous) => previous.map((item) => item.id === manager.id ? { ...item, accountStatus: item.accountStatus === "blocked" ? "active" : "blocked" } : item));
      onNotice(manager.accountStatus === "blocked" ? "تمت إعادة تفعيل المشرف." : "تم تعطيل دخول المشرف.");
    } catch (reason) { onNotice(reason instanceof Error ? reason.message : "تعذر تحديث حالة المشرف."); }
    finally { setBusy(false); }
  }

  return <section className="cmc-card team-management"><div className="section-title"><div><p className="eyebrow">صلاحية المالك فقط</p><h2>فريق ChriGsm</h2></div><span className="muted-text">المشرف يرى الطلبات والدعم ولا يرى المحافظ أو الكتالوج</span></div><form className="team-create-form" onSubmit={createManager}><input required value={form.fullName} onChange={(event) => setForm((previous) => ({ ...previous, fullName: event.target.value }))} placeholder="الاسم الكامل"/><input required type="email" dir="ltr" value={form.email} onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))} placeholder="manager@example.com"/><input value={form.phone} onChange={(event) => setForm((previous) => ({ ...previous, phone: event.target.value }))} placeholder="رقم واتساب (اختياري)"/><input required type="password" dir="ltr" minLength={8} value={form.temporaryPassword} onChange={(event) => setForm((previous) => ({ ...previous, temporaryPassword: event.target.value }))} placeholder="كلمة مرور مؤقتة (8+)"/><label className="permission-toggle"><input type="checkbox" checked={form.orders} onChange={(event) => setForm((previous) => ({ ...previous, orders: event.target.checked }))}/> الطلبات</label><label className="permission-toggle"><input type="checkbox" checked={form.support} onChange={(event) => setForm((previous) => ({ ...previous, support: event.target.checked }))}/> الدعم</label><button className="primary-button" type="submit" disabled={busy}>{busy ? "جارٍ الحفظ..." : "إضافة مشرف"}</button></form><div className="team-list">{managers.length ? managers.map((manager) => <article className="team-row" key={manager.id}><span className="avatar"><UserRound size={18}/></span><div><h3>{manager.fullName}</h3><p>{manager.email} {manager.phone ? `· ${manager.phone}` : ""}</p><small>{manager.managerPermissions?.orders ? "الطلبات" : "بدون طلبات"} · {manager.managerPermissions?.support ? "الدعم" : "بدون دعم"}</small></div><span className={`customer-status ${manager.accountStatus === "blocked" ? "blocked" : "active"}`}>{manager.accountStatus === "blocked" ? "معطل" : "نشط"}</span><button className="filter-button" type="button" onClick={() => { void toggleManager(manager); }} disabled={busy}>{manager.accountStatus === "blocked" ? "تفعيل" : "تعطيل"}</button></article>) : <div className="empty-state"><UsersRound size={24}/><h2>لا يوجد مشرفون بعد</h2><p>أنشئ أول حساب محدود من النموذج أعلاه.</p></div>}</div></section>;
}

function AdminOnboardingTour({ role }: { role: "admin" | "manager" }) {
  const [visible, setVisible] = useState(() => typeof window !== "undefined" && window.localStorage.getItem(`chrigsm:cmc-tour:${role}`) !== "1");
  const [step, setStep] = useState(0);
  const steps = role === "manager"
    ? [{ title: "مرحبًا بك في CMC", body: "هذه المساحة مخصصة لمعالجة الطلبات والرد على العملاء. لا يمكنك تعديل الأسعار أو المحافظ." }, { title: "تابع الطلبات", body: "غيّر الحالة بعد مراجعة بيانات العميل، ثم أرسل كود التفعيل أو ملاحظة التسليم." }, { title: "أجب على الدعم", body: "كل رد تحفظه يظهر للعميل داخل حسابه، وتبقى العملية مسجلة باسم حسابك." }]
    : [{ title: "ابدأ من النظرة العامة", body: "راجع الطلبات الجديدة، المعالجة، وأرصدة العملاء من شاشة واحدة." }, { title: "أدر الكتالوج", body: "من المنتجات والتصنيفات يمكنك إضافة الخدمات وصورها وأسعارها الحقيقية." }, { title: "أدر الفريق بأمان", body: "أنشئ مشرفين بصلاحيات الطلبات والدعم فقط، وتابع حالتهم من تبويب الفريق." }];

  function close() {
    window.localStorage.setItem(`chrigsm:cmc-tour:${role}`, "1");
    setVisible(false);
  }
  if (!visible) return null;
  const current = steps[step];
  return <div className="cmc-tour-backdrop" role="dialog" aria-modal="true" aria-labelledby="cmc-tour-title"><div className="cmc-tour"><div className="cmc-tour-progress"><span>{step + 1} / {steps.length}</span><button type="button" onClick={close}>تخطي الجولة</button></div><span className="tour-kicker">دليل CMC</span><h2 id="cmc-tour-title">{current.title}</h2><p>{current.body}</p><div className="cmc-tour-actions"><button className="filter-button" type="button" onClick={close}>لاحقًا</button>{step < steps.length - 1 ? <button className="primary-button" type="button" onClick={() => setStep((value) => value + 1)}>التالي</button> : <button className="primary-button" type="button" onClick={close}>فهمت، ابدأ</button>}</div></div></div>;
}
