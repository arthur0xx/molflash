"use client";

import { LogOut, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthSession, signOut, type AuthSession } from "@/lib/auth";

export function AdminSessionControls() {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  useEffect(() => {
    const refresh = () => setSession(getAuthSession());
    refresh();
    window.addEventListener("chrigsm:auth-session", refresh);
    return () => window.removeEventListener("chrigsm:auth-session", refresh);
  }, []);
  if (!session) return null;
  return <section className="admin-session-card"><span><ShieldCheck size={21}/></span><div><p>جلسة المدير</p><b>{session.fullName}</b><small>{session.phone} · {session.email}</small></div><button className="danger-button" onClick={() => { signOut(); router.push("/login"); }}><LogOut size={15}/> تسجيل الخروج</button></section>;
}
