import { MessageCircle, WalletCards } from "lucide-react";
import { BottomNav, Header } from "@/components/header";
import { getSnapshot, orderTone } from "@/lib/repository";
import { formatMAD, statusLabels } from "@/lib/types";

export default async function AccountPage() {
  const snapshot = await getSnapshot();
  const customer = snapshot.customers[0];
  const orders = snapshot.orders.filter((order) => order.customerId === customer.id);
  return <><Header /><main className="store-shell">
    <section className="account-hero"><div><p className="eyebrow">منطقة العميل</p><h1>مرحبًا، {customer.fullName}</h1><p>{customer.email}</p></div><div className="wallet-hero"><WalletCards size={22}/><span>رصيد المحفظة</span><strong>{formatMAD(customer.walletMad)}</strong></div></section>
    <section className="section-block"><div className="section-title"><div><p className="eyebrow">متابعة مباشرة</p><h2>طلباتي</h2></div><span className="muted-text">{orders.length} طلبات تجريبية</span></div><div className="order-list">{orders.map((order) => { const service = snapshot.services.find((item) => item.id === order.serviceId); return <article key={order.id} className="order-row"><div><p className="eyebrow">{order.id}</p><h3>{service?.title}</h3><p>{order.updatedAt.slice(0, 10)}</p></div><div className="order-value"><span className={`status-pill ${orderTone(order.status)}`}>{statusLabels[order.status]}</span><strong>{formatMAD(order.totalMad)}</strong>{order.deliveryCode && <code>{order.deliveryCode}</code>}</div></article>; })}</div></section>
    <section className="support-card"><div className="support-icon"><MessageCircle size={23}/></div><div><h3>الدعم وWhatsApp</h3><p>هذا الزر تجريبي. عند تفعيل WhatsApp Business، سيتم ربطه بآخر طلب مفتوح تلقائيًا.</p></div><button className="support-link">فتح الدعم</button></section>
  </main><BottomNav /></>;
}
