"use client";

import { useEffect, useState } from "react";
import { Banknote, Building2, Check, Copy, Landmark, ListChecks, UserRound } from "lucide-react";
import type { PaymentMethodSnapshot } from "@/lib/types";

const structuredLinePrefixes = ["اسم المستفيد:", "البنك:", "RIB:", "الفرع:", "SWIFT:", "شبكة التحويل:", "خطوات الوكالة:"];

function renderReferenceNote(value: string, paymentReference: string) {
  return value.replaceAll("{paymentReference}", paymentReference).replaceAll("{amount}", "المبلغ المعروض أعلاه");
}

function CopyValueButton({ value, label, onCopied }: { value: string; label: string; onCopied: (label: string) => void }) {
  async function copyValue() {
    try {
      await navigator.clipboard.writeText(value);
      onCopied(label);
    } catch {
      onCopied(`تعذر نسخ ${label} تلقائيًا`);
    }
  }

  return <button type="button" className="payment-detail-copy" onClick={() => { void copyValue(); }} aria-label={`نسخ ${label}`} title={`نسخ ${label}`}><Copy size={15}/><span>نسخ</span></button>;
}

function PaymentDetailRow({ label, value, copyable = false, onCopied }: { label: string; value: string; copyable?: boolean; onCopied: (label: string) => void }) {
  return <div className="payment-detail-row"><span>{label}</span><div><code dir="auto">{value}</code>{copyable && <CopyValueButton value={value} label={label} onCopied={onCopied}/>}</div></div>;
}

export function PaymentTransferDetails({ methodSnapshot, paymentReference, fallbackInstructions }: { methodSnapshot: PaymentMethodSnapshot; paymentReference: string; fallbackInstructions: string }) {
  const [copyNotice, setCopyNotice] = useState("");
  const bank = methodSnapshot.bankDetails;
  const cash = methodSnapshot.cashTransferDetails;
  const hasBankDetails = Boolean(bank?.beneficiaryName || bank?.bankName || bank?.rib || bank?.referenceNote || bank?.branchName || bank?.swiftCode);
  const hasCashDetails = Boolean(cash?.beneficiaryName || cash?.agencyNetwork || cash?.agencyInstructions);
  const generalInstructions = fallbackInstructions.split(/\n+/).map((line) => line.trim()).filter((line) => line && !structuredLinePrefixes.some((prefix) => line.startsWith(prefix)));

  useEffect(() => {
    if (!copyNotice) return;
    const timeout = window.setTimeout(() => setCopyNotice(""), 2200);
    return () => window.clearTimeout(timeout);
  }, [copyNotice]);

  if (!hasBankDetails && !hasCashDetails) return <pre className="payment-instructions-fallback">{fallbackInstructions}</pre>;

  return <section className="payment-transfer-details" aria-label="تفاصيل التحويل"><div className="payment-transfer-details-heading">{hasBankDetails ? <Landmark size={18} aria-hidden="true"/> : <Banknote size={18} aria-hidden="true"/>}<div><b>{hasBankDetails ? "بيانات التحويل البنكي" : "بيانات التحويل عبر الوكالة"}</b><small>انسخ البيانات كما هي، ثم أرفق إثبات التحويل.</small></div></div>{hasBankDetails && <div className="payment-detail-card"><div className="payment-detail-card-title"><Building2 size={16} aria-hidden="true"/><b>بيانات المستفيد</b></div>{bank?.beneficiaryName && <PaymentDetailRow label="اسم المستفيد" value={bank.beneficiaryName} copyable onCopied={setCopyNotice}/>} {bank?.bankName && <PaymentDetailRow label="البنك" value={bank.bankName} onCopied={setCopyNotice}/>} {bank?.rib && <PaymentDetailRow label="RIB" value={bank.rib.replace(/\s+/g, "")} copyable onCopied={setCopyNotice}/>} {bank?.branchName && <PaymentDetailRow label="الفرع" value={bank.branchName} onCopied={setCopyNotice}/>} {bank?.swiftCode && <PaymentDetailRow label="SWIFT" value={bank.swiftCode} copyable onCopied={setCopyNotice}/>}</div>}{hasBankDetails && bank?.referenceNote && <div className="payment-transfer-reference-note"><ListChecks size={16} aria-hidden="true"/><p>{renderReferenceNote(bank.referenceNote, paymentReference)}</p></div>}{hasCashDetails && <div className="payment-detail-card"><div className="payment-detail-card-title"><UserRound size={16} aria-hidden="true"/><b>بيانات الوكالة</b></div>{cash?.agencyNetwork && <PaymentDetailRow label="شبكة التحويل" value={cash.agencyNetwork} onCopied={setCopyNotice}/>} {cash?.beneficiaryName && <PaymentDetailRow label="اسم المستفيد" value={cash.beneficiaryName} copyable onCopied={setCopyNotice}/>} {cash?.agencyInstructions && <div className="payment-transfer-steps"><b>خطوات الوكالة</b><p>{cash.agencyInstructions}</p></div>}</div>}{generalInstructions.length > 0 && <div className="payment-transfer-extra"><b>تعليمات إضافية</b>{generalInstructions.map((line) => <p key={line}>{line}</p>)}</div>}{copyNotice && <span className="payment-copy-feedback" role="status"><Check size={14}/>{copyNotice}</span>}</section>;
}
