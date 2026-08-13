"use client";

import { LogOut, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDemoSession, signOutDemo, type DemoSession } from "@/lib/demo-auth";

export function AdminSessionControls() {
  const router = useRouter();
  const [session, setSession] = useState<DemoSession | null>(null);
  useEffect(() => { const refresh = () => setSession(getDemoSession()); refresh(); window.addEventListener("chrigsm:demo-session", refresh); return () => window.removeEventListener("chrigsm:demo-session", refresh); }, []);
  if (!session) return null;
  return <section className="admin-session-card"><span><ShieldCheck size={21}/></span><div><p>جلسة المدير التجريبية</p><b>{session.fullName}</b><small>{session.phone} · {session.email}</small></div><button className="danger-button" onClick={() => { signOutDemo(); router.push("/login"); }}><LogOut size={15}/> تسجيل الخروج</button></section>;
}
