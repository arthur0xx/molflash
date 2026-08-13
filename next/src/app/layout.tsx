import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChriGsm | خدمات GSM الرقمية",
  description: "متجر ChriGsm ولوحة CMC لإدارة الخدمات الرقمية GSM.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
