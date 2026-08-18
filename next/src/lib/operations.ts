import type { Category, OrderStatus, PaymentRecord, Service, StoreSnapshot, SupportTicket } from "./types";

export type OperationTone = "blue" | "amber" | "violet" | "green" | "red" | "slate";

export interface NextStep {
  title: string;
  detail: string;
  tone: OperationTone;
}

export interface CatalogReadiness {
  state: "published" | "ready" | "needs_attention";
  label: string;
  missing: string[];
}

export interface OwnerWorkItem {
  id: string;
  kind: "order" | "support" | "payment" | "catalog";
  title: string;
  detail: string;
  tone: OperationTone;
  createdAt: string;
  targetTab: "orders" | "support" | "payments" | "products";
}

const orderNextSteps: Record<OrderStatus, NextStep> = {
  new: {
    title: "وصل طلبك وينتظر المراجعة",
    detail: "لا يلزمك إجراء الآن. سيبدأ المالك مراجعة بيانات الخدمة قبل المعالجة.",
    tone: "blue",
  },
  waiting: {
    title: "نحتاج معلومات إضافية منك",
    detail: "راجع طلبك ورسائل الدعم، ثم أرسل المعلومة المطلوبة في تذكرة الدعم نفسها.",
    tone: "violet",
  },
  processing: {
    title: "طلبك قيد المعالجة",
    detail: "ثُبّتت بيانات الطلب ولا يمكن تعديلها الآن. ستصلك تفاصيل التسليم عند الاكتمال.",
    tone: "amber",
  },
  completed: {
    title: "تم تسليم طلبك",
    detail: "راجع تفاصيل التسليم في هذا الطلب واحتفظ بها في مكان آمن.",
    tone: "green",
  },
  rejected: {
    title: "لا يمكن متابعة الطلب حاليًا",
    detail: "راجع سبب الرفض في سجل الطلب أو افتح تذكرة دعم إذا احتجت توضيحًا.",
    tone: "red",
  },
};

export function getOrderNextStep(status: OrderStatus): NextStep {
  return orderNextSteps[status];
}

export function getCatalogReadiness(service: Service, categories: Category[]): CatalogReadiness {
  const missing: string[] = [];
  if (!service.title.trim()) missing.push("اسم الخدمة");
  if (!service.slug.trim()) missing.push("الرابط الداخلي");
  if (!categories.some((category) => category.id === service.categoryId)) missing.push("التصنيف");
  if (!service.description.trim()) missing.push("الوصف");
  if (!service.imageUrl) missing.push("الصورة");
  if (!service.delivery.trim()) missing.push("مدة أو طريقة التسليم");
  if (!service.fields.length) missing.push("حقول الطلب");

  if (service.isActive && service.publicationStatus !== "paused") {
    return missing.length
      ? { state: "needs_attention", label: "منشورة وتحتاج مراجعة", missing }
      : { state: "published", label: "منشورة ومكتملة", missing };
  }

  return missing.length
    ? { state: "needs_attention", label: "مسودة تحتاج استكمالًا", missing }
    : { state: "ready", label: "جاهزة لمراجعتك", missing };
}

function paymentWorkItem(payment: PaymentRecord): OwnerWorkItem | null {
  if (payment.status !== "manual_transfer_pending" && payment.status !== "proof_submitted" && payment.status !== "under_review") return null;
  const detail = payment.status === "manual_transfer_pending"
    ? "بانتظار إثبات التحويل من العميل"
    : payment.status === "proof_submitted"
      ? "وصل الإثبات؛ طابقه يدويًا مع كشف البنك قبل التأكيد"
      : "المطابقة البنكية قيد المراجعة";
  return {
    id: `payment:${payment.id}`,
    kind: "payment",
    title: `تحويل ${payment.paymentReference}`,
    detail,
    tone: payment.status === "proof_submitted" ? "blue" : payment.status === "under_review" ? "violet" : "amber",
    createdAt: payment.createdAt,
    targetTab: "payments",
  };
}

export function getOwnerWorkItems(snapshot: StoreSnapshot, tickets: SupportTicket[]): OwnerWorkItem[] {
  const orderItems: OwnerWorkItem[] = snapshot.orders
    .filter((order) => !order.archivedAt && ["new", "waiting", "processing"].includes(order.status))
    .map((order) => {
      const service = snapshot.services.find((candidate) => candidate.id === order.serviceId);
      const customer = snapshot.customers.find((candidate) => candidate.id === order.customerId);
      const nextStep = getOrderNextStep(order.status);
      return {
        id: `order:${order.id}`,
        kind: "order",
        title: `${nextStep.title} · ${service?.title || "خدمة رقمية"}`,
        detail: customer?.fullName ? `العميل: ${customer.fullName}` : nextStep.detail,
        tone: nextStep.tone,
        createdAt: order.createdAt,
        targetTab: "orders",
      };
    });

  const supportItems: OwnerWorkItem[] = tickets
    .filter((ticket) => ticket.status === "open")
    .map((ticket) => ({
      id: `support:${ticket.id}`,
      kind: "support",
      title: `دعم مفتوح · ${ticket.subject}`,
      detail: "يحتاج ردك داخل CMC.",
      tone: "violet",
      createdAt: ticket.createdAt,
      targetTab: "support",
    }));

  const catalogItems: OwnerWorkItem[] = snapshot.services
    .map((service) => ({ service, readiness: getCatalogReadiness(service, snapshot.categories) }))
    .filter(({ readiness }) => readiness.state === "needs_attention")
    .map(({ service, readiness }) => ({
      id: `catalog:${service.id}`,
      kind: "catalog",
      title: `كتالوج يحتاج مراجعة · ${service.title || "خدمة بلا اسم"}`,
      detail: readiness.missing.length ? `ينقص: ${readiness.missing.join("، ")}` : "راجع اكتمال الخدمة المنشورة.",
      tone: "red",
      createdAt: service.updatedAt || service.createdAt || "",
      targetTab: "products",
    }));

  const paymentItems = snapshot.payments.map(paymentWorkItem).filter((item): item is OwnerWorkItem => Boolean(item));

  return [...paymentItems, ...orderItems, ...supportItems, ...catalogItems]
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .slice(0, 12);
}
