"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { Archive, ArchiveRestore, Ban, Banknote, Boxes, CheckCircle2, CircleOff, Clock3, CreditCard, FolderTree, Landmark, LayoutDashboard, ListChecks, Menu, MessageCircle, Package2, Pencil, Plus, Send, Settings2, ShieldAlert, ShieldCheck, Trash2, UserRound, UserX, UsersRound, X } from "lucide-react";
import type { Category, Customer, DynamicField, StoreSnapshot, Order, OrderStatus, PaymentMethod, PaymentRecord, Service, SupportTicket } from "@/lib/types";
import { formatMAD, statusLabels } from "@/lib/types";
import { firebaseServices } from "@/lib/firebase/client";
import { AdminSessionControls } from "@/components/admin-session-controls";
import { getAuthSession } from "@/lib/auth";
import { MediaImageControl } from "@/components/media-image-control";
import { requestSignedMediaUpload, uploadSignedMediaImage } from "@/lib/media-upload";

const statusOptions: OrderStatus[] = ["new", "processing", "waiting", "completed", "rejected"];
const orderTone = (status: OrderStatus) => ({ new: "blue", processing: "amber", waiting: "violet", completed: "green", rejected: "red" }[status]);
const fieldLabels: Record<string, string> = { email: "البريد الإلكتروني", imei: "IMEI", model: "موديل الجهاز", serial: "Serial Number", username: "اسم المستخدم", plan: "الباقة", duration: "مدة الكراء", game: "اللعبة", playerId: "Player ID" };
type Tab = "overview" | "orders" | "products" | "categories" | "customers" | "support" | "team" | "payments" | "settings";
type DisplayOrder = Order;
type Editor = { kind: "category" | "service"; mode: "create" | "edit"; id?: string } | null;
type CategoryForm = { name: string; icon: string; color: string; description: string; order: string; isActive: boolean };
type ServiceForm = { slug: string; title: string; categoryId: string; description: string; priceMad: string; compareAtPriceMad: string; promoteInCatalog: boolean; delivery: string; badge: string; imageUrl: string; imagePublicId: string; isActive: boolean; fields: DynamicField[] };
type MediaStatus = { configured: boolean; cloudName?: string };
type PaymentMethodForm = { title: string; code: string; type: PaymentMethod["type"]; status: PaymentMethod["status"]; scope: PaymentMethod["scope"]; instructions: string; sortOrder: string; bankBeneficiaryName: string; bankRib: string; bankName: string; bankSwiftCode: string; bankBranchName: string; bankReferenceNote: string; cashBeneficiaryName: string; cashAgencyNetwork: string; cashAgencyInstructions: string; gatewayProvider: "cmi" | "payzone" | "cash_plus_payment"; gatewayMerchantId: string; gatewayCallbackPath: string; gatewayHostedPageUrl: string };

const emptyCategoryForm = (order: number): CategoryForm => ({ name: "", icon: "Folder", color: "#1479FF", description: "", order: String(order), isActive: true });
const emptyServiceForm = (categoryId = ""): ServiceForm => ({ slug: "", title: "", categoryId, description: "", priceMad: "", compareAtPriceMad: "", promoteInCatalog: false, delivery: "", badge: "", imageUrl: "", imagePublicId: "", isActive: false, fields: [] });
const walletBalance = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : 0;
const emptyPaymentMethodForm = (sortOrder = 100): PaymentMethodForm => ({ title: "", code: "", type: "cash_transfer", status: "draft", scope: "both", instructions: "", sortOrder: String(sortOrder), bankBeneficiaryName: "", bankRib: "", bankName: "", bankSwiftCode: "", bankBranchName: "", bankReferenceNote: "اكتب المرجع {paymentReference} في سبب التحويل.", cashBeneficiaryName: "", cashAgencyNetwork: "Cash Plus", cashAgencyInstructions: "اذهب إلى أقرب وكالة، واطلب تحويل المبلغ إلى اسم المستفيد، ثم احتفظ بالإيصال.", gatewayProvider: "cmi", gatewayMerchantId: "", gatewayCallbackPath: "", gatewayHostedPageUrl: "" });
const paymentFormFromMethod = (method: PaymentMethod): PaymentMethodForm => ({ title: method.title, code: method.code, type: method.type, status: method.status, scope: method.scope, instructions: method.instructions, sortOrder: String(method.sortOrder), bankBeneficiaryName: method.bankDetails?.beneficiaryName || "", bankRib: method.bankDetails?.rib || "", bankName: method.bankDetails?.bankName || "", bankSwiftCode: method.bankDetails?.swiftCode || "", bankBranchName: method.bankDetails?.branchName || "", bankReferenceNote: method.bankDetails?.referenceNote || "", cashBeneficiaryName: method.cashTransferDetails?.beneficiaryName || "", cashAgencyNetwork: method.cashTransferDetails?.agencyNetwork || "", cashAgencyInstructions: method.cashTransferDetails?.agencyInstructions || "", gatewayProvider: method.gatewayConfig?.provider || (method.provider === "cmi" || method.provider === "payzone" || method.provider === "cash_plus_payment" ? method.provider : "cmi"), gatewayMerchantId: method.gatewayConfig?.merchantId || "", gatewayCallbackPath: method.gatewayConfig?.callbackPath || "", gatewayHostedPageUrl: method.gatewayConfig?.hostedPageUrl || "" });
const emptySnapshot = (): StoreSnapshot => ({ categories: [], services: [], customers: [], orders: [], walletEntries: [], paymentMethods: [], payments: [] });

const dynamicFieldTypes: { value: DynamicField["type"]; label: string }[] = [
  { value: "text", label: "نص قصير" },
  { value: "email", label: "بريد إلكتروني" },
  { value: "select", label: "قائمة اختيار" },
  { value: "textarea", label: "ملاحظة طويلة" },
];

function toEditorDynamicFields(value: unknown): DynamicField[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).map((candidate, index) => {
    const field = candidate && typeof candidate === "object" ? candidate as Partial<DynamicField> : {};
    const type: DynamicField["type"] = dynamicFieldTypes.some((item) => item.value === field.type) ? field.type as DynamicField["type"] : "text";
    const options = Array.isArray(field.options) ? field.options.filter((option): option is string => typeof option === "string") : undefined;
    return {
      id: typeof field.id === "string" && field.id.trim() ? field.id : `field-${index + 1}`,
      label: typeof field.label === "string" ? field.label : "",
      type,
      required: field.required !== false,
      ...(typeof field.placeholder === "string" ? { placeholder: field.placeholder } : {}),
      ...(type === "select" ? { options: options?.length ? options : [""] } : {}),
    };
  });
}

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
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [session] = useState(() => typeof window === "undefined" ? null : getAuthSession());
  const isManager = session?.role === "manager";
  const managerPermissions = session?.managerPermissions || { orders: false, support: false, catalog: false };
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
  const [orderStatusFilter, setOrderStatusFilter] = useState<"all" | OrderStatus>("all");
  const [orderSearch, setOrderSearch] = useState("");
  const [showArchivedOrders, setShowArchivedOrders] = useState(false);
  const [orderArchiveSavingId, setOrderArchiveSavingId] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
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
  const [purchaseUrl, setPurchaseUrl] = useState("");
  const [purchaseUrlLoading, setPurchaseUrlLoading] = useState(false);
  const [purchaseUrlSaving, setPurchaseUrlSaving] = useState(false);
  const [paymentMethodForm, setPaymentMethodForm] = useState<PaymentMethodForm>(() => emptyPaymentMethodForm());
  const [editingPaymentMethodId, setEditingPaymentMethodId] = useState<string | null>(null);
  const [paymentMethodSaving, setPaymentMethodSaving] = useState(false);
  const [paymentReviewSavingId, setPaymentReviewSavingId] = useState<string | null>(null);
  const [paymentProofOpeningId, setPaymentProofOpeningId] = useState<string | null>(null);
  const [paymentReconciliationNotes, setPaymentReconciliationNotes] = useState<Record<string, string>>({});
  const [paymentMethodDeletingId, setPaymentMethodDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!firebase || (isManager && !managerPermissions.support)) return;
    return onAuthStateChanged(firebase.auth, async (user) => {
      if (!user) { setTickets([]); return; }
      try {
        const response = await fetch("/api/admin/support", { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
        const result = await response.json().catch(() => ({})) as { tickets?: SupportTicket[]; error?: string };
        if (!response.ok) throw new Error(result.error || "تعذر تحميل رسائل الدعم.");
        setTickets(result.tickets || []);
      } catch (reason) { setNotice(reason instanceof Error ? reason.message : "تعذر تحميل رسائل الدعم."); }
    });
  }, [firebase, isManager, managerPermissions.support]);

  useEffect(() => {
    if (!firebase || (isManager && !managerPermissions.catalog)) return;
    return onAuthStateChanged(firebase.auth, async (user) => {
      if (!user) { setMediaStatus(null); return; }
      try {
        const response = await fetch("/api/admin/media/signature", { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
        const result = await response.json().catch(() => ({})) as MediaStatus & { error?: string };
        setMediaStatus(response.ok ? result : { configured: false });
      } catch { setMediaStatus({ configured: false }); }
    });
  }, [firebase, isManager, managerPermissions.catalog]);

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
  const activeOrders = useMemo(() => allOrders.filter((order) => !order.archivedAt), [allOrders]);
  const archivedOrders = useMemo(() => allOrders.filter((order) => Boolean(order.archivedAt)), [allOrders]);
  const ordersForList = showArchivedOrders ? archivedOrders : activeOrders;
  const totalWallet = useMemo(() => data.customers.reduce((sum, item) => sum + walletBalance(item.walletMad), 0), [data.customers]);
  const processing = activeOrders.filter((item) => item.status === "processing").length;
  const activeCategory = data.categories.find((item) => item.id === openFolder);
  const filteredCustomerOrders = selectedCustomerId ? ordersForList.filter((order) => order.customerId === selectedCustomerId) : ordersForList;
  const normalizedOrderSearch = orderSearch.trim().toLocaleLowerCase();
  const visibleOrders = filteredCustomerOrders.filter((order) => {
    if (orderStatusFilter !== "all" && order.status !== orderStatusFilter) return false;
    if (!normalizedOrderSearch) return true;
    const customer = data.customers.find((item) => item.id === order.customerId);
    const service = data.services.find((item) => item.id === order.serviceId);
    return [order.id, customer?.fullName || "", customer?.email || "", customer?.phone || "", service?.title || ""].join(" ").toLocaleLowerCase().includes(normalizedOrderSearch);
  });
  const overviewOrders = [...activeOrders].filter((order) => order.status === "new" || order.status === "waiting" || order.status === "processing").sort((left, right) => {
    const priority = { new: 0, waiting: 1, processing: 2 } as const;
    return priority[left.status as keyof typeof priority] - priority[right.status as keyof typeof priority] || right.updatedAt.localeCompare(left.updatedAt);
  }).slice(0, 5);
  const normalizedCustomerSearch = customerSearch.trim().toLocaleLowerCase();
  const visibleCustomers = data.customers.filter((customer) => !normalizedCustomerSearch || [customer.fullName, customer.email, customer.phone].join(" ").toLocaleLowerCase().includes(normalizedCustomerSearch));
  const activeCategories = data.categories.filter((category) => category.isActive);
  const navItems: [Tab, string][] = isManager
    ? [...(managerPermissions.catalog ? [["products", "المنتجات"] as [Tab, string], ["categories", "التصنيفات"] as [Tab, string]] : []), ...(managerPermissions.orders ? [["overview", "نظرة عامة"] as [Tab, string], ["orders", "الطلبات"] as [Tab, string]] : []), ...(managerPermissions.support ? [["support", "الدعم"] as [Tab, string]] : [])]
    : [["overview", "نظرة عامة"], ["orders", "الطلبات"], ["products", "المنتجات"], ["categories", "التصنيفات"], ["customers", "العملاء"], ["support", "الدعم"], ["team", "الفريق"], ["payments", "إدارة الدفع"], ["settings", "الإعدادات"]];
  const mobilePrimaryNav = navItems.filter(([id]) => ["overview", "orders", "products", "customers"].includes(id));
  const mobileMoreNav = navItems.filter(([id]) => !["overview", "orders", "products", "customers"].includes(id));
  const tabTitles: Record<Tab, string> = { overview: "نظرة عامة CMC", orders: "إدارة الطلبات", products: "مجلدات المنتجات", categories: "إدارة التصنيفات", customers: "العملاء والمحافظ", support: "رسائل الدعم", team: "إدارة الفريق", payments: "مركز الدفع", settings: "إعدادات المتجر" };

  useEffect(() => {
    if (!isManager) return;
    const allowedTabs: Tab[] = [
      ...(managerPermissions.catalog ? ["products", "categories"] as Tab[] : []),
      ...(managerPermissions.orders ? ["overview", "orders"] as Tab[] : []),
      ...(managerPermissions.support ? ["support"] as Tab[] : []),
    ];
    if (allowedTabs.length && !allowedTabs.includes(tab)) setTab(allowedTabs[0]);
  }, [isManager, managerPermissions.catalog, managerPermissions.orders, managerPermissions.support, tab]);

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

  function beginPaymentMethodCreate() {
    setEditingPaymentMethodId(null);
    setPaymentMethodForm(emptyPaymentMethodForm((data.paymentMethods.at(-1)?.sortOrder || 0) + 10));
  }

  function beginPaymentMethodEdit(method: PaymentMethod) {
    setEditingPaymentMethodId(method.id);
    setPaymentMethodForm(paymentFormFromMethod(method));
  }

  async function savePaymentMethod() {
    const sortOrder = Number(paymentMethodForm.sortOrder);
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000) { setNotice("رتبة وسيلة الدفع يجب أن تكون رقمًا صحيحًا بين 0 و10,000."); return; }
    const basePayload = { title: paymentMethodForm.title.trim(), code: paymentMethodForm.code.trim().toLowerCase(), type: paymentMethodForm.type, status: paymentMethodForm.status, scope: paymentMethodForm.scope, instructions: paymentMethodForm.instructions.trim(), sortOrder };
    const payload = paymentMethodForm.type === "bank_transfer"
      ? { ...basePayload, bankDetails: { beneficiaryName: paymentMethodForm.bankBeneficiaryName.trim(), rib: paymentMethodForm.bankRib.trim(), bankName: paymentMethodForm.bankName.trim(), swiftCode: paymentMethodForm.bankSwiftCode.trim(), branchName: paymentMethodForm.bankBranchName.trim(), referenceNote: paymentMethodForm.bankReferenceNote.trim() } }
      : paymentMethodForm.type === "cash_transfer"
        ? { ...basePayload, cashTransferDetails: { beneficiaryName: paymentMethodForm.cashBeneficiaryName.trim(), agencyNetwork: paymentMethodForm.cashAgencyNetwork.trim(), agencyInstructions: paymentMethodForm.cashAgencyInstructions.trim() } }
        : { ...basePayload, provider: paymentMethodForm.gatewayProvider, gatewayConfig: { provider: paymentMethodForm.gatewayProvider, merchantId: paymentMethodForm.gatewayMerchantId.trim(), environment: "sandbox" as const, callbackPath: paymentMethodForm.gatewayCallbackPath.trim(), hostedPageUrl: paymentMethodForm.gatewayHostedPageUrl.trim(), status: "draft" as const } };
    try {
      setPaymentMethodSaving(true);
      const result = editingPaymentMethodId
        ? await adminRequest<{ method: PaymentMethod }>(`/api/admin/payment-methods/${editingPaymentMethodId}`, "PATCH", payload)
        : await adminRequest<{ method: PaymentMethod }>("/api/admin/payment-methods", "POST", payload);
      setData((previous) => ({ ...previous, paymentMethods: [...(editingPaymentMethodId ? previous.paymentMethods.map((item) => item.id === result.method.id ? result.method : item) : [...previous.paymentMethods, result.method])].sort((left, right) => left.sortOrder - right.sortOrder) }));
      setNotice(editingPaymentMethodId ? `تم تحديث وسيلة الدفع «${result.method.title}».` : `تمت إضافة وسيلة الدفع «${result.method.title}».`);
      beginPaymentMethodCreate();
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "تعذر حفظ وسيلة الدفع.");
    } finally { setPaymentMethodSaving(false); }
  }

  async function deletePaymentMethod(method: PaymentMethod) {
    if (!window.confirm(`حذف وسيلة الدفع «${method.title}»؟ لا يمكن حذفها إن كانت مرتبطة بتحويل سابق.`)) return;
    try {
      setPaymentMethodDeletingId(method.id);
      await adminRequest(`/api/admin/payment-methods/${method.id}`, "DELETE");
      setData((previous) => ({ ...previous, paymentMethods: previous.paymentMethods.filter((item) => item.id !== method.id) }));
      if (editingPaymentMethodId === method.id) beginPaymentMethodCreate();
      setNotice(`تم حذف وسيلة الدفع «${method.title}».`);
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "تعذر حذف وسيلة الدفع.");
    } finally { setPaymentMethodDeletingId(null); }
  }

  async function reviewPayment(payment: PaymentRecord, action: "under_review" | "confirm" | "reject", reconciliationNote = "") {
    if (action === "confirm" && reconciliationNote.trim().length < 4) { setNotice("اكتب ملاحظة مختصرة عن مطابقة المرجع والمبلغ في حسابك البنكي قبل التأكيد."); return; }
    if (action === "confirm" && !window.confirm(`تأكيد استلام ${formatMAD(payment.amountMad)} بالمرجع ${payment.paymentReference}؟ لا يمكن التراجع عن هذا الإجراء المالي.`)) return;
    if (action === "reject" && !window.confirm(`رفض التحويل بالمرجع ${payment.paymentReference}؟`)) return;
    try {
      setPaymentReviewSavingId(payment.id);
      const result = await adminRequest<{ payment: PaymentRecord; creditedWallet: boolean }>(`/api/admin/payments/${payment.id}/review`, "PATCH", { action, ...(reconciliationNote.trim() ? { reconciliationNote: reconciliationNote.trim() } : {}) });
      setData((previous) => ({ ...previous, payments: previous.payments.map((item) => item.id === result.payment.id ? result.payment : item), ...(action === "confirm" && result.payment.purpose === "order" && result.payment.orderId ? { orders: previous.orders.map((order) => order.id === result.payment.orderId ? { ...order, status: "processing", updatedAt: result.payment.updatedAt, statusHistory: [...(order.statusHistory || []), { status: "processing", at: result.payment.updatedAt, note: `تم تأكيد التحويل اليدوي (${result.payment.paymentReference})` }] } : order) } : {}) }));
      setNotice(action === "confirm" ? (result.creditedWallet ? "تم تأكيد التحويل وشحن رصيد العميل." : "تم تأكيد التحويل وإرسال الطلب إلى المعالجة.") : action === "reject" ? "تم رفض التحويل وتسجيل السبب." : "تم وضع التحويل قيد المراجعة.");
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "تعذر حفظ مراجعة التحويل.");
    } finally { setPaymentReviewSavingId(null); }
  }

  async function openPaymentProof(payment: PaymentRecord) {
    try {
      setPaymentProofOpeningId(payment.id);
      const result = await adminRequest<{ url: string }>(`/api/admin/payments/${payment.id}/proof`, "GET");
      const opened = window.open(result.url, "_blank", "noopener,noreferrer");
      if (!opened) setNotice("حظر المتصفح فتح الإثبات. اسمح بالنوافذ المنبثقة لـ CMC ثم أعد المحاولة.");
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "تعذر فتح إثبات التحويل.");
    } finally { setPaymentProofOpeningId(null); }
  }

  async function savePurchaseUrl(serviceId: string) {
    try {
      setPurchaseUrlSaving(true);
      const result = await adminRequest<{ purchaseUrl: string | null }>(`/api/admin/services/${serviceId}/procurement`, "PATCH", { purchaseUrl: purchaseUrl.trim() || null });
      setPurchaseUrl(result.purchaseUrl || "");
      setNotice(result.purchaseUrl ? "تم حفظ رابط الشراء الداخلي. سيظهر فقط لفريق الطلبات داخل الطلبات." : "تمت إزالة رابط الشراء الداخلي.");
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "تعذر حفظ رابط الشراء الداخلي.");
    } finally {
      setPurchaseUrlSaving(false);
    }
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

  async function loadOrderPurchaseUrl(orderId: string) {
    const result = await adminRequest<{ purchaseUrl: string | null }>(`/api/admin/orders/${orderId}/procurement`, "GET");
    return result.purchaseUrl;
  }

  async function patchOrder(orderId: string, payload: { status?: OrderStatus; deliveryCode?: string; deliveryNote?: string; archive?: boolean }) {
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

  async function archiveOrder(orderId: string, archive: boolean) {
    const target = allOrders.find((order) => order.id === orderId);
    if (!target || target.status !== "rejected") return;
    const action = archive ? "أرشفة وإخفاء" : "إعادة إلى قائمة الطلبات";
    if (!window.confirm(`${action} الطلب ${orderId}؟ لن يُحذف السجل أو بيانات العميل.`)) return;
    const now = new Date().toISOString();
    try {
      setOrderArchiveSavingId(orderId);
      await patchOrder(orderId, { archive });
      setData((previous) => ({ ...previous, orders: previous.orders.map((order) => order.id === orderId ? { ...order, updatedAt: now, ...(archive ? { archivedAt: now, archivedBy: session?.uid || "owner" } : { archivedAt: undefined, archivedBy: undefined }) } : order) }));
      setNotice(archive ? `تمت أرشفة الطلب ${orderId}. يمكنك عرضه أو استعادته من «المؤرشفة».` : `تمت استعادة الطلب ${orderId} إلى القائمة.`);
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : "تعذرت أرشفة الطلب."); }
    finally { setOrderArchiveSavingId(null); }
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
      setServiceForm({ slug: service.slug, title: service.title, categoryId: service.categoryId, description: service.description, priceMad: String(service.priceMad), compareAtPriceMad: service.compareAtPriceMad === undefined ? "" : String(service.compareAtPriceMad), promoteInCatalog: service.promoteInCatalog === true, delivery: service.delivery, badge: service.badge || "", imageUrl: service.imageUrl || "", imagePublicId: service.imagePublicId || "", isActive: service.isActive, fields: toEditorDynamicFields(service.fields) });
      setPurchaseUrl("");
      setEditor({ kind: "service", mode: "edit", id: service.id });
      if (!isManager) {
        setPurchaseUrlLoading(true);
        void adminRequest<{ purchaseUrl: string | null }>(`/api/admin/services/${service.id}/procurement`, "GET").then((result) => setPurchaseUrl(result.purchaseUrl || "")).catch((reason) => setNotice(reason instanceof Error ? reason.message : "تعذر تحميل رابط الشراء الداخلي.")).finally(() => setPurchaseUrlLoading(false));
      }
    } else {
      setPurchaseUrl("");
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
        const safeCategoryPayload = isManager ? { name: payload.name, icon: payload.icon, color: payload.color, description: payload.description, order, ...(editor.mode === "create" ? { isActive: false } : {}) } : payload;
        if (editor.mode === "create") {
          const result = await adminRequest<{ category: Category }>("/api/admin/categories", "POST", safeCategoryPayload);
          setData((previous) => ({ ...previous, categories: [...previous.categories, result.category].sort((left, right) => left.order - right.order) }));
          setNotice(`تمت إضافة التصنيف «${result.category.name}».`);
        } else {
          const result = await adminRequest<{ category: Category }>(`/api/admin/categories/${editor.id}`, "PATCH", safeCategoryPayload);
          setData((previous) => ({ ...previous, categories: previous.categories.map((category) => category.id === result.category.id ? result.category : category).sort((left, right) => left.order - right.order) }));
          setNotice(`تم تعديل التصنيف «${result.category.name}».`);
        }
      } else {
        const priceMad = Number(serviceForm.priceMad);
        const compareAtPriceMad = serviceForm.compareAtPriceMad.trim() ? Number(serviceForm.compareAtPriceMad) : undefined;
        if (!isManager && (!Number.isFinite(priceMad) || priceMad < 0)) throw new Error("أدخل سعرًا صالحًا بالدرهم المغربي.");
        if (!isManager && compareAtPriceMad !== undefined && (!Number.isFinite(compareAtPriceMad) || compareAtPriceMad <= priceMad)) throw new Error("السعر الأصلي يجب أن يكون أعلى من سعر البيع لتفعيل العرض.");
        const fields = normalizeDynamicFields(serviceForm.fields);
        const metadataPayload = { slug: serviceForm.slug.trim(), title: serviceForm.title.trim(), categoryId: serviceForm.categoryId, description: serviceForm.description.trim(), delivery: serviceForm.delivery.trim(), imageUrl: serviceForm.imageUrl.trim() || undefined, imagePublicId: serviceForm.imagePublicId.trim() || undefined, fields };
        const basePayload = isManager ? { ...metadataPayload, ...(editor.mode === "create" ? { priceMad: 0, isActive: false, promoteInCatalog: false } : {}) } : { ...metadataPayload, priceMad, ...(compareAtPriceMad === undefined ? {} : { compareAtPriceMad }), promoteInCatalog: serviceForm.promoteInCatalog, isActive: serviceForm.isActive };
        if (editor.mode === "create") {
          const result = await adminRequest<{ service: Service }>("/api/admin/services", "POST", { ...basePayload, badge: serviceForm.badge.trim() || undefined });
          setData((previous) => ({ ...previous, services: [...previous.services, result.service] }));
          setOpenFolder(result.service.categoryId);
          setNotice(`تمت إضافة الخدمة «${result.service.title}».`);
        } else {
          const result = await adminRequest<{ service: Service }>(`/api/admin/services/${editor.id}`, "PATCH", { ...basePayload, ...(isManager ? {} : { compareAtPriceMad: compareAtPriceMad ?? null }), imageUrl: serviceForm.imageUrl.trim() || null, imagePublicId: serviceForm.imagePublicId.trim() || null, badge: serviceForm.badge.trim() || null });
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

  return <div className="admin-console"><aside className="cmc-sidebar" aria-label="تنقّل CMC"><div className="cmc-title">ChriGsm <b>CMC</b></div><nav>{navItems.map(([id, label]) => <button className={tab === id ? "active" : ""} onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined} key={id}>{label}</button>)}</nav><div className="cmc-summary"><b>لوحة الإدارة</b><span>أدر الطلبات والخدمات والعملاء من مكان واحد</span></div></aside><nav className="cmc-mobile-nav" aria-label="تنقّل CMC على الهاتف">{mobilePrimaryNav.map(([id, label]) => <button className={tab === id ? "active" : ""} type="button" onClick={() => { setTab(id); setMobileMoreOpen(false); }} aria-current={tab === id ? "page" : undefined} key={id}>{id === "overview" ? <LayoutDashboard size={18}/> : id === "orders" ? <ListChecks size={18}/> : id === "products" ? <Package2 size={18}/> : <UsersRound size={18}/>}<span>{label}</span></button>)}{mobileMoreNav.length > 0 && <button type="button" className={mobileMoreNav.some(([id]) => tab === id) ? "active" : ""} onClick={() => setMobileMoreOpen(true)} aria-expanded={mobileMoreOpen} aria-controls="cmc-mobile-more"><Menu size={18}/><span>المزيد</span></button>}</nav>{mobileMoreOpen && <div className="cmc-more-backdrop" role="presentation" onMouseDown={() => setMobileMoreOpen(false)}><section id="cmc-mobile-more" className="cmc-more-sheet" role="dialog" aria-modal="true" aria-label="وجهات CMC الإضافية" onMouseDown={(event) => event.stopPropagation()}><div className="cmc-sheet-handle"/><header><div><p className="eyebrow">CMC</p><h2>المزيد من الأدوات</h2></div><button className="icon-action-button" type="button" aria-label="إغلاق" onClick={() => setMobileMoreOpen(false)}><X size={19}/></button></header><div className="cmc-more-list">{mobileMoreNav.map(([id, label]) => <button type="button" className={tab === id ? "active" : ""} onClick={() => { setTab(id); setMobileMoreOpen(false); }} key={id}>{id === "categories" ? <FolderTree size={19}/> : id === "support" ? <MessageCircle size={19}/> : id === "team" ? <UsersRound size={19}/> : <Settings2 size={19}/>}<span>{label}</span></button>)}</div></section></div>}<section className="cmc-content"><header className="cmc-heading"><div><p className="eyebrow">إدارة العمليات</p><h1>{tabTitles[tab]}</h1></div><span className="live-pill"><span/> إدارة المتجر</span></header><p className="admin-notice" role="status">{notice}</p><AdminOnboardingTour role={isManager ? "manager" : "admin"}/>
    {tab === "overview" && <><div className="metric-grid"><Metric icon={<UsersRound/>} label="عملاء نشطون" value={String(data.customers.length)} note="حسابات مسجلة"/><Metric icon={<Boxes/>} label="طلبات جديدة" value={String(allOrders.filter((item) => item.status === "new").length)} note="تصل من المتجر"/><Metric icon={<FolderTree/>} label="قيد المعالجة" value={String(processing)} note="بيانات مقفلة للعميل"/><Metric icon={<CreditCard/>} label="إجمالي الأرصدة" value={formatMAD(totalWallet)} note="محافظ العملاء"/></div><section className="cmc-card"><div className="section-title"><div><p className="eyebrow">تحتاج إجراءً الآن</p><h2>طابور العمل</h2></div><button className="filter-button" type="button" onClick={() => { setOrderStatusFilter("all"); setOrderSearch(""); setSelectedCustomerId(null); setTab("orders"); }}>فتح كل الطلبات</button></div><p className="muted-text">تظهر الطلبات الجديدة أو التي تحتاج متابعة فقط. تُنفذ التفاصيل والتسليم من قسم الطلبات.</p>{overviewOrders.length ? <OrderGrid orders={overviewOrders} data={data} onStatus={updateOrder} deliveryDrafts={deliveryDrafts} deliveryNotes={deliveryNotes} onDeliveryDraft={setDeliveryDrafts} onDeliveryNote={setDeliveryNotes} onSendDelivery={sendDelivery} onLoadPurchaseUrl={loadOrderPurchaseUrl}/> : <div className="empty-state"><Boxes size={24}/><h2>لا توجد طلبات تحتاج إجراءً الآن</h2><p>ستظهر هنا الطلبات الجديدة أو التي تنتظر متابعة من الفريق.</p></div>}</section></>}
    {tab === "orders" && <section className="cmc-card"><div className="section-title"><div><p className="eyebrow">بيانات وتسليم واضح</p><h2>{showArchivedOrders ? "الطلبات المؤرشفة" : "طلبات الخدمات"}</h2></div><div className="row-actions">{!isManager && <button className="filter-button" type="button" onClick={() => { setShowArchivedOrders((value) => !value); setOrderStatusFilter("all"); setOrderSearch(""); }}><Archive size={14}/>{showArchivedOrders ? "الطلبات النشطة" : `المؤرشفة (${archivedOrders.length})`}</button>}{selectedCustomerId ? <button className="filter-button" type="button" onClick={() => setSelectedCustomerId(null)}>كل العملاء</button> : <span className="muted-text">يصل إشعار داخل الحساب عند الإكمال</span>}</div></div><div className="cmc-toolbar"><input value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} placeholder="ابحث برقم الطلب أو العميل أو الخدمة" aria-label="بحث في الطلبات"/><div className="status-filter-list" aria-label="فلترة حالة الطلب"><button type="button" className={orderStatusFilter === "all" ? "active" : ""} onClick={() => setOrderStatusFilter("all")}>الكل <span>{filteredCustomerOrders.length}</span></button>{statusOptions.map((status) => <button type="button" className={orderStatusFilter === status ? "active" : ""} onClick={() => setOrderStatusFilter(status)} key={status}>{statusLabels[status]} <span>{filteredCustomerOrders.filter((order) => order.status === status).length}</span></button>)}</div></div>{visibleOrders.length ? <OrderGrid orders={visibleOrders} data={data} onStatus={updateOrder} deliveryDrafts={deliveryDrafts} deliveryNotes={deliveryNotes} onDeliveryDraft={setDeliveryDrafts} onDeliveryNote={setDeliveryNotes} onSendDelivery={sendDelivery} onLoadPurchaseUrl={loadOrderPurchaseUrl} canArchive={!isManager} onArchive={archiveOrder} archiveSavingId={orderArchiveSavingId}/> : <div className="empty-state"><Boxes size={24}/><h2>لا توجد طلبات مطابقة</h2><p>{showArchivedOrders ? "لا توجد طلبات مؤرشفة بعد." : "غيّر البحث أو الفلتر لعرض الطلبات المتاحة."}</p></div>}</section>}
    {tab === "products" && <section className="cmc-card"><div className="section-title"><div><p className="eyebrow">إدارة الكتالوج</p><h2>{activeCategory ? activeCategory.name : "مجلدات المنتجات"}</h2></div>{activeCategory && <button className="filter-button" onClick={() => setOpenFolder(null)}>رجوع للمجلدات</button>}</div>{!activeCategory ? <div className="folder-grid">{data.categories.map((category) => <article className="folder-card" key={category.id} style={{ "--folder-color": category.color } as CSSProperties}><button className="folder-open" onClick={() => setOpenFolder(category.id)}><span className="folder-icon">{category.icon.slice(0, 1)}</span><span><b>{category.name}</b><small>{data.services.filter((item) => item.categoryId === category.id).length} خدمات</small></span></button></article>)}</div> : <div className="product-list">{data.services.filter((item) => item.categoryId === activeCategory.id).map((service) => <article className="product-row" key={service.id}>{service.imageUrl ? <Image className="service-image" src={service.imageUrl} alt="" width={72} height={72} sizes="72px"/> : <span className="service-glyph">{service.title.slice(0, 2)}</span>}<div><h3>{service.title}</h3><p>{service.description}</p></div><strong>{formatMAD(service.priceMad)}</strong><div className="row-actions"><button className="filter-button" onClick={() => openServiceEditor(undefined, service)}><Pencil size={14}/> تعديل</button>{!isManager && <button className="danger-button" onClick={() => deleteService(service)} disabled={isSaving}><Trash2 size={14}/> حذف</button>}</div></article>)}<button className="primary-button" onClick={() => openServiceEditor(activeCategory.id)} disabled={!firebase || isSaving}><Plus size={16}/> إضافة خدمة</button></div>}</section>}
    {tab === "categories" && <section className="cmc-card"><div className="section-title"><div><p className="eyebrow">تنظيم الكتالوج</p><h2>التصنيفات والأيقونات</h2></div><button className="primary-button small" onClick={() => openCategoryEditor()} disabled={!firebase || isSaving}><Plus size={15}/> إضافة تصنيف</button></div><div className="category-admin-list">{data.categories.map((category) => <article key={category.id} className="category-admin-row"><span className="folder-icon" style={{ "--folder-color": category.color } as CSSProperties}>{category.icon.slice(0, 1)}</span><div><h3>{category.name}</h3><p>{category.description || "من دون وصف"} · أيقونة: {category.icon}</p></div><span className="muted-text">{data.services.filter((item) => item.categoryId === category.id).length} خدمات</span><div className="row-actions"><button className="filter-button" onClick={() => openCategoryEditor(category)} disabled={!firebase || isSaving}><Pencil size={14}/> تعديل</button>{!isManager && <button className="danger-button" onClick={() => setDeleteId(category.id)} disabled={!firebase || isSaving}><Trash2 size={15}/> حذف</button>}</div></article>)}</div></section>}
    {tab === "customers" && <section className="cmc-card"><div className="section-title"><div><p className="eyebrow">إدارة الأرصدة والحسابات</p><h2>العملاء</h2></div><span className="muted-text">إجراءات الحظر والحذف تُسجّل وتحتاج تأكيدًا</span></div><div className="cmc-toolbar"><input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="ابحث باسم العميل أو البريد أو الهاتف" aria-label="بحث في العملاء"/><span className="muted-text">{visibleCustomers.length} من {data.customers.length} حسابات</span></div><div className="customer-grid">{visibleCustomers.map((customer) => { const isBlocked = customer.accountStatus === "blocked"; return <article className={`customer-card large${isBlocked ? " blocked" : ""}`} key={customer.id}><span className="avatar">{customer.avatarUrl ? <Image src={customer.avatarUrl} alt={`صورة ${customer.fullName}`} width={38} height={38} sizes="38px"/> : <UserRound size={19} aria-label="صورة افتراضية"/>}</span><div><h3>{customer.fullName}</h3><p>{customer.phone || customer.email}</p><strong>رصيد {formatMAD(walletBalance(customer.walletMad))} · {allOrders.filter((order) => order.customerId === customer.id).length} طلبات</strong><span className={`customer-status ${isBlocked ? "blocked" : "active"}`}>{isBlocked ? <><Ban size={12}/> محظور</> : <><ShieldCheck size={12}/> نشط</>}</span>{isBlocked && customer.blockedReason && <p className="customer-reason">سبب الحظر: {customer.blockedReason}</p>}</div><div className="wallet-actions"><input type="number" inputMode="decimal" min="0.01" max="1000000" step="0.01" aria-label={`مبلغ تعديل رصيد ${customer.fullName}`} value={walletAmounts[customer.id] || ""} onChange={(event) => setWalletAmounts((previous) => ({ ...previous, [customer.id]: event.target.value }))} placeholder="المبلغ (د.م.)" disabled={!firebase || walletSavingId === customer.id || customerActionSaving}/><input aria-label={`سبب تعديل رصيد ${customer.fullName}`} value={walletReasons[customer.id] || ""} onChange={(event) => setWalletReasons((previous) => ({ ...previous, [customer.id]: event.target.value }))} placeholder="سبب التعديل (مطلوب)" disabled={!firebase || walletSavingId === customer.id || customerActionSaving}/><div><button className="wallet-credit" onClick={() => submitWalletAdjustment(customer.id, "credit")} disabled={!firebase || walletSavingId === customer.id || customerActionSaving}>إضافة رصيد</button><button className="wallet-debit" onClick={() => submitWalletAdjustment(customer.id, "debit")} disabled={!firebase || walletSavingId === customer.id || customerActionSaving}>خصم رصيد</button><button onClick={() => { setSelectedCustomerId(customer.id); setTab("orders"); }} disabled={walletSavingId === customer.id || customerActionSaving}>طلبات</button></div><div className="customer-actions"><button className="filter-button" onClick={() => { setCustomerAction({ id: customer.id, kind: isBlocked ? "unblock" : "block" }); setCustomerActionReason(""); }} disabled={!firebase || customerActionSaving}>{isBlocked ? <><ShieldCheck size={14}/> إلغاء الحظر</> : <><Ban size={14}/> حظر الحساب</>}</button><button className="danger-button" onClick={() => { setCustomerAction({ id: customer.id, kind: "delete" }); setCustomerActionReason(""); }} disabled={!firebase || customerActionSaving}><UserX size={14}/> حذف الحساب</button></div></div></article>; })}</div></section>}
    {tab === "team" && !isManager && <TeamManagement onNotice={setNotice}/>}
        {tab === "payments" && !isManager && <PaymentCenter methods={data.paymentMethods} payments={data.payments} customers={data.customers} orders={data.orders} services={data.services} form={paymentMethodForm} editingId={editingPaymentMethodId} savingMethod={paymentMethodSaving} savingReviewId={paymentReviewSavingId} proofOpeningId={paymentProofOpeningId} reconciliationNotes={paymentReconciliationNotes} deletingMethodId={paymentMethodDeletingId} onFormChange={setPaymentMethodForm} onReconciliationNoteChange={setPaymentReconciliationNotes} onStartCreate={beginPaymentMethodCreate} onStartEdit={beginPaymentMethodEdit} onDelete={(method) => { void deletePaymentMethod(method); }} onSave={() => { void savePaymentMethod(); }} onOpenProof={(payment) => { void openPaymentProof(payment); }} onReview={(payment, action, reconciliationNote) => { void reviewPayment(payment, action, reconciliationNote);}}/>}

    {tab === "support" && <section className="cmc-card"><div className="section-title"><div><p className="eyebrow">رسائل العملاء المحفوظة</p><h2>الدعم</h2></div><span className="muted-text">{tickets.length} رسائل</span></div>{tickets.length ? <div className="admin-ticket-list">{tickets.map((ticket) => { const ticketCustomer = data.customers.find((customer) => customer.id === ticket.customerId); return <article key={ticket.id}><MessageCircle size={20}/><div><b>{ticket.subject}</b><p>{ticket.message}</p><small>{ticketCustomer?.fullName || ticket.customerId} · {ticket.createdAt.slice(0, 10)}</small>{ticket.reply && <div className="ticket-reply"><b>رد CMC</b><p>{ticket.reply.message}</p></div>}</div><div><span className={`status-pill ${ticket.status === "open" ? "amber" : "green"}`}>{ticket.status === "open" ? "مفتوح" : "تم الرد"}</span>{ticket.status === "open" && <div className="support-reply-draft"><textarea value={replyDrafts[ticket.id] || ""} onChange={(event) => setReplyDrafts((previous) => ({ ...previous, [ticket.id]: event.target.value }))} placeholder="اكتب ردًا يظهر للعميل" disabled={!firebase || supportSavingId === ticket.id}/><button className="filter-button" onClick={() => answerTicket(ticket.id)} disabled={!firebase || supportSavingId === ticket.id}><Send size={14}/> {supportSavingId === ticket.id ? "جارٍ الحفظ..." : "إرسال الرد"}</button></div>}</div></article>; })}</div> : <div className="empty-state"><MessageCircle size={24}/><h2>لا توجد رسائل دعم محفوظة</h2><p>ستظهر رسائل العملاء هنا فور إرسالها من حساباتهم.</p></div>}</section>}
    {tab === "settings" && <section className="cmc-card"><div className="section-title"><div><p className="eyebrow">إعدادات المتجر</p><h2>إعدادات المتجر والإدارة</h2></div><Settings2 size={22}/></div><AdminSessionControls/><div className="admin-settings-grid"><article><p>اسم المتجر</p><strong>ChriGsm</strong><small>يظهر في الرأس ورسائل الحساب</small></article><article><p>عملة المتجر</p><strong>الدرهم المغربي (د.م.)</strong><small>معتمدة في الأسعار والمحافظ</small></article></div></section>}
  </section>{deleteId && <div className="dialog-backdrop"><div className="confirm-dialog"><p className="eyebrow">حذف متسلسل</p><h2>حذف التصنيف وخدماته؟</h2><p>سيُحذف التصنيف «{data.categories.find((item) => item.id === deleteId)?.name}» وجميع خدماته التابعة غير المرتبطة بطلبات. اكتب اسم التصنيف للتأكيد.</p><input autoFocus value={typedName} onChange={(event) => setTypedName(event.target.value)} placeholder="اسم التصنيف"/><div><button className="filter-button" onClick={() => { setDeleteId(null); setTypedName(""); }} disabled={isSaving}>إلغاء</button><button className="danger-button" disabled={isSaving || typedName !== data.categories.find((item) => item.id === deleteId)?.name} onClick={deleteCategory}>تأكيد الحذف</button></div></div></div>}{customerAction && <div className="dialog-backdrop"><div className="confirm-dialog customer-action-dialog"><p className="eyebrow">إدارة حساب العميل</p><h2>{customerAction.kind === "block" ? "حظر حساب العميل؟" : customerAction.kind === "unblock" ? "إلغاء حظر العميل؟" : "حذف حساب العميل نهائيًا؟"}</h2><p>{customerAction.kind === "block" ? "سيُمنع العميل من تسجيل الدخول وستُلغى جلساته الحالية فورًا. اكتب سبب الحظر ليُسجَّل في سجل الإدارة." : customerAction.kind === "unblock" ? "سيستطيع العميل تسجيل الدخول من جديد بعد إلغاء الحظر." : "سيُحذف حساب الدخول وملف العميل ورسائل الدعم وسجل الرصيد، بشرط ألّا يكون لديه طلبات أو رصيد. اكتب الاسم الكامل للعميل للتأكيد."}</p>{customerAction.kind === "block" && <textarea autoFocus value={customerActionReason} onChange={(event) => setCustomerActionReason(event.target.value)} placeholder="سبب الحظر (مطلوب)" disabled={customerActionSaving}/>} {customerAction.kind === "delete" && <input autoFocus value={customerActionReason} onChange={(event) => setCustomerActionReason(event.target.value)} placeholder={data.customers.find((item) => item.id === customerAction.id)?.fullName || "الاسم الكامل"} disabled={customerActionSaving}/>}<div><button className="filter-button" onClick={() => { setCustomerAction(null); setCustomerActionReason(""); }} disabled={customerActionSaving}>إلغاء</button><button className="danger-button" onClick={() => { void submitCustomerAction(); }} disabled={customerActionSaving || (customerAction.kind === "block" && customerActionReason.trim().length < 4) || (customerAction.kind === "delete" && customerActionReason.trim() !== data.customers.find((item) => item.id === customerAction.id)?.fullName)}>{customerActionSaving ? "جارٍ التنفيذ..." : customerAction.kind === "delete" ? "تأكيد الحذف" : customerAction.kind === "block" ? "حظر وإغلاق الجلسات" : "تأكيد إلغاء الحظر"}</button></div></div></div>}{editor && <EditorDialog editor={editor} categoryForm={categoryForm} serviceForm={serviceForm} categories={activeCategories} existingService={editor.id ? data.services.find((service) => service.id === editor.id) : undefined} saving={isSaving} mediaStatus={mediaStatus} imageUploading={imageUploading} purchaseUrl={purchaseUrl} purchaseUrlLoading={purchaseUrlLoading} purchaseUrlSaving={purchaseUrlSaving} allowPurchaseUrl={!isManager} allowFinancialCatalogControls={!isManager} onPurchaseUrlChange={setPurchaseUrl} onSavePurchaseUrl={() => { if (editor.id) void savePurchaseUrl(editor.id); }} onUploadImage={async (file) => { try { await uploadServiceImage(file); } catch (reason) { setNotice(reason instanceof Error ? reason.message : "تعذر رفع الصورة."); } }} onRemoveImage={() => setServiceForm((previous) => ({ ...previous, imageUrl: "", imagePublicId: "" }))} onClose={() => setEditor(null)} onSave={saveEditor} onCategoryChange={setCategoryForm} onServiceChange={setServiceForm}/>}</div>;
}

function PaymentCenter({ methods, payments, customers, orders, services, form, editingId, savingMethod, savingReviewId, proofOpeningId, reconciliationNotes, deletingMethodId, onFormChange, onReconciliationNoteChange, onStartCreate, onStartEdit, onDelete, onSave, onOpenProof, onReview }: { methods: PaymentMethod[]; payments: PaymentRecord[]; customers: Customer[]; orders: Order[]; services: Service[]; form: PaymentMethodForm; editingId: string | null; savingMethod: boolean; savingReviewId: string | null; proofOpeningId: string | null; reconciliationNotes: Record<string, string>; deletingMethodId: string | null; onFormChange: React.Dispatch<React.SetStateAction<PaymentMethodForm>>; onReconciliationNoteChange: React.Dispatch<React.SetStateAction<Record<string, string>>>; onStartCreate: () => void; onStartEdit: (method: PaymentMethod) => void; onDelete: (method: PaymentMethod) => void; onSave: () => void; onOpenProof: (payment: PaymentRecord) => void; onReview: (payment: PaymentRecord, action: "under_review" | "confirm" | "reject", reconciliationNote?: string) => void; }) {
  const [reviewedAt] = useState(() => Date.now());
  const pendingPayments = payments.filter((payment) => payment.status === "manual_transfer_pending" || payment.status === "proof_submitted" || payment.status === "under_review");
  const methodTypeLabel: Record<PaymentMethod["type"], string> = { cash_transfer: "تحويل نقدي", bank_transfer: "تحويل بنكي", electronic_gateway: "بوابة إلكترونية" };
  const scopeLabel: Record<PaymentMethod["scope"], string> = { order: "طلبات فقط", wallet_topup: "شحن رصيد فقط", both: "الطلبات وشحن الرصيد" };
  const paymentStatusLabel: Record<PaymentRecord["status"], string> = { manual_transfer_pending: "بانتظار إثبات التحويل", proof_submitted: "وصل الإثبات", under_review: "قيد المراجعة", confirmed: "مؤكد", rejected: "مرفوض", expired: "منتهي" };
  return <section className="payment-center"><div className="payment-center-intro"><div><p className="eyebrow">المالك فقط · سجل تدقيق خادمي</p><h2>وسائل الدفع والتحويلات</h2><p>المرجع الفريد مخصص لمطابقة التحويل فقط؛ لا تُضاف أرصدة ولا تُعالج طلبات قبل تأكيدك اليدوي.</p></div><div className="payment-summary"><span><Clock3 size={17}/> {pendingPayments.length} قيد المراجعة</span><span><Landmark size={17}/> {methods.filter((method) => method.status === "active").length} وسيلة مفعلة</span></div></div><div className="payment-center-grid"><section className="cmc-card payment-method-form"><div className="section-title"><div><p className="eyebrow">إعداد مباشر من CMC</p><h3>{editingId ? "تعديل وسيلة دفع" : "إضافة وسيلة دفع"}</h3></div>{editingId && <button type="button" className="filter-button" onClick={onStartCreate} disabled={savingMethod}>إلغاء التعديل</button>}</div><div className="editor-grid"><FormField label="الاسم الظاهر للعميل"><input value={form.title} onChange={(event) => onFormChange((value) => ({ ...value, title: event.target.value }))} placeholder="مثال: Cash Plus" disabled={savingMethod}/></FormField><FormField label="المعرف الداخلي"><input dir="ltr" value={form.code} onChange={(event) => onFormChange((value) => ({ ...value, code: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))} placeholder="cash-plus" disabled={savingMethod}/></FormField><FormField label="نوع الوسيلة"><select value={form.type} onChange={(event) => onFormChange((value) => ({ ...value, type: event.target.value as PaymentMethod["type"], ...(event.target.value === "electronic_gateway" ? { status: "draft" } : {}) }))} disabled={savingMethod}><option value="cash_transfer">Cash Plus / Tashilat</option><option value="bank_transfer">تحويل بنكي</option><option value="electronic_gateway">بوابة إلكترونية (مسودة)</option></select></FormField><FormField label="النطاق"><select value={form.scope} onChange={(event) => onFormChange((value) => ({ ...value, scope: event.target.value as PaymentMethod["scope"] }))} disabled={savingMethod}><option value="both">الطلبات وشحن الرصيد</option><option value="order">طلبات الخدمات فقط</option><option value="wallet_topup">شحن الرصيد فقط</option></select></FormField><FormField label="الحالة"><select value={form.status} onChange={(event) => onFormChange((value) => ({ ...value, status: event.target.value as PaymentMethod["status"] }))} disabled={savingMethod || form.type === "electronic_gateway"}><option value="draft">مسودة غير ظاهرة</option><option value="active">مفعلة للعميل</option><option value="disabled">معطلة</option></select></FormField><FormField label="الترتيب"><input type="number" min="0" max="10000" value={form.sortOrder} onChange={(event) => onFormChange((value) => ({ ...value, sortOrder: event.target.value }))} disabled={savingMethod}/></FormField>{form.type === "bank_transfer" && <><FormField label="الاسم القانوني للمستفيد"><input value={form.bankBeneficiaryName} onChange={(event) => onFormChange((value) => ({ ...value, bankBeneficiaryName: event.target.value }))} placeholder="الاسم كما يظهر في وثيقة RIB" disabled={savingMethod}/></FormField><FormField label="اسم البنك"><input value={form.bankName} onChange={(event) => onFormChange((value) => ({ ...value, bankName: event.target.value }))} placeholder="Crédit Agricole du Maroc" disabled={savingMethod}/></FormField><FormField label="RIB المغربي (24 رقمًا)"><input dir="ltr" inputMode="numeric" value={form.bankRib} onChange={(event) => onFormChange((value) => ({ ...value, bankRib: event.target.value.replace(/[^0-9\s]/g, "") }))} placeholder="000 000 000 000 000 000 000 000" disabled={savingMethod}/></FormField><FormField label="تعليمات المرجع"><input value={form.bankReferenceNote} onChange={(event) => onFormChange((value) => ({ ...value, bankReferenceNote: event.target.value }))} placeholder="اكتب المرجع {paymentReference} في سبب التحويل." disabled={savingMethod}/></FormField><FormField label="الفرع (اختياري)"><input value={form.bankBranchName} onChange={(event) => onFormChange((value) => ({ ...value, bankBranchName: event.target.value }))} placeholder="اسم الفرع" disabled={savingMethod}/></FormField><FormField label="SWIFT (اختياري للتحويل الدولي)"><input dir="ltr" value={form.bankSwiftCode} onChange={(event) => onFormChange((value) => ({ ...value, bankSwiftCode: event.target.value.toUpperCase() }))} placeholder="CNCAMAMR" disabled={savingMethod}/></FormField><p className="payment-structured-note"><Landmark size={16}/> لن تظهر هذه الوسيلة للعميل عند التفعيل إلا بعد إدخال اسم المستفيد واسم البنك وRIB وتعليمات المرجع.</p></>}{form.type === "cash_transfer" && <><FormField label="شبكة الوكالة"><input value={form.cashAgencyNetwork} onChange={(event) => onFormChange((value) => ({ ...value, cashAgencyNetwork: event.target.value }))} placeholder="Cash Plus أو Tashilat" disabled={savingMethod}/></FormField><FormField label="الاسم لدى الوكالة"><input value={form.cashBeneficiaryName} onChange={(event) => onFormChange((value) => ({ ...value, cashBeneficiaryName: event.target.value }))} placeholder="الاسم الذي يقدمه العميل لموظف الوكالة" disabled={savingMethod}/></FormField><FormField label="خطوات الوكالة" wide><textarea value={form.cashAgencyInstructions} onChange={(event) => onFormChange((value) => ({ ...value, cashAgencyInstructions: event.target.value }))} placeholder="اذهب إلى وكالة التحويل، اطلب التحويل إلى اسم المستفيد، ثم احتفظ بالإيصال." disabled={savingMethod}/></FormField><p className="payment-structured-note"><Banknote size={16}/> يعرض النظام المرجع الفريد للعميل؛ ولا يكفي المرجع أو الإيصال وحده لتأكيد الدفع.</p></>}{form.type === "electronic_gateway" && <><FormField label="مزود البوابة"><select value={form.gatewayProvider} onChange={(event) => onFormChange((value) => ({ ...value, gatewayProvider: event.target.value as PaymentMethodForm["gatewayProvider"] }))} disabled={savingMethod}><option value="cmi">CMI</option><option value="payzone">Payzone</option><option value="cash_plus_payment">Cash Plus Payment</option></select></FormField><FormField label="معرف التاجر غير السري (اختياري)"><input dir="ltr" value={form.gatewayMerchantId} onChange={(event) => onFormChange((value) => ({ ...value, gatewayMerchantId: event.target.value }))} placeholder="يُدخل بعد استلامه ضمن عقد التاجر" disabled={savingMethod}/></FormField><FormField label="مسار إشعار داخلي (اختياري)"><input dir="ltr" value={form.gatewayCallbackPath} onChange={(event) => onFormChange((value) => ({ ...value, gatewayCallbackPath: event.target.value }))} placeholder="/api/payments/gateways/cmi/callback" disabled={savingMethod}/></FormField><FormField label="رابط صفحة مستضافة (اختياري)"><input dir="ltr" value={form.gatewayHostedPageUrl} onChange={(event) => onFormChange((value) => ({ ...value, gatewayHostedPageUrl: event.target.value }))} placeholder="https://..." disabled={savingMethod}/></FormField></>}<FormField label="تعليمات العميل" wide><textarea value={form.instructions} onChange={(event) => onFormChange((value) => ({ ...value, instructions: event.target.value }))} placeholder={"اكتب المبلغ {amount} والمرجع {paymentReference} عند التحويل.\nيمكنك ذكر رقم الحساب أو RIB أو اسم المستفيد."} disabled={savingMethod}/><small>المتغيرات المتاحة: <code>{"{amount}"}</code> و<code>{"{paymentReference}"}</code> و<code>{"{orderNumber}"}</code>.</small></FormField></div>{form.type === "electronic_gateway" && <p className="payment-security-note"><CircleOff size={17}/> هذه مسودة هندسية فقط: لا تضع مفاتيح API أو كلمات مرور أو توقيعات هنا. تظل البوابة غير مفعلة وفي بيئة الاختبار حتى يكتمل عقد التاجر والربط الخادمي والاختبار الرسمي.</p>}<button className="primary-button" type="button" onClick={onSave} disabled={savingMethod}>{savingMethod ? "جارٍ الحفظ..." : editingId ? "حفظ وسيلة الدفع" : "إضافة وسيلة الدفع"}</button></section><section className="cmc-card payment-method-list"><div className="section-title"><div><p className="eyebrow">الوسائل المسجلة</p><h3>قائمة وسائل الدفع</h3></div><span className="muted-text">{methods.length} وسيلة</span></div>{methods.length ? <div className="payment-method-rows">{methods.map((method) => <article key={method.id} className={`payment-method-row ${method.status}`}><span className="payment-method-icon">{method.type === "bank_transfer" ? <Landmark size={18}/> : method.type === "electronic_gateway" ? <CreditCard size={18}/> : <Banknote size={18}/>}</span><div><h4>{method.title}</h4><p>{methodTypeLabel[method.type]} · {scopeLabel[method.scope]} · ترتيب {method.sortOrder}</p><small>{method.status === "active" ? "مفعلة بعد اكتمال بياناتها" : method.status === "draft" ? "مسودة غير ظاهرة" : "معطلة"}</small>{method.status === "active" && method.type === "bank_transfer" && (!method.bankDetails?.beneficiaryName || !method.bankDetails?.bankName || !method.bankDetails?.rib || !method.bankDetails?.referenceNote) && <small className="payment-method-warning">تحتاج بيانات المستفيد وRIB قبل أن تظهر للعميل.</small>}{method.status === "active" && method.type === "cash_transfer" && (!method.cashTransferDetails?.beneficiaryName || !method.cashTransferDetails?.agencyNetwork || !method.cashTransferDetails?.agencyInstructions) && <small className="payment-method-warning">تحتاج شبكة الوكالة واسم المستفيد والخطوات قبل أن تظهر للعميل.</small>}</div><div className="row-actions"><button type="button" className="filter-button" onClick={() => onStartEdit(method)}><Pencil size={14}/> تعديل</button><button type="button" className="danger-button" onClick={() => onDelete(method)} disabled={deletingMethodId === method.id}><Trash2 size={14}/>{deletingMethodId === method.id ? "جارٍ الحذف..." : "حذف"}</button></div></article>)}</div> : <div className="empty-state"><Landmark size={24}/><h3>لا توجد وسيلة دفع بعد</h3><p>أضف Cash Plus أو Tashilat أو حسابًا بنكيًا. لن تظهر للعملاء قبل تفعيلها.</p></div>}</section></div><section className="cmc-card payment-review-list"><div className="section-title"><div><p className="eyebrow">لا تأكيد تلقائي</p><h3>التحويلات التي تحتاج مراجعة</h3></div><span className="muted-text">آخر {payments.length} عملية</span></div>{pendingPayments.length ? <div className="payment-review-grid">{pendingPayments.map((payment) => { const customer = customers.find((item) => item.id === payment.customerId); const order = payment.orderId ? orders.find((item) => item.id === payment.orderId) : undefined; const service = order ? services.find((item) => item.id === order.serviceId) : undefined; const isExpired = new Date(payment.referenceExpiresAt).getTime() < reviewedAt; const busy = savingReviewId === payment.id; return <article className="payment-review-card" key={payment.id}><div className="payment-review-top"><span className={`status-pill ${payment.status === "under_review" ? "violet" : payment.status === "proof_submitted" ? "blue" : "amber"}`}>{paymentStatusLabel[payment.status]}</span><code>{payment.paymentReference}</code></div><strong>{formatMAD(payment.amountMad)}</strong><p>{customer?.fullName || "عميل"} · {payment.purpose === "wallet_topup" ? "شحن رصيد" : `${service?.title || "طلب خدمة"} (${payment.orderId || "—"})`}</p><small>{payment.methodSnapshot.title} · {isExpired ? "انتهت صلاحية المرجع" : `ينتهي المرجع ${new Date(payment.referenceExpiresAt).toLocaleString("ar-MA")}`}</small>{payment.proof ? <><div className="payment-proof-owner"><b>أرفق العميل إثبات التحويل</b><button type="button" className="filter-button" onClick={() => onOpenProof(payment)} disabled={proofOpeningId === payment.id}>{proofOpeningId === payment.id ? "جارٍ الفتح..." : "فتح الإثبات"}</button></div><label className="payment-reconciliation-note"><span>ملاحظة المطابقة البنكية <b>*</b></span><textarea value={reconciliationNotes[payment.id] || ""} onChange={(event) => onReconciliationNoteChange((current) => ({ ...current, [payment.id]: event.target.value }))} placeholder="مثال: تطابق المبلغ والمرجع والحساب مع كشف البنك" disabled={busy}/></label></> : <p className="payment-proof-waiting">بانتظار أن يرفق العميل سكرين أو إثبات التحويل.</p>}<div className="payment-review-actions"><button type="button" className="filter-button" onClick={() => onReview(payment, "under_review", reconciliationNotes[payment.id])} disabled={busy || !payment.proof || payment.status === "under_review"}>قيد المراجعة</button><button type="button" className="wallet-credit" onClick={() => onReview(payment, "confirm", reconciliationNotes[payment.id])} disabled={busy || isExpired || !payment.proof || (reconciliationNotes[payment.id] || "").trim().length < 4}><CheckCircle2 size={14}/> {busy ? "جارٍ الحفظ..." : "تأكيد"}</button><button type="button" className="wallet-debit" onClick={() => onReview(payment, "reject", reconciliationNotes[payment.id])} disabled={busy}>رفض</button></div></article>; })}</div> : <div className="empty-state"><CheckCircle2 size={24}/><h3>لا توجد تحويلات معلقة</h3><p>ستظهر هنا التحويلات التي أنشأها العميل بعد اختياره وسيلة دفع مفعلة.</p></div>}</section></section>;
}

function EditorDialog({ editor, categoryForm, serviceForm, categories, existingService, saving, mediaStatus, imageUploading, purchaseUrl, purchaseUrlLoading, purchaseUrlSaving, allowPurchaseUrl, allowFinancialCatalogControls, onPurchaseUrlChange, onSavePurchaseUrl, onUploadImage, onRemoveImage, onClose, onSave, onCategoryChange, onServiceChange }: { editor: Exclude<Editor, null>; categoryForm: CategoryForm; serviceForm: ServiceForm; categories: Category[]; existingService?: Service; saving: boolean; mediaStatus: MediaStatus | null; imageUploading: boolean; purchaseUrl: string; purchaseUrlLoading: boolean; purchaseUrlSaving: boolean; allowPurchaseUrl: boolean; allowFinancialCatalogControls: boolean; onPurchaseUrlChange: (value: string) => void; onSavePurchaseUrl: () => void; onUploadImage: (file: File) => Promise<void>; onRemoveImage: () => void; onClose: () => void; onSave: () => void; onCategoryChange: React.Dispatch<React.SetStateAction<CategoryForm>>; onServiceChange: React.Dispatch<React.SetStateAction<ServiceForm>> }) {
  const isCategory = editor.kind === "category";
  const title = `${editor.mode === "create" ? "إضافة" : "تعديل"} ${isCategory ? "تصنيف" : "خدمة"}`;
  return <div className="dialog-backdrop"><div className="confirm-dialog editor-dialog"><p className="eyebrow">إدارة الكتالوج</p><h2>{title}</h2>{isCategory ? <div className="editor-grid"><FormField label="اسم التصنيف"><input value={categoryForm.name} onChange={(event) => onCategoryChange((previous) => ({ ...previous, name: event.target.value }))} placeholder="مثل خدمات Server"/></FormField><FormField label="الأيقونة أو الرابط"><input value={categoryForm.icon} onChange={(event) => onCategoryChange((previous) => ({ ...previous, icon: event.target.value }))} placeholder="Folder أو رابط أيقونة"/></FormField><FormField label="اللون"><input type="color" value={categoryForm.color} onChange={(event) => onCategoryChange((previous) => ({ ...previous, color: event.target.value }))}/></FormField><FormField label="الترتيب"><input type="number" min="0" value={categoryForm.order} onChange={(event) => onCategoryChange((previous) => ({ ...previous, order: event.target.value }))}/></FormField><FormField label="الوصف" wide><textarea value={categoryForm.description} onChange={(event) => onCategoryChange((previous) => ({ ...previous, description: event.target.value }))} placeholder="وصف قصير يظهر للعملاء"/></FormField>{allowFinancialCatalogControls ? <Toggle checked={categoryForm.isActive} onChange={(isActive) => onCategoryChange((previous) => ({ ...previous, isActive }))} label="تصنيف نشط"/> : <p className="editor-hint">يحفظ مدير الكتالوج التصنيف كمسودة؛ يفعّله المالك بعد المراجعة.</p>}</div> : <div className="editor-grid"><FormField label="اسم الخدمة" wide><input value={serviceForm.title} onChange={(event) => onServiceChange((previous) => ({ ...previous, title: event.target.value }))} placeholder="مثل TSL Tool Activation"/></FormField><FormField label="رابط الخدمة"><input dir="ltr" value={serviceForm.slug} onChange={(event) => onServiceChange((previous) => ({ ...previous, slug: event.target.value.toLowerCase().replace(/\s+/g, "-") }))} placeholder="tsl-tool-activation"/></FormField><FormField label="التصنيف"><select value={serviceForm.categoryId} onChange={(event) => onServiceChange((previous) => ({ ...previous, categoryId: event.target.value }))}><option value="">اختر التصنيف</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></FormField>{allowFinancialCatalogControls ? <><FormField label="سعر البيع (د.م.) — 0 للمسودة"><input type="number" min="0" step="0.01" value={serviceForm.priceMad} onChange={(event) => onServiceChange((previous) => ({ ...previous, priceMad: event.target.value }))} placeholder="0"/></FormField><FormField label="السعر الأصلي قبل التخفيض (اختياري)"><input type="number" min="0" step="0.01" value={serviceForm.compareAtPriceMad} onChange={(event) => onServiceChange((previous) => ({ ...previous, compareAtPriceMad: event.target.value }))} placeholder="يجب أن يكون أعلى من سعر البيع"/></FormField></> : <p className="editor-hint">السعر والتخفيض والنشر يحددها المالك بعد مراجعة المسودة.</p>}<FormField label="التسليم"><input value={serviceForm.delivery} onChange={(event) => onServiceChange((previous) => ({ ...previous, delivery: event.target.value }))} placeholder="مثال: فوري بعد المعالجة"/></FormField><FormField label="شارة اختيارية"><input value={serviceForm.badge} onChange={(event) => onServiceChange((previous) => ({ ...previous, badge: event.target.value }))} placeholder="مثل الأكثر طلبًا"/></FormField>{mediaStatus?.configured ? <MediaImageControl imageUrl={serviceForm.imageUrl || undefined} alt={`صورة ${serviceForm.title || "الخدمة"}`} fallbackLabel={serviceForm.title || "خد"} kind="service" disabled={saving} uploading={imageUploading} onSelect={(file) => { void onUploadImage(file); }} onRemove={onRemoveImage}/> : <p className="editor-hint">رفع الصور غير متاح حاليًا.</p>}<FormField label="الوصف" wide><textarea value={serviceForm.description} onChange={(event) => onServiceChange((previous) => ({ ...previous, description: event.target.value }))} placeholder="وصف واضح للخدمة"/></FormField>{allowFinancialCatalogControls && <><Toggle checked={serviceForm.isActive} onChange={(isActive) => onServiceChange((previous) => ({ ...previous, isActive }))} label="إتاحة الخدمة للعملاء"/><Toggle checked={serviceForm.promoteInCatalog} onChange={(promoteInCatalog) => onServiceChange((previous) => ({ ...previous, promoteInCatalog }))} label="إبرازها كخدمة محدّثة في بداية الكتالوج"/></>}<DynamicFieldsEditor fields={serviceForm.fields} onChange={(fields) => onServiceChange((previous) => ({ ...previous, fields }))} disabled={saving}/>{existingService && <p className="editor-hint">تم تحميل {existingService.fields.length} حقل مرتبط بالخدمة. عدّله ثم احفظ لتحديث نموذج الطلب.</p>}{existingService && allowPurchaseUrl && <section className="internal-purchase-url"><div><span className="eyebrow">داخلي للمالك والفريق</span><h3>رابط شراء الخدمة</h3><p>لا يظهر للعميل أو في الكتالوج. يظهر لفريق الطلبات داخل تفاصيل الطلب فقط.</p></div><input dir="ltr" type="url" value={purchaseUrl} onChange={(event) => onPurchaseUrlChange(event.target.value)} placeholder="https://supplier.example/product" disabled={purchaseUrlLoading || purchaseUrlSaving}/><div><button className="filter-button" type="button" onClick={onSavePurchaseUrl} disabled={purchaseUrlLoading || purchaseUrlSaving}>{purchaseUrlSaving ? "جارٍ حفظ الرابط..." : purchaseUrl ? "حفظ رابط الشراء" : "إزالة الرابط"}</button>{purchaseUrlLoading && <span className="muted-text">جارٍ تحميل الرابط...</span>}</div></section>}</div>}<div><button className="filter-button" onClick={onClose} disabled={saving}>إلغاء</button><button className="primary-button" onClick={onSave} disabled={saving || (!isCategory && categories.length === 0)}>{saving ? "جارٍ الحفظ..." : "حفظ التغييرات"}</button></div></div></div>;
}

function DynamicFieldsEditor({ fields, onChange, disabled }: { fields: DynamicField[]; onChange: (fields: DynamicField[]) => void; disabled: boolean }) {
  function addField() {
    const existing = new Set(fields.map((field) => String(field.id || "").toLowerCase()));
    let number = fields.length + 1;
    while (existing.has(`field-${number}`)) number += 1;
    onChange([...fields, { id: `field-${number}`, label: "", type: "text", required: true, placeholder: "" }]);
  }

  function updateField(index: number, update: (field: DynamicField) => DynamicField) {
    onChange(fields.map((field, fieldIndex) => fieldIndex === index ? update(field) : field));
  }

  return <section className="dynamic-fields-editor"><div className="dynamic-fields-header"><div><span className="eyebrow">نموذج الطلب</span><h3>الحقول المطلوبة من العميل</h3><p>أضف فقط البيانات اللازمة لتنفيذ هذه الخدمة. يراجع الخادم كل حقل قبل الحفظ والطلب.</p></div><button className="filter-button" type="button" onClick={addField} disabled={disabled || fields.length >= 20}><Plus size={14}/> إضافة حقل</button></div>{fields.length === 0 ? <div className="dynamic-fields-empty"><b>لا توجد حقول مخصصة بعد.</b><span>سيطلب المتجر البريد الإلكتروني افتراضيًا إلى أن تضيف حقولًا خاصة بهذه الخدمة.</span></div> : <div className="dynamic-fields-list">{fields.map((field, index) => <article className="dynamic-field-card" key={`${field.id || "field"}-${index}`}><div className="dynamic-field-title"><b>حقل {index + 1}</b><button className="danger-button" type="button" onClick={() => onChange(fields.filter((_, fieldIndex) => fieldIndex !== index))} disabled={disabled}><Trash2 size={14}/> إزالة</button></div><div className="dynamic-field-grid"><label><span>المعرف الداخلي</span><input dir="ltr" value={field.id} onChange={(event) => updateField(index, (current) => ({ ...current, id: event.target.value }))} placeholder="username" disabled={disabled}/></label><label><span>اسم الحقل للعميل</span><input value={field.label} onChange={(event) => updateField(index, (current) => ({ ...current, label: event.target.value }))} placeholder="مثل اسم مستخدم UnlockTool.net" disabled={disabled}/></label><label><span>نوع الإدخال</span><select value={field.type} onChange={(event) => { const type = event.target.value as DynamicField["type"]; updateField(index, (current) => ({ ...current, type, ...(type === "select" ? { options: current.options?.length ? current.options : [""] } : { options: undefined }) })); }} disabled={disabled}>{dynamicFieldTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label><label><span>نص مساعد</span><input value={field.placeholder || ""} onChange={(event) => updateField(index, (current) => ({ ...current, placeholder: event.target.value }))} placeholder="مثال أو توضيح قصير" disabled={disabled}/></label><Toggle checked={field.required} onChange={(required) => updateField(index, (current) => ({ ...current, required }))} label="حقل مطلوب"/>{field.type === "select" && <label className="dynamic-options"><span>خيارات القائمة</span><textarea value={(field.options || []).join("\n")} onChange={(event) => updateField(index, (current) => ({ ...current, options: event.target.value.split("\n") }))} placeholder={"تفعيل جديد\nتجديد"} disabled={disabled}/><small>اكتب كل خيار في سطر مستقل.</small></label>}</div></article>)}</div>}</section>;
}

function FormField({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) { return <label className={`editor-field${wide ? " wide" : ""}`}><span>{label}</span>{children}</label>; }
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) { return <label className="editor-toggle"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)}/><span>{label}</span></label>; }
function Metric({ icon, label, value, note }: { icon: ReactNode; label: string; value: string; note: string }) { return <article className="metric-card"><span>{icon}</span><p>{label}</p><strong>{value}</strong><small>{note}</small></article>; }
function OrderGrid({ orders, data, onStatus, deliveryDrafts, deliveryNotes, onDeliveryDraft, onDeliveryNote, onSendDelivery, onLoadPurchaseUrl, canArchive = false, onArchive, archiveSavingId }: { orders: DisplayOrder[]; data: StoreSnapshot; onStatus: (id: string, status: OrderStatus) => void; deliveryDrafts: Record<string, string>; deliveryNotes: Record<string, string>; onDeliveryDraft: React.Dispatch<React.SetStateAction<Record<string, string>>>; onDeliveryNote: React.Dispatch<React.SetStateAction<Record<string, string>>>; onSendDelivery: (id: string) => void; onLoadPurchaseUrl: (orderId: string) => Promise<string | null>; canArchive?: boolean; onArchive?: (id: string, archive: boolean) => void; archiveSavingId?: string | null }) {
  const [purchaseUrls, setPurchaseUrls] = useState<Record<string, string | null>>({});
  const [purchaseUrlLoading, setPurchaseUrlLoading] = useState<Record<string, boolean>>({});

  async function loadPurchaseUrl(orderId: string) {
    if (Object.prototype.hasOwnProperty.call(purchaseUrls, orderId) || purchaseUrlLoading[orderId]) return;
    setPurchaseUrlLoading((previous) => ({ ...previous, [orderId]: true }));
    try {
      const purchaseUrl = await onLoadPurchaseUrl(orderId);
      setPurchaseUrls((previous) => ({ ...previous, [orderId]: purchaseUrl }));
    } catch {
      setPurchaseUrls((previous) => ({ ...previous, [orderId]: null }));
    } finally {
      setPurchaseUrlLoading((previous) => ({ ...previous, [orderId]: false }));
    }
  }

  return <div className="cmc-order-grid">{orders.map((order) => { const customer = data.customers.find((item) => item.id === order.customerId); const service = data.services.find((item) => item.id === order.serviceId); const history = order.statusHistory?.length ? order.statusHistory : [{ status: order.status, at: order.updatedAt, note: `الحالة الحالية: ${statusLabels[order.status]}` }]; return <article className="cmc-order-card detailed-cmc-order" key={order.id}><div className="order-card-top"><span className={`status-pill ${orderTone(order.status)}`}>{statusLabels[order.status]}</span><span>{order.id}</span></div><h3>{service?.title || "خدمة رقمية"}</h3><p>{customer?.fullName || "عميل"} · {customer?.phone || "—"}</p><strong>{formatMAD(order.totalMad)}</strong><details className="cmc-order-details" onToggle={(event) => { if (event.currentTarget.open) void loadPurchaseUrl(order.id); }}><summary>البيانات المرسلة وسجل الطلب</summary><div><b>بيانات العميل</b><p>{customer?.email || "—"}</p></div><div><b>الحقول المرسلة</b>{Object.entries(order.formData).map(([key, value]) => <p key={key}><span>{fieldLabels[key] || key}</span>{value}</p>)}</div><div><b>سجل الحالة</b>{history.map((event, index) => <p key={`${event.at}-${index}`}><span className={`status-pill ${orderTone(event.status)}`}>{statusLabels[event.status]}</span>{event.note}</p>)}</div><div className="internal-order-purchase"><b>رابط شراء الخدمة</b>{purchaseUrlLoading[order.id] ? <p>جارٍ تحميل الرابط الداخلي...</p> : purchaseUrls[order.id] ? <a href={purchaseUrls[order.id] || "#"} target="_blank" rel="noreferrer noopener">فتح رابط الشراء</a> : <p>لا يوجد رابط شراء داخلي لهذه الخدمة.</p>}</div></details><select value={order.status} onChange={(event) => onStatus(order.id, event.target.value as OrderStatus)} disabled={Boolean(order.archivedAt)}>{statusOptions.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select>{canArchive && order.status === "rejected" && onArchive && <button className="filter-button" type="button" onClick={() => onArchive(order.id, !order.archivedAt)} disabled={archiveSavingId === order.id}>{order.archivedAt ? <><ArchiveRestore size={14}/>{archiveSavingId === order.id ? "جارٍ الاستعادة..." : "إعادة إلى القائمة"}</> : <><Archive size={14}/>{archiveSavingId === order.id ? "جارٍ الأرشفة..." : "أرشفة وإخفاء"}</>}</button>}{order.status === "processing" && !order.archivedAt && <div className="delivery-box"><input value={deliveryDrafts[order.id] || ""} onChange={(event) => onDeliveryDraft((previous) => ({ ...previous, [order.id]: event.target.value }))} placeholder="كود التفعيل أو تفاصيل التسليم"/><textarea value={deliveryNotes[order.id] || ""} onChange={(event) => onDeliveryNote((previous) => ({ ...previous, [order.id]: event.target.value }))} placeholder="ملاحظة تظهر للعميل (اختياري)"/><button type="button" onClick={() => onSendDelivery(order.id)}>تسليم وإشعار العميل</button></div>}{order.deliveryCode && <code>{order.deliveryCode}</code>}</article>; })}</div>; }

function TeamManagement({ onNotice }: { onNotice: (message: string) => void }) {
  const firebase = useMemo(() => firebaseServices(), []);
  const [managers, setManagers] = useState<Customer[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", temporaryPassword: "", orders: true, support: false, catalog: false });

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
      setForm({ fullName: "", email: "", phone: "", temporaryPassword: "", orders: true, support: false, catalog: false });
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

  return <section className="cmc-card team-management"><div className="section-title"><div><p className="eyebrow">صلاحية المالك فقط</p><h2>فريق ChriGsm</h2></div><span className="muted-text">اختر مهمة واحدة للمشرف؛ لا يرى أي مشرف المحافظ أو الدفع أو روابط الشراء الداخلية</span></div><form className="team-create-form" onSubmit={createManager}><input required value={form.fullName} onChange={(event) => setForm((previous) => ({ ...previous, fullName: event.target.value }))} placeholder="الاسم الكامل"/><input required type="email" dir="ltr" value={form.email} onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))} placeholder="manager@example.com"/><input value={form.phone} onChange={(event) => setForm((previous) => ({ ...previous, phone: event.target.value }))} placeholder="رقم واتساب (اختياري)"/><input required type="password" dir="ltr" minLength={8} value={form.temporaryPassword} onChange={(event) => setForm((previous) => ({ ...previous, temporaryPassword: event.target.value }))} placeholder="كلمة مرور مؤقتة (8+)"/><label className="permission-toggle"><input type="radio" name="managerScope" checked={form.orders} onChange={() => setForm((previous) => ({ ...previous, orders: true, support: false, catalog: false }))}/> مدير الطلبات</label><label className="permission-toggle"><input type="radio" name="managerScope" checked={form.support} onChange={() => setForm((previous) => ({ ...previous, orders: false, support: true, catalog: false }))}/> مدير الدعم</label><label className="permission-toggle"><input type="radio" name="managerScope" checked={form.catalog} onChange={() => setForm((previous) => ({ ...previous, orders: false, support: false, catalog: true }))}/> مدير الكتالوج</label><button className="primary-button" type="submit" disabled={busy}>{busy ? "جارٍ الحفظ..." : "إضافة مشرف"}</button></form><div className="team-list">{managers.length ? managers.map((manager) => <article className="team-row" key={manager.id}><span className="avatar"><UserRound size={18}/></span><div><h3>{manager.fullName}</h3><p>{manager.email} {manager.phone ? `· ${manager.phone}` : ""}</p><small>{manager.managerPermissions?.orders ? "مدير الطلبات" : manager.managerPermissions?.support ? "مدير الدعم" : manager.managerPermissions?.catalog ? "مدير الكتالوج" : "بلا صلاحية"}</small></div><span className={`customer-status ${manager.accountStatus === "blocked" ? "blocked" : "active"}`}>{manager.accountStatus === "blocked" ? "معطل" : "نشط"}</span><button className="filter-button" type="button" onClick={() => { void toggleManager(manager); }} disabled={busy}>{manager.accountStatus === "blocked" ? "تفعيل" : "تعطيل"}</button></article>) : <div className="empty-state"><UsersRound size={24}/><h2>لا يوجد مشرفون بعد</h2><p>أنشئ أول حساب محدود من النموذج أعلاه.</p></div>}</div></section>;
}

function AdminOnboardingTour({ role }: { role: "admin" | "manager" }) {
  const [visible, setVisible] = useState(() => typeof window !== "undefined" && window.localStorage.getItem(`chrigsm:cmc-tour:${role}`) !== "1");
  const [step, setStep] = useState(0);
  const steps = role === "manager"
    ? [{ title: "مرحبًا بك في CMC", body: "هذه المساحة مخصصة للمهمة التي اختارها المالك. لا يمكنك تعديل الأسعار أو المحافظ أو الدفع أو روابط الشراء الداخلية." }, { title: "تابع الطلبات", body: "غيّر الحالة بعد مراجعة بيانات العميل، ثم أرسل كود التفعيل أو ملاحظة التسليم." }, { title: "أجب على الدعم", body: "كل رد تحفظه يظهر للعميل داخل حسابه، وتبقى العملية مسجلة باسم حسابك." }]
    : [{ title: "ابدأ من النظرة العامة", body: "راجع الطلبات الجديدة، المعالجة، وأرصدة العملاء من شاشة واحدة." }, { title: "أدر الكتالوج", body: "من المنتجات والتصنيفات يمكنك إضافة الخدمات وصورها وأسعارها الحقيقية." }, { title: "أدر الفريق بأمان", body: "أنشئ مشرفين بصلاحيات الطلبات والدعم فقط، وتابع حالتهم من تبويب الفريق." }];

  function close() {
    window.localStorage.setItem(`chrigsm:cmc-tour:${role}`, "1");
    setVisible(false);
  }
  if (!visible) return null;
  const current = steps[step];
  return <div className="cmc-tour-backdrop" role="dialog" aria-modal="true" aria-labelledby="cmc-tour-title"><div className="cmc-tour"><div className="cmc-tour-progress"><span>{step + 1} / {steps.length}</span><button type="button" onClick={close}>تخطي الجولة</button></div><span className="tour-kicker">دليل CMC</span><h2 id="cmc-tour-title">{current.title}</h2><p>{current.body}</p><div className="cmc-tour-actions"><button className="filter-button" type="button" onClick={close}>لاحقًا</button>{step < steps.length - 1 ? <button className="primary-button" type="button" onClick={() => setStep((value) => value + 1)}>التالي</button> : <button className="primary-button" type="button" onClick={close}>فهمت، ابدأ</button>}</div></div></div>;
}
