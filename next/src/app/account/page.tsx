import type { Metadata } from "next";
import { BottomNav, Header } from "@/components/header";
import { AccountConsole } from "@/components/account-console";

export const metadata: Metadata = {
  title: "حساب ChriGsm",
  description: "منطقة العميل الخاصة في ChriGsm.",
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return <><Header /><AccountConsole /><BottomNav /></>;
}
