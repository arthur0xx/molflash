import Link from "next/link";
import { LayoutDashboard, Search, ShoppingBag, UserRound } from "lucide-react";

export function Header() {
  return (
    <header className="site-header">
      <Link href="/" className="brand" aria-label="ChriGsm الرئيسية">
        <span className="brand-mark">CG</span>
        <span>ChriGsm</span>
      </Link>
      <nav className="top-nav" aria-label="التنقل الرئيسي">
        <Link href="/catalog">الخدمات</Link>
        <Link href="/account">حسابي</Link>
        <Link href="/admin">CMC</Link>
      </nav>
      <div className="header-actions">
        <button className="icon-button" aria-label="بحث"><Search size={19} /></button>
        <Link className="icon-button" href="/account" aria-label="حسابي"><UserRound size={19} /></Link>
        <Link className="icon-button cart-dot" href="/catalog" aria-label="السلة"><ShoppingBag size={19} /><span>0</span></Link>
      </div>
    </header>
  );
}

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="تنقل الهاتف">
      <Link href="/"><span>⌂</span>الرئيسية</Link>
      <Link href="/catalog"><Search size={18} />الخدمات</Link>
      <Link href="/account"><UserRound size={18} />حسابي</Link>
      <Link href="/admin"><LayoutDashboard size={18} />CMC</Link>
    </nav>
  );
}
