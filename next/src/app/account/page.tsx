import { BottomNav, Header } from "@/components/header";
import { AccountConsole } from "@/components/account-console";
import { getSnapshot } from "@/lib/repository";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const snapshot = await getSnapshot();
  return <><Header /><AccountConsole initial={snapshot} /><BottomNav /></>;
}
