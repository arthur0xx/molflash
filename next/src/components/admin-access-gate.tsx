"use client";

import Link from "next/link";
import { LockKeyhole, ShieldAlert } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { getAuthSession, type AuthSession } from "@/lib/auth";

export function AdminAccessGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null | undefined>(undefined);
  useEffect(() => {
    const refresh = () => setSession(getAuthSession());
    refresh();
    window.addEventListener("chrigsm:auth-session", refresh);
    return () => window.removeEventListener("chrigsm:auth-session", refresh);
  }, []);
  if (session === undefined) return <main className="access-state"><span className="brand-mark">CG</span><p>جارٍ التحقق من صلاحية الإدارة...</p></main>;
  if (session?.role === "admin") return <>{children}</>;
  return <main className="access-state"><span className="access-icon"><ShieldAlert size={30}/></span><p className="eyebrow">وصول محمي</p><h1>لوحة CMC للمدير فقط</h1><p>{session ? "الحساب الحالي لا يملك صلاحية إدارة المتجر." : "سجّل الدخول بحساب مدير للوصول إلى إدارة الطلبات والعملاء والخدمات."}</p><Link href="/login" className="primary-button"><LockKeyhole size={16}/> تسجيل دخول المدير</Link><small>تُتاح لوحة الإدارة للحسابات المخوّلة فقط.</small></main>;
}
