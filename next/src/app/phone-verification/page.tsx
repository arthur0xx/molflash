import type { Metadata } from "next";
import { PhoneVerificationConsole } from "@/components/phone-verification-console";

export const metadata: Metadata = {
  title: "تفعيل رقم واتساب | ChriGsm",
  description: "تأكيد رقم واتساب لحماية حساب ChriGsm.",
  robots: { index: false, follow: false },
};

export default function PhoneVerificationPage() {
  return <PhoneVerificationConsole />;
}
