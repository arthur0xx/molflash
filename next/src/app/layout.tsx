import type { Metadata } from "next";
import "./globals.css";
import { SiteFooter } from "@/components/site-footer";

const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://temporary-speedy-jade-mdelya8.vercel.app");
const title = "ChriGsm | خدمات GSM الرقمية";
const description = "ChriGsm متجر مغربي لشراء خدمات GSM الرقمية: التفعيل، الأدوات، وخدمات الأجهزة مع متابعة واضحة للطلبات.";

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: title,
    template: "%s | ChriGsm",
  },
  description,
  applicationName: "ChriGsm",
  keywords: ["ChriGsm", "GSM المغرب", "خدمات GSM", "تفعيل GSM", "أدوات GSM", "خدمات رقمية"],
  authors: [{ name: "ChriGsm" }],
  creator: "ChriGsm",
  publisher: "ChriGsm",
  category: "خدمات رقمية",
  alternates: { canonical: "/" },
  manifest: "/site.webmanifest",
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  icons: {
    icon: [{ url: "/icon.png", type: "image/png", sizes: "512x512" }, { url: "/favicon.ico", sizes: "any" }],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    locale: "ar_MA",
    url: "/",
    siteName: "ChriGsm",
    title,
    description,
    images: [{ url: "/brand/cg-social.png", width: 1200, height: 630, alt: "ChriGsm — خدمات GSM الرقمية" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/brand/cg-social.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ar" dir="rtl"><body>{children}<SiteFooter /></body></html>;
}
