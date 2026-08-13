"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageCircle, WalletCards } from "lucide-react";
import type { DemoSnapshot } from "@/lib/types";
import { formatMAD, statusLabels } from "@/lib/types";
import { getBrowserDemoOrders, type BrowserDemoOrder } from "@/lib/demo-browser";

const orderTone = (status: BrowserDemoOrder["status"]) => ({ new: "blue", processing: "amber", waiting: "violet", completed: "green", rejected: "red" }[status]);

export function AccountConsole({ initial }: { initial: DemoSnapshot }) {
  const customer = initial.customers[0];
  const baseOrders = initial.orders.filter((order) => order.customerId === customer.id).map((order) => ({ id: order.id, serviceId: order.serviceId, serviceTitle: initial.services.find((service) => service.id === order.serviceId)?.title || "خدمة", totalMad: order.totalMad, status: order.status, createdAt: order.updatedAt, answers: {} }));
  const [browserOrders, setBrowserOrders] = useState<BrowserDemoOrder[]>([]);
  useEffect(() => {
    const refresh = () => setBrowserOrders(getBrowserDemoOrders());
    refresh(); window.addEventListener("chrigsm:demo-order", refresh); window.addEventListener("storage", refresh);
    return () => { window.removeEventListener("chrigsm:demo-order", refresh); window.removeEventListener("storage", refresh); };
  }, []);
  const orders = useMemo(() => [...browserOrders, ...baseOrders], [browserOrders, baseOrders]);
  return <main className="store-shell">
    <section className="account-hero"><div><p className="eyebrow">منطقة العميل</p><h1>مرحبًا، {customer.fullName}</h1><p>{customer.email}</p></div><div className="wallet-hero"><WalletCards size={22}/><span>رصيد المحفظة</span><strong>{formatMAD(customer.walletMad)}</strong></div></section>
    <section className="section-block"><div className="section-title"><div><p className="eyebrow">متابعة مباشرة</p><h2>طلباتي</h2></div><span className="muted-text">{orders.length} طلبات تجريبية</span></div><div className="order-list">{orders.map((order) => <article key={order.id} className="order-row"><div><p className="eyebrow">{order.id}</p><h3>{order.serviceTitle}</h3><p>{order.createdAt.slice(0, 10)}{browserOrders.some((item) => item.id === order.id) && " · محفوظ على هذا المتصفح"}</p></div><div className="order-value"><span className={`status-pill ${orderTone(order.status)}`}>{statusLabels[order.status]}</span><strong>{formatMAD(order.totalMad)}</strong></div></article>)}</div></section>
    <section className="support-card"><div className="support-icon"><MessageCircle size={23}/></div><div><h3>الدعم وWhatsApp</h3><p>سيُربط هذا المكان بأحدث طلب مفتوح عند تفعيل WhatsApp Business في النسخة الحقيقية.</p></div><button type="button" className="support-link" onClick={() => window.alert("دعم WhatsApp مؤجل للنسخة الحقيقية. الطلبات التجريبية ظاهرة في حسابك الآن.")}>فتح الدعم</button></section>
  </main>;
}
