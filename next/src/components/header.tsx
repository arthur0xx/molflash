"use client";

import Image from "next/image";
import Link from "next/link";
import { Grid2X2, Home, ShoppingBag, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getAuthSession, type AuthSession } from "@/lib/auth";
import { getCartItems } from "@/lib/cart";

const navigation = [{ href: "/", label: "الرئيسية" }, { href: "/catalog", label: "الخدمات" }];

function isCurrent(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

function useCartCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const refresh = () => setCount(getCartItems().length);
    refresh();
    window.addEventListener("chrigsm:cart-changed", refresh);
    return () => window.removeEventListener("chrigsm:cart-changed", refresh);
  }, []);
  return count;
}

function useSession() {
  const [session, setSession] = useState<AuthSession | null>(null);
  useEffect(() => {
    const refresh = () => setSession(getAuthSession());
    refresh();
    window.addEventListener("chrigsm:auth-session", refresh);
    return () => window.removeEventListener("chrigsm:auth-session", refresh);
  }, []);
  return session;
}

export function Header() {
  const pathname = usePathname();
  const session = useSession();
  const accountHref = session?.role === "admin" || session?.role === "manager" ? "/admin" : session ? "/account" : "/login";
  const cartHref = session ? "/cart" : "/login?next=/cart";
  const cartCount = useCartCount();
  return <header className="site-header">
    <Link href="/" className="brand" aria-label="ChriGsm الرئيسية"><span className="brand-mark" aria-hidden="true"><Image src="/brand/cg-logo.png" alt="" width={36} height={36} priority /></span><span>ChriGsm</span></Link>
    <nav className="top-nav" aria-label="التنقل الرئيسي">{navigation.map((item) => <Link key={item.href} href={item.href} className={isCurrent(pathname, item.href) ? "nav-current" : ""} aria-current={isCurrent(pathname, item.href) ? "page" : undefined}>{item.label}</Link>)}</nav>
    <div className="header-actions"><Link className={`icon-button ${isCurrent(pathname, accountHref) ? "icon-current" : ""}`} href={accountHref} aria-label={session ? session.fullName : "تسجيل الدخول"}><UserRound size={19} /></Link><Link className="icon-button cart-dot" href={cartHref} aria-label={session ? "قائمة الخدمات المختارة" : "سجّل الدخول لرؤية خدماتك المختارة"}><ShoppingBag size={19} /><span>{session ? cartCount : 0}</span></Link></div>
  </header>;
}

export function BottomNav() {
  const pathname = usePathname();
  const session = useSession();
  const accountHref = session?.role === "admin" || session?.role === "manager" ? "/admin" : session ? "/account" : "/login";
  const items = [{ href: "/", label: "الرئيسية", icon: <Home size={18} /> }, { href: "/catalog", label: "الخدمات", icon: <Grid2X2 size={18} /> }, { href: accountHref, label: session?.role === "admin" || session?.role === "manager" ? "الإدارة" : session ? "حسابي" : "دخول", icon: <UserRound size={18} /> }];
  return <nav className="bottom-nav" aria-label="تنقل الهاتف">{items.map((item) => <Link key={item.href} href={item.href} className={isCurrent(pathname, item.href) ? "nav-current" : ""} aria-current={isCurrent(pathname, item.href) ? "page" : undefined}>{item.icon}<span>{item.label}</span></Link>)}</nav>;
}
