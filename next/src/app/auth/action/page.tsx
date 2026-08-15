import { Suspense } from "react";
import { AuthActionConsole } from "@/components/auth-action-console";

function LoadingActionPage() {
  return <main className="auth-action-page"><section className="auth-action-card"><p className="eyebrow">ChriGsm</p><h1>جارٍ فتح الرابط…</h1><p>نحضّر عملية حسابك بأمان.</p></section></main>;
}

export default function AuthActionPage() {
  return <Suspense fallback={<LoadingActionPage />}><AuthActionConsole /></Suspense>;
}
