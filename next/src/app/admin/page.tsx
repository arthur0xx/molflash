import Link from "next/link";
import { ArrowLeft, Boxes, CreditCard, FolderTree, UsersRound } from "lucide-react";
import { Header } from "@/components/header";
import { getSnapshot, orderTone } from "@/lib/repository";
import { formatMAD, statusLabels } from "@/lib/types";

export default async function AdminPage() {
  const snapshot = await getSnapshot();
  const processing = snapshot.orders.filter((order) => order.status === "processing");
  const totalWallet = snapshot.customers.reduce((total, customer) => total + customer.walletMad, 0);
  return <><Header /><main className="cmc-shell">
    <aside className="cmc-sidebar"><div className="cmc-title">ChriGsm <b>CMC</b></div><nav><a className="active" href="#overview">نظرة عامة</a><a href="#orders">الطلبات</a><a href="#folders">المنتجات</a><a href="#customers">العملاء</a><a href="#settings">الإعدادات</a></nav><div className="demo-mode">وضع تجريبي<br/><span>لا بيانات حقيقية</span></div></aside>
    <section className="cmc-content">
      <section id="overview" className="cmc-heading"><div><p className="eyebrow">إدارة العمليات</p><h1>نظرة عامة CMC</h1></div><Link href="/catalog" className="outline-button">عرض المتجر <ArrowLeft size={16}/></Link></section>
      <div className="metric-grid"><Metric icon={<UsersRound/>} label="عملاء نشطون" value={String(snapshot.customers.length)} note="بيانات تجريبية" /><Metric icon={<Boxes/>} label="طلبات جديدة" value={String(snapshot.orders.filter((order) => order.status === "new").length)} note="تحديث لحظي عند Firebase" /><Metric icon={<FolderTree/>} label="قيد المعالجة" value={String(processing.length)} note="تحتاج إجراء" /><Metric icon={<CreditCard/>} label="إجمالي الأرصدة" value={formatMAD(totalWallet)} note="محافظ العملاء" /></div>
      <section id="orders" className="cmc-card"><div className="section-title"><div><p className="eyebrow">المعالجة</p><h2>طلبات تحتاج إجراء</h2></div><button className="filter-button">كل الحالات</button></div><div className="cmc-order-grid">{snapshot.orders.map((order) => { const customer = snapshot.customers.find((item) => item.id === order.customerId); const service = snapshot.services.find((item) => item.id === order.serviceId); return <article className="cmc-order-card" key={order.id}><div className="order-card-top"><span className={`status-pill ${orderTone(order.status)}`}>{statusLabels[order.status]}</span><span>{order.id}</span></div><h3>{service?.title}</h3><p>{customer?.fullName} · {customer?.phone}</p><strong>{formatMAD(order.totalMad)}</strong><button className="text-button">معالجة الطلب <ArrowLeft size={15}/></button></article> })}</div></section>
      <section id="folders" className="cmc-card"><div className="section-title"><div><p className="eyebrow">الكتالوج</p><h2>مجلدات المنتجات</h2></div><button className="primary-button small">إضافة منتج</button></div><div className="folder-grid">{snapshot.categories.map((category) => { const count = snapshot.services.filter((service) => service.categoryId === category.id).length; return <article className="folder-card" key={category.id} style={{ "--folder-color": category.color } as React.CSSProperties}><div><span className="folder-icon">{category.icon.slice(0, 1)}</span><h3>{category.name}</h3><p>{count} خدمات · للعرض فقط هنا</p></div><Link href={`/catalog?category=${category.id}`}><ArrowLeft size={18}/></Link></article> })}</div></section>
      <section id="customers" className="cmc-card"><div className="section-title"><div><p className="eyebrow">المحافظ والتواصل</p><h2>العملاء</h2></div><button className="text-button">عرض العملاء <ArrowLeft size={15}/></button></div><div className="customer-grid">{snapshot.customers.map((customer) => <article className="customer-card" key={customer.id}><span className="avatar">{customer.fullName.slice(0, 1)}</span><div><h3>{customer.fullName}</h3><p>{customer.phone}</p><strong>رصيد {formatMAD(customer.walletMad)}</strong></div><span className={customer.whatsappEnabled ? "whatsapp-on" : "whatsapp-off"}>WhatsApp</span></article>)}</div></section>
    </section>
  </main></>;
}
function Metric({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) { return <article className="metric-card"><span>{icon}</span><p>{label}</p><strong>{value}</strong><small>{note}</small></article>; }
