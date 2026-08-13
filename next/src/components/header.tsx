"use client";

import Link from "next/link";
import { Grid2X2, Home, ShoppingBag, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getDemoSession, type DemoSession } from "@/lib/demo-auth";
import { getBrowserCartItems } from "@/lib/demo-cart";

const navigation = [{ href: "/", label: "الرئيسية" }, { href: "/catalog", label: "الخدمات" }];

function isCurrent(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

function useCartCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const refresh = () => setCount(getBrowserCartItems().length);
    refresh();
    window.addEventListener("chrigsm:demo-cart", refresh);
    return () => window.removeEventListener("chrigsm:demo-cart", refresh);
  }, []);
  return count;
}

function useSession() {
  const [session, setSession] = useState<DemoSession | null>(null);
  useEffect(() => {
    const refresh = () => setSession(getDemoSession());
    refresh();
    window.addEventListener("chrigsm:demo-session", refresh);
    return () => window.removeEventListener("chrigsm:demo-session", refresh);
  }, []);
  return session;
}

export function Header() {
  const pathname = usePathname();
  const session = useSession();
  const accountHref = session?.role === "admin" ? "/admin" : session ? "/account" : "/login";
  const cartHref = session ? "/cart" : "/login?next=/cart";
  const cartCount = useCartCount();
  return <header className="site-header">
    <Link href="/" className="brand" aria-label="ChriGsm الرئيسية">
      <span className="brand-mark" aria-hidden="true">CG</span><span>ChriGsm</span>
    </Link>
    <nav className="top-nav" aria-label="التنقل الرئيسي">
      {navigation.map((item) => <Link key={item.href} href={item.href} className={isCurrent(pathname, item.href) ? "nav-current" : ""} aria-current={isCurrent(pathname, item.href) ? "page" : undefined}>{item.label}</Link>)}
    </nav>
    <div className="header-actions">
      <Link className={`icon-button ${isCurrent(pathname, accountHref) ? "icon-current" : ""}`} href={accountHref} aria-label={session ? session.fullName : "تسجيل الدخول"}><UserRound size={19} /></Link>
      <Link className="icon-button cart-dot" href={cartHref} aria-label={session ? "السلة" : "سجل الدخول لرؤية السلة"}><ShoppingBag size={19} /><span>{session ? cartCount : 0}</span></Link>
    </div>
  </header>;
}

export function BottomNav() {
  const pathname = usePathname();
  const session = useSession();
  const accountHref = session?.role === "admin" ? "/admin" : session ? "/account" : "/login";
  const items = [
    { href: "/", label: "الرئيسية", icon: <Home size={18} /> },
    { href: "/catalog", label: "الخدمات", icon: <Grid2X2 size={18} /> },
    { href: accountHref, label: session?.role === "admin" ? "الإدارة" : session ? "حسابي" : "دخول", icon: <UserRound size={18} /> },
  ];
  return <nav className="bottom-nav" aria-label="تنقل الهاتف">{items.map((item) => <Link key={item.href} href={item.href} className={isCurrent(pathname, item.href) ? "nav-current" : ""} aria-current={isCurrent(pathname, item.href) ? "page" : undefined}>{item.icon}<span>{item.label}</span></Link>)}</nav>;
}
