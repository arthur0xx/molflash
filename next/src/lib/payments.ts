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

export function toPaymentMethodSnapshot(method: PaymentMethodSnapshot): PaymentMethodSnapshot {
  return {
    title: method.title,
    type: method.type,
    instructions: method.instructions,
    ...(method.bankDetails ? { bankDetails: method.bankDetails } : {}),
    ...(method.cashTransferDetails ? { cashTransferDetails: method.cashTransferDetails } : {}),
  };
}

export function renderPaymentInstructions(template: string, values: Record<string, string>) {
  return template.replace(/\{([a-zA-Z]+)\}/g, (match, token: string) => permittedInstructionTokens.has(token) ? values[token] || "" : match);
}

/** يعرض تفاصيل مهيكلة من لقطة التحويل نفسها، لا من وسيلة الدفع القابلة للتعديل لاحقًا. */
export function renderPaymentSnapshotInstructions(snapshot: PaymentMethodSnapshot, values: Record<string, string>) {
  const lines = [renderPaymentInstructions(snapshot.instructions, values).trim()].filter(Boolean);
  if (snapshot.type === "bank_transfer" && snapshot.bankDetails) {
    const { beneficiaryName, bankName, rib, branchName, swiftCode, referenceNote } = snapshot.bankDetails;
    if (beneficiaryName) lines.push(`اسم المستفيد: ${beneficiaryName}`);
    if (bankName) lines.push(`البنك: ${bankName}`);
    if (rib) lines.push(`RIB: ${rib}`);
    if (branchName) lines.push(`الفرع: ${branchName}`);
    if (swiftCode) lines.push(`SWIFT: ${swiftCode}`);
    if (referenceNote) lines.push(referenceNote);
  }
  if (snapshot.type === "cash_transfer" && snapshot.cashTransferDetails) {
    const { agencyNetwork, beneficiaryName, agencyInstructions } = snapshot.cashTransferDetails;
    if (agencyNetwork) lines.push(`شبكة التحويل: ${agencyNetwork}`);
    if (beneficiaryName) lines.push(`اسم المستفيد: ${beneficiaryName}`);
    if (agencyInstructions) lines.push(agencyInstructions);
  }
  return lines.join("\n\n");
}

export function expiresPaymentReference(now = new Date(), hours = 48) {
  const value = new Date(now);
  value.setHours(value.getHours() + hours);
  return value.toISOString();
}
