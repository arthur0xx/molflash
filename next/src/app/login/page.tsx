import { Suspense } from "react";
import { Header } from "@/components/header";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return <><Header /><Suspense fallback={<main className="login-page"><p className="muted-text">جارٍ تجهيز صفحة الدخول...</p></main>}><LoginForm /></Suspense></>;
}
