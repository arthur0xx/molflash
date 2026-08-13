import { Header } from "@/components/header";
import { AdminConsole } from "@/components/admin-console";
import { AdminAccessGate } from "@/components/admin-access-gate";
import { getSnapshot } from "@/lib/repository";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const snapshot = await getSnapshot();
  return <><Header /><main className="cmc-shell"><AdminAccessGate><AdminConsole initial={snapshot} /></AdminAccessGate></main></>;
}
