import { Header } from "@/components/header";
import { AdminConsole } from "@/components/admin-console";
import { AdminAccessGate } from "@/components/admin-access-gate";

export default function AdminPage() {
  return <><Header /><main className="cmc-shell"><AdminAccessGate><AdminConsole /></AdminAccessGate></main></>;
}
