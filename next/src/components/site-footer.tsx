import Link from "next/link";

export function SiteFooter() {
  return <footer className="site-footer"><p>© {new Date().getFullYear()} ChriGsm. خدمة رقمية واضحة ودعم عند الحاجة.</p><nav aria-label="روابط قانونية"><Link href="/terms">الشروط والأحكام</Link><span aria-hidden="true">·</span><Link href="/privacy">سياسة الخصوصية</Link></nav></footer>;
}
