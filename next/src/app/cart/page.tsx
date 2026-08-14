import { BottomNav, Header } from "@/components/header";
import { CartConsole } from "@/components/cart-console";
import { getStorefrontSnapshot } from "@/lib/repository";

export default async function CartPage() {
  const snapshot = await getStorefrontSnapshot();
  return <><Header /><CartConsole services={snapshot.services} /><BottomNav /></>;
}
