import type { Metadata } from "next";
import { Header } from "@/components/header";
import { AdminConsole } from "@/components/admin-console";
import { AdminAccessGate } from "@/components/admin-access-gate";

export const metadata: Metadata = {
  title: "إدارة ChriGsm",
  description: "لوحة إدارة ChriGsm الخاصة.",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <><Header /><main className="cmc-shell"><AdminAccessGate><AdminConsole /></AdminAccessGate></main></>;
}
