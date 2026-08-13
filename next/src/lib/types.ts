export type Role = "admin" | "customer";
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
  formData: Record<string, string>;
}

export interface WalletEntry {
  id: string;
  customerId: string;
  amountMad: number;
  reason: string;
  createdAt: string;
  createdBy: string;
}

export interface DemoSnapshot {
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
