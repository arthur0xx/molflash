import { z } from "zod";
import type { PaymentMethod } from "@/lib/types";

const paymentMethodTypeSchema = z.enum(["cash_transfer", "bank_transfer", "electronic_gateway"]);
const paymentMethodStatusSchema = z.enum(["draft", "active", "disabled"]);
const paymentScopeSchema = z.enum(["order", "wallet_topup", "both"]);
const gatewayProviderSchema = z.enum(["cmi", "payzone", "cash_plus_payment"]);
const legacyProviderSchema = z.enum(["cmi", "payzone", "cash_plus_payment", "custom"]);

const optionalText = (max: number) => z.string().trim().max(max).optional();

export const bankDetailsSchema = z.object({
  beneficiaryName: optionalText(140),
  rib: z.string().trim().transform((value) => value.replace(/\s+/g, "")).refine((value) => !value || /^\d{24}$/.test(value), "رقم RIB المغربي يجب أن يتكون من 24 رقمًا").optional(),
  bankName: optionalText(120),
  swiftCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{8}(?:[A-Z0-9]{3})?$/, "رمز SWIFT غير صحيح").optional().or(z.literal("")),
  branchName: optionalText(140),
  referenceNote: optionalText(280),
}).strict();

export const cashTransferDetailsSchema = z.object({
  beneficiaryName: optionalText(140),
  agencyNetwork: optionalText(100),
  agencyInstructions: optionalText(1200),
}).strict();

export const paymentGatewayConfigSchema = z.object({
  provider: gatewayProviderSchema,
  merchantId: optionalText(160),
  environment: z.enum(["sandbox", "production"]),
  callbackPath: z.string().trim().regex(/^\/api\/payments\/gateways\/[a-z0-9-]+\/callback$/, "مسار الإشعار الداخلي غير صحيح").optional().or(z.literal("")),
  hostedPageUrl: z.url("رابط صفحة الدفع المستضافة غير صحيح").refine((value) => value.startsWith("https://"), "يجب أن يبدأ رابط الصفحة المستضافة بـ https://").optional().or(z.literal("")),
  status: z.enum(["draft", "testing", "active"]),
}).strict();

const paymentMethodFields = {
  title: z.string().trim().min(2, "اسم وسيلة الدفع قصير جدًا").max(100, "اسم وسيلة الدفع طويل جدًا"),
  code: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "معرف وسيلة الدفع غير صحيح").min(2).max(60),
  type: paymentMethodTypeSchema,
  status: paymentMethodStatusSchema.default("draft"),
  scope: paymentScopeSchema.default("both"),
  instructions: z.string().trim().max(2400, "تعليمات الدفع طويلة جدًا").default(""),
  bankDetails: bankDetailsSchema.optional(),
  cashTransferDetails: cashTransferDetailsSchema.optional(),
  gatewayConfig: paymentGatewayConfigSchema.optional(),
  sortOrder: z.number().int().min(0).max(10000).default(100),
  provider: legacyProviderSchema.optional(),
};

export const paymentMethodCreateSchema = z.object(paymentMethodFields).superRefine((method, context) => {
  const message = validatePaymentMethod(method);
  if (message) context.addIssue({ code: "custom", message });
});
export const paymentMethodPatchSchema = z.object(paymentMethodFields).partial().refine((value) => Object.keys(value).length > 0, "لا يوجد تغيير للحفظ");

/**
 * يطبق على السجل الفعال بعد دمج الطلب الجزئي مع السجل المخزن.
 * لا يحفظ هذا العقد أي مفاتيح أو كلمات مرور أو أسرار لمزودي الدفع.
 */
export function validatePaymentMethod(method: Pick<PaymentMethod, "type" | "status" | "instructions" | "provider" | "bankDetails" | "cashTransferDetails" | "gatewayConfig">) {
  if (method.type === "bank_transfer") {
    if (method.cashTransferDetails || method.gatewayConfig) return "لا يمكن خلط تفاصيل التحويل البنكي مع تفاصيل شبكة أو بوابة دفع.";
    if (method.status === "active") {
      if (!method.bankDetails?.beneficiaryName || !method.bankDetails.bankName || !method.bankDetails.rib || !method.bankDetails.referenceNote) {
        return "أدخل اسم المستفيد واسم البنك وRIB وتعليمات المرجع قبل تفعيل التحويل البنكي.";
      }
      if (method.instructions.trim().length < 8) return "اكتب تعليمات تحويل واضحة قبل تفعيل الوسيلة.";
    }
  }

  if (method.type === "cash_transfer") {
    if (method.bankDetails || method.gatewayConfig) return "لا يمكن خلط تفاصيل التحويل النقدي مع تفاصيل بنك أو بوابة دفع.";
    if (method.status === "active") {
      if (!method.cashTransferDetails?.beneficiaryName || !method.cashTransferDetails.agencyNetwork || !method.cashTransferDetails.agencyInstructions || method.cashTransferDetails.agencyInstructions.trim().length < 8) {
        return "أدخل شبكة الوكالة واسم المستفيد وخطوات الوكالة قبل تفعيل التحويل النقدي.";
      }
      if (method.instructions.trim().length < 8) return "اكتب تعليمات تحويل واضحة قبل تفعيل الوسيلة.";
    }
  }

  if (method.type === "electronic_gateway") {
    if (method.bankDetails || method.cashTransferDetails) return "لا يمكن خلط إعدادات البوابة الإلكترونية مع تفاصيل تحويل يدوي.";
    if (!method.gatewayConfig && !method.provider) return "حدد مزود البوابة الإلكترونية في إعدادات المسودة.";
    if (method.status === "active") return "لا يمكن تفعيل بوابة إلكترونية قبل العقد الرسمي والربط الخادمي واختبارها.";
    if (method.gatewayConfig && (method.gatewayConfig.status !== "draft" || method.gatewayConfig.environment !== "sandbox")) {
      return "تبقى إعدادات البوابة الإلكترونية في وضع المسودة وبيئة الاختبار حتى استكمال العقد والربط الرسمي.";
    }
  }

  return null;
}

export function providerForPaymentMethod(method: Pick<PaymentMethod, "type" | "provider" | "gatewayConfig">) {
  if (method.type !== "electronic_gateway") return "custom" as const;
  return method.gatewayConfig?.provider || method.provider || "custom";
}
