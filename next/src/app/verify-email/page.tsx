import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyEmailConsole } from "@/components/verify-email-console";

export const metadata: Metadata = {
  title: "تأكيد البريد الإلكتروني | ChriGsm",
  description: "خطوة تأكيد البريد الإلكتروني الخاصة بحساب ChriGsm.",
  robots: { index: false, follow: false },
};

function LoadingVerifyPage() {
  return <main className="auth-action-page"><section className="auth-action-card"><p className="eyebrow">ChriGsm</p><h1>جارٍ فتح صفحة التفعيل…</h1><p>نحضّر خطوة تأكيد بريدك الإلكتروني.</p></section></main>;
}

export default function VerifyEmailPage() {
  return <Suspense fallback={<LoadingVerifyPage />}><VerifyEmailConsole /></Suspense>;
}
