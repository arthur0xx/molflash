export type Role = "admin" | "manager" | "customer";
export type OrderStatus = "new" | "processing" | "waiting" | "completed" | "rejected";
export type PaymentMethodType = "cash_transfer" | "bank_transfer" | "electronic_gateway";
export type PaymentMethodStatus = "draft" | "active" | "disabled";
export type PaymentScope = "order" | "wallet_topup" | "both";
export type PaymentStatus = "manual_transfer_pending" | "proof_submitted" | "under_review" | "confirmed" | "rejected" | "expired";
export type PaymentPurpose = "order" | "wallet_topup";

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  order: number;
  isActive: boolean;
}

export type BlogPostStatus = "draft" | "published" | "archived";
export type BlogLayout = "standard" | "guide" | "comparison";

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  color: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BlogSource {
  title: string;
  url: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  markdown: string;
  categoryId: string;
  tags: string[];
  serviceIds: string[];
  sources: BlogSource[];
  coverImageUrl?: string;
  coverImagePublicId?: string;
  coverImageAlt?: string;
  seoTitle?: string;
  seoDescription?: string;
  canonicalUrl?: string;
  noIndex?: boolean;
  layout: BlogLayout;
  status: BlogPostStatus;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  createdBy: string;
  updatedBy: string;
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
  /** Optional original price shown only when it is higher than the effective sale price. */
  compareAtPriceMad?: number;
  /** Moves a service to the top of catalogue results when the owner enables it. */
  promoteInCatalog?: boolean;
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
  createdAt?: string;
  updatedAt?: string;
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
  managerPermissions?: { orders: boolean; support: boolean; catalog: boolean };
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
  archivedAt?: string;
  archivedBy?: string;
}

export interface PaymentMethodBankDetails {
  /** الاسم القانوني المطابق تمامًا لصاحب الحساب المستفيد. */
  beneficiaryName?: string;
  /** RIB مغربي محلي مكون من 24 رقمًا؛ لا يقبل IBAN أو رقم بطاقة. */
  rib?: string;
  bankName?: string;
  /** يُعرض فقط عند تقديم المالك لتحويلات دولية بصورة منفصلة. */
  swiftCode?: string;
  branchName?: string;
  /** تذكير مختصر بكيفية كتابة المرجع الفريد في التحويل. */
  referenceNote?: string;
}

export interface PaymentMethodCashTransferDetails {
  /** الاسم الذي يقدمه العميل لموظف الوكالة لصالح التحويل. */
  beneficiaryName?: string;
  /** اسم الشبكة مثل Cash Plus أو Tashilat، إن كان منطبقًا. */
  agencyNetwork?: string;
  /** خطوات الوكالة التي يراها العميل بعد إنشاء المرجع. */
  agencyInstructions?: string;
}

export interface PaymentGatewayConfig {
  /** تعريف غير سري فقط؛ تبقى مفاتيح API في متغيرات خادمية ولا تُخزّن هنا. */
  provider: "cmi" | "payzone" | "cash_plus_payment";
  merchantId?: string;
  environment: "sandbox" | "production";
  /** مسار داخلي فقط لاستقبال إشعارات المزود في المستقبل. */
  callbackPath?: string;
  /** رابط مستضاف يقدمه المزود؛ لا يُستخدم قبل التعاقد والاختبار الرسمي. */
  hostedPageUrl?: string;
  status: "draft" | "testing" | "active";
}

export interface PaymentMethod {
  id: string;
  title: string;
  code: string;
  type: PaymentMethodType;
  status: PaymentMethodStatus;
  scope: PaymentScope;
  /** تعليمات عامة قصيرة؛ تُستكمل بالحقول المنظمة أدناه عند وجودها. */
  instructions: string;
  bankDetails?: PaymentMethodBankDetails;
  cashTransferDetails?: PaymentMethodCashTransferDetails;
  gatewayConfig?: PaymentGatewayConfig;
  sortOrder: number;
  /** متوافق مع السجلات القديمة؛ البوابة الجديدة تعتمد gatewayConfig.provider. */
  provider?: "cmi" | "payzone" | "cash_plus_payment" | "custom";
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface PaymentMethodSnapshot {
  title: string;
  type: PaymentMethodType;
  instructions: string;
  bankDetails?: PaymentMethodBankDetails;
  cashTransferDetails?: PaymentMethodCashTransferDetails;
}

export interface PaymentProof {
  /** Cloudinary authenticated asset identifier. A delivery URL is generated only by an authorized server route. */
  publicId: string;
  format: "png" | "jpg" | "jpeg" | "webp";
  sizeBytes: number;
  submittedAt: string;
}

export interface PaymentRecord {
  id: string;
  customerId: string;
  purpose: PaymentPurpose;
  orderId?: string;
  walletTopUpAmountMad?: number;
  amountMad: number;
  currency: "MAD";
  methodId: string;
  methodSnapshot: PaymentMethodSnapshot;
  paymentReference: string;
  referenceExpiresAt: string;
  customerTransferId?: string;
  customerNote?: string;
  /** Transfer evidence stored as a restricted Cloudinary asset; no public URL is persisted. */
  proof?: PaymentProof;
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
  /** Owner-only note recorded while matching the bank transaction with this payment reference. */
  reconciliationNote?: string;
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
  paymentMethods: PaymentMethod[];
  payments: PaymentRecord[];
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
