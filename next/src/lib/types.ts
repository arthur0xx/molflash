export type Role = "admin" | "manager" | "customer";
export type OrderStatus = "new" | "processing" | "waiting" | "completed" | "rejected";

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  order: number;
  isActive: boolean;
}

export interface DynamicField {
  id: string;
  label: string;
  type: "text" | "email" | "select" | "textarea";
  required: boolean;
  placeholder?: string;
  options?: string[];
}

export interface Service {
  id: string;
  slug: string;
  title: string;
  categoryId: string;
  description: string;
  priceMad: number;
  delivery: string;
  badge?: string;
  imageUrl?: string;
  imagePublicId?: string;
  /** Public catalogue metadata. Supplier cost and reference remain in server-only servicePrivate records. */
  catalogFamily?: "unlock" | "timed-access" | "rental" | "tool" | "processing";
  visualPreset?: string;
  termValue?: number;
  termUnit?: "days" | "months" | "years";
  publicationStatus?: "draft" | "ready" | "published" | "paused";
  isActive: boolean;
  fields: DynamicField[];
}

export interface Customer {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  walletMad: number;
  ordersCount: number;
  lastActivity: string;
  whatsappEnabled: boolean;
  phoneVerifiedAt?: string;
  notificationPreferences?: { email: boolean; whatsapp: boolean };
  avatarUrl?: string;
  avatarPublicId?: string;
  accountStatus?: "active" | "blocked";
  blockedAt?: string;
  blockedReason?: string;
  role?: Role;
  managerPermissions?: { orders: boolean; support: boolean };
  onboardingCompletedAt?: string;
}

export interface CustomerProfile {
  fullName: string;
  phone: string;
  email: string;
  phoneVerifiedAt?: string;
  notificationPreferences?: { email: boolean; whatsapp: boolean };
  avatarUrl?: string;
  avatarPublicId?: string;
}

export interface OrderStatusEvent {
  status: OrderStatus;
  at: string;
  note: string;
}

export interface OrderNotification {
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

export interface Order {
  id: string;
  customerId: string;
  serviceId: string;
  status: OrderStatus;
  totalMad: number;
  createdAt: string;
  updatedAt: string;
  deliveryCode?: string;
  deliveryNote?: string;
  formData: Record<string, string>;
  statusHistory?: OrderStatusEvent[];
  notification?: OrderNotification;
}

export interface WalletEntry {
  id: string;
  customerId: string;
  amountMad: number;
  reason: string;
  createdAt: string;
  createdBy: string;
}

export type SupportTicketStatus = "open" | "answered";

export interface SupportReply {
  message: string;
  createdAt: string;
  createdBy: string;
}

export interface SupportTicket {
  id: string;
  customerId: string;
  subject: string;
  message: string;
  status: SupportTicketStatus;
  createdAt: string;
  updatedAt: string;
  reply?: SupportReply;
}

export interface StoreSnapshot {
  categories: Category[];
  services: Service[];
  customers: Customer[];
  orders: Order[];
  walletEntries: WalletEntry[];
}

export const statusLabels: Record<OrderStatus, string> = {
  new: "جديد",
  processing: "قيد المعالجة",
  waiting: "بانتظار معلومات",
  completed: "مكتمل",
  rejected: "مرفوض",
};

export function formatMAD(amount: number) {
  return new Intl.NumberFormat("ar-MA", { maximumFractionDigits: 0 }).format(amount) + " د.م.";
}
