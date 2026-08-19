import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteFooter } from "@/components/site-footer";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { AppLoadingSplash } from "@/components/app-loading-splash";

const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://temporary-speedy-jade-mdelya8.vercel.app");
const title = "ChriGsm | تفعيل أدوات صيانة الهواتف وGSM بالمغرب";
const description = "ChriGsm منصة مغربية لخدمات GSM الرقمية: تفعيل واشتراكات أدوات صيانة الهواتف وبرامج المخططات، مع طلب واضح ومتابعة آمنة.";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b2c5d",
};

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: title,
    template: "%s | ChriGsm",
  },
  description,
  applicationName: "ChriGsm",
  keywords: ["ChriGsm", "GSM المغرب", "تفعيل أدوات GSM", "برامج صيانة الهواتف", "برامج مخططات الهواتف", "خدمات صيانة الهواتف الرقمية"],
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
    images: [{ url: "/brand/cg-social.png", width: 1200, height: 630, alt: "ChriGsm — تفعيل أدوات صيانة الهواتف وخدمات GSM الرقمية" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/brand/cg-social.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ar" dir="rtl"><body><AppLoadingSplash />{children}<PwaInstallPrompt /><SiteFooter /></body></html>;
}
