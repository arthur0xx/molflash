"use client";

import Link from "next/link";
import { LockKeyhole, ShieldAlert } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState, type ReactNode } from "react";
import { getAuthSession, refreshAuthSession, type AuthSession } from "@/lib/auth";
import { firebaseServices } from "@/lib/firebase/client";

export function AdminAccessGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null | undefined>(() => firebaseServices() ? undefined : null);
  useEffect(() => {
    let active = true;
    const refresh = () => setSession(getAuthSession());
    const services = firebaseServices();
    if (!services) return;
    const unsubscribe = onAuthStateChanged(services.auth, async (user) => {
      if (!user) { if (active) setSession(null); return; }
      try {
        const current = await refreshAuthSession();
        if (active) setSession(current);
      } catch {
        if (active) refresh();
      }
    });
    window.addEventListener("chrigsm:auth-session", refresh);
    return () => { active = false; unsubscribe(); window.removeEventListener("chrigsm:auth-session", refresh); };
  }, []);
  if (session === undefined) return <main className="access-state"><span className="brand-mark">CG</span><p>جارٍ التحقق من صلاحية الإدارة...</p></main>;
  if (session?.role === "admin" || session?.role === "manager") return <>{children}</>;
  return <main className="access-state"><span className="access-icon"><ShieldAlert size={30}/></span><p className="eyebrow">وصول محمي</p><h1>لوحة CMC محمية</h1><p>{session ? "الحساب الحالي لا يملك صلاحية إدارة المتجر." : "سجّل الدخول بحساب مدير للوصول إلى إدارة الطلبات والعملاء والخدمات."}</p><Link href="/login" className="primary-button"><LockKeyhole size={16}/> تسجيل دخول المدير</Link><small>تُتاح لوحة CMC للمالك والمشرفين المخوّلين فقط.</small></main>;
}
