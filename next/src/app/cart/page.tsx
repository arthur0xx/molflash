import type { Metadata } from "next";
import { BottomNav, Header } from "@/components/header";
import { CartConsole } from "@/components/cart-console";
import { getStorefrontSnapshot } from "@/lib/repository";

export const metadata: Metadata = {
  title: "سلة ChriGsm",
  description: "سلة الطلب الخاصة في ChriGsm.",
  robots: { index: false, follow: false },
};

export default async function CartPage() {
  const snapshot = await getStorefrontSnapshot();
  return <><Header /><CartConsole services={snapshot.services} /><BottomNav /></>;
}
