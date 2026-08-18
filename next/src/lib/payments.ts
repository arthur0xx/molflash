import "server-only";

import { randomBytes } from "crypto";
import type { PaymentMethodSnapshot } from "@/lib/types";

const referenceAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const permittedInstructionTokens = new Set(["amount", "paymentReference", "orderNumber", "walletTopUpNumber"]);

/** مرجع عام للمطابقة فقط، وليس كلمة مرور أو تفويضًا لتأكيد الدفع. */
export function generatePaymentReference() {
  const bytes = randomBytes(8);
  let token = "";
  for (const byte of bytes) token += referenceAlphabet[byte % referenceAlphabet.length];
  return `CHR-${token.slice(0, 8)}`;
}

export function toPaymentMethodSnapshot(method: { title: string; type: PaymentMethodSnapshot["type"]; instructions: string }): PaymentMethodSnapshot {
  return { title: method.title, type: method.type, instructions: method.instructions };
}

export function renderPaymentInstructions(template: string, values: Record<string, string>) {
  return template.replace(/\{([a-zA-Z]+)\}/g, (match, token: string) => permittedInstructionTokens.has(token) ? values[token] || "" : match);
}

export function expiresPaymentReference(now = new Date(), hours = 48) {
  const value = new Date(now);
  value.setHours(value.getHours() + hours);
  return value.toISOString();
}
