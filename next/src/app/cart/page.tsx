import { BottomNav, Header } from "@/components/header";
import { CartConsole } from "@/components/cart-console";
import { getSnapshot } from "@/lib/repository";

export default async function CartPage() {
  const snapshot = await getSnapshot();
  return <><Header /><CartConsole services={snapshot.services} /><BottomNav /></>;
}
