import { Header } from "@/components/header";
import { AdminConsole } from "@/components/admin-console";
import { getSnapshot } from "@/lib/repository";

export default async function AdminPage() {
  const snapshot = await getSnapshot();
  return <><Header /><main className="cmc-shell"><AdminConsole initial={snapshot} /></main></>;
}
