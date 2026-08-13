"use client";

import Link from "next/link";
import { Grid2X2, Home, LayoutDashboard, ShoppingBag, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getDemoSession, type DemoSession } from "@/lib/demo-auth";

const navigation = [
  { href: "/catalog", label: "الخدمات" },
  { href: "/account", label: "حسابي" },
  { href: "/admin", label: "CMC" },
];

function isCurrent(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

export function Header() {
  const pathname = usePathname();
  const [session, setSession] = useState<DemoSession | null>(null);
  useEffect(() => { const refresh = () => setSession(getDemoSession()); refresh(); window.addEventListener("chrigsm:demo-session", refresh); return () => window.removeEventListener("chrigsm:demo-session", refresh); }, []);
  const accountHref = session?.role === "admin" ? "/admin" : session ? "/account" : "/login";
  return <header className="site-header">
    <Link href="/" className="brand" aria-label="ChriGsm الرئيسية">
      <span className="brand-mark" aria-hidden="true">CG</span><span>ChriGsm</span>
    </Link>
    <nav className="top-nav" aria-label="التنقل الرئيسي">
      {navigation.map((item) => <Link key={item.href} href={item.href} className={isCurrent(pathname, item.href) ? "nav-current" : ""} aria-current={isCurrent(pathname, item.href) ? "page" : undefined}>{item.label}</Link>)}
    </nav>
    <div className="header-actions">
      <Link className={`icon-button ${isCurrent(pathname, accountHref) ? "icon-current" : ""}`} href={accountHref} aria-label={session ? session.fullName : "تسجيل الدخول"}><UserRound size={19} /></Link>
      <Link className="icon-button cart-dot" href="/catalog" aria-label="السلة التجريبية"><ShoppingBag size={19} /><span>0</span></Link>
    </div>
  </header>;
}

export function BottomNav() {
  const pathname = usePathname();
  const items = [
    { href: "/", label: "الرئيسية", icon: <Home size={18} /> },
    { href: "/catalog", label: "الخدمات", icon: <Grid2X2 size={18} /> },
    { href: "/account", label: "حسابي", icon: <UserRound size={18} /> },
    { href: "/admin", label: "CMC", icon: <LayoutDashboard size={18} /> },
  ];
  return <nav className="bottom-nav" aria-label="تنقل الهاتف">{items.map((item) => <Link key={item.href} href={item.href} className={isCurrent(pathname, item.href) ? "nav-current" : ""} aria-current={isCurrent(pathname, item.href) ? "page" : undefined}>{item.icon}<span>{item.label}</span></Link>)}</nav>;
}
