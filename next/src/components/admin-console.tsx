"use client";

import { useMemo, useState } from "react";
import { Boxes, CreditCard, FolderTree, Plus, Trash2, UsersRound } from "lucide-react";
import type { DemoSnapshot, OrderStatus } from "@/lib/types";
import { formatMAD, statusLabels } from "@/lib/types";

type Tab = "overview" | "orders" | "products" | "categories" | "customers";
const statusOptions: OrderStatus[] = ["new", "processing", "waiting", "completed", "rejected"];
const orderTone = (status: OrderStatus) => ({ new: "blue", processing: "amber", waiting: "violet", completed: "green", rejected: "red" }[status]);

export function AdminConsole({ initial }: { initial: DemoSnapshot }) {
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState<Tab>("overview");
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [typedName, setTypedName] = useState("");
  const [notice, setNotice] = useState("وضع تجريبي: التغييرات هنا محلية وتُمحى عند تحديث الصفحة.");
  const totalWallet = useMemo(() => data.customers.reduce((sum, item) => sum + item.walletMad, 0), [data.customers]);
  const processing = data.orders.filter((item) => item.status === "processing").length;

  function updateOrder(orderId: string, status: OrderStatus) {
    setData((previous) => ({ ...previous, orders: previous.orders.map((order) => order.id === orderId ? { ...order, status, updatedAt: new Date().toISOString(), deliveryCode: status === "completed" ? order.deliveryCode || `DEMO-${order.id}` : order.deliveryCode } : order) }));
    setNotice(`تم تحديث الطلب ${orderId} إلى «${statusLabels[status]}» في وضع التجربة.`);
  }
  function adjustWallet(customerId: string, delta: number) {
    setData((previous) => ({ ...previous, customers: previous.customers.map((customer) => customer.id === customerId ? { ...customer, walletMad: Math.max(0, customer.walletMad + delta) } : customer) }));
    setNotice("تم تعديل الرصيد التجريبي. النسخة الحقيقية ستنفذ هذه العملية عبر Route Handler وسجل تدقيق.");
  }
  function addDemoService(categoryId: string) {
    const category = data.categories.find((item) => item.id === categoryId);
    if (!category) return;
    const id = `svc-demo-${Date.now()}`;
    setData((previous) => ({ ...previous, services: [...previous.services, { id, slug: id, title: "خدمة تجريبية جديدة", categoryId, description: "خدمة أضيفت من لوحة CMC التجريبية ويمكن تعديلها عند ربط Firebase.", priceMad: 0, delivery: "تحتاج تسعير", isActive: false, fields: [] }] }));
    setNotice(`أضيفت خدمة تجريبية إلى مجلد «${category.name}».`);
  }
  function deleteCategory() {
    const category = data.categories.find((item) => item.id === deleteId);
    if (!category || typedName !== category.name) return;
    setData((previous) => ({ ...previous, categories: previous.categories.filter((item) => item.id !== category.id), services: previous.services.filter((service) => service.categoryId !== category.id) }));
    setDeleteId(null); setTypedName(""); setNotice(`حُذف التصنيف «${category.name}» مع جميع خدماته التجريبية التابعة.`);
  }
  function addCategory() {
    const id = `cat-demo-${Date.now()}`;
    setData((previous) => ({ ...previous, categories: [...previous.categories, { id, name: "تصنيف تجريبي", icon: "Folder", color: "#1479FF", description: "تصنيف أضيف محليًا", order: previous.categories.length + 1, isActive: true }] }));
    setNotice("أضيف تصنيف تجريبي جديد. عدل الاسم والأيقونة بعد اتصال Firebase.");
  }
  const activeCategory = data.categories.find((item) => item.id === openFolder);

  return <div className="admin-console">
    <aside className="cmc-sidebar"><div className="cmc-title">ChriGsm <b>CMC</b></div><nav>{([ ["overview","نظرة عامة"], ["orders","الطلبات"], ["products","المنتجات"], ["categories","التصنيفات"], ["customers","العملاء"] ] as [Tab,string][]).map(([id,label]) => <button className={tab === id ? "active" : ""} onClick={() => setTab(id)} key={id}>{label}</button>)}</nav><div className="demo-mode">وضع تجريبي<br/><span>البيانات تُمسح عند التحديث</span></div></aside>
    <section className="cmc-content"><header className="cmc-heading"><div><p className="eyebrow">إدارة العمليات</p><h1>{({overview:"نظرة عامة CMC",orders:"إدارة الطلبات",products:"مجلدات المنتجات",categories:"إدارة التصنيفات",customers:"العملاء والمحافظ"} as Record<Tab,string>)[tab]}</h1></div><span className="live-pill"><span/> تجربة محلية</span></header><p className="admin-notice">{notice}</p>
      {tab === "overview" && <><div className="metric-grid"><Metric icon={<UsersRound/>} label="عملاء نشطون" value={String(data.customers.length)} note="بيانات تجريبية" /><Metric icon={<Boxes/>} label="طلبات جديدة" value={String(data.orders.filter((item) => item.status === "new").length)} note="تحديث فوري عند Firebase" /><Metric icon={<FolderTree/>} label="قيد المعالجة" value={String(processing)} note="تحتاج إجراء" /><Metric icon={<CreditCard/>} label="إجمالي الأرصدة" value={formatMAD(totalWallet)} note="محافظ العملاء" /></div><section className="cmc-card"><h2>آخر الطلبات</h2><OrderGrid orders={data.orders} data={data} onStatus={updateOrder}/></section></>}
      {tab === "orders" && <section className="cmc-card"><div className="section-title"><div><p className="eyebrow">حالات واضحة</p><h2>طلبات الخدمات</h2></div><span className="muted-text">تسليم الكود عند الإكمال</span></div><OrderGrid orders={data.orders} data={data} onStatus={updateOrder}/></section>}
      {tab === "products" && <section className="cmc-card"><div className="section-title"><div><p className="eyebrow">عرض فقط للتصنيفات</p><h2>{activeCategory ? activeCategory.name : "مجلدات المنتجات"}</h2></div>{activeCategory && <button className="filter-button" onClick={() => setOpenFolder(null)}>رجوع للمجلدات</button>}</div>{!activeCategory ? <div className="folder-grid">{data.categories.map((category) => <article className="folder-card" key={category.id} style={{"--folder-color":category.color} as React.CSSProperties}><button className="folder-open" onClick={() => setOpenFolder(category.id)}><span className="folder-icon">{category.icon.slice(0,1)}</span><span><b>{category.name}</b><small>{data.services.filter((item) => item.categoryId === category.id).length} خدمات</small></span></button></article>)}</div> : <div className="product-list">{data.services.filter((item) => item.categoryId === activeCategory.id).map((service) => <article className="product-row" key={service.id}><span className="service-glyph">{service.title.slice(0,2)}</span><div><h3>{service.title}</h3><p>{service.description}</p></div><strong>{formatMAD(service.priceMad)}</strong><button className="filter-button">تعديل</button></article>)}<button className="primary-button" onClick={() => addDemoService(activeCategory.id)}><Plus size={16}/> إضافة منتج تجريبي</button></div>}</section>}
      {tab === "categories" && <section className="cmc-card"><div className="section-title"><div><p className="eyebrow">إضافة وتعديل وحذف</p><h2>التصنيفات والأيقونات</h2></div><button className="primary-button small" onClick={addCategory}><Plus size={15}/> إضافة تصنيف</button></div><div className="category-admin-list">{data.categories.map((category) => <article key={category.id} className="category-admin-row"><span className="folder-icon" style={{"--folder-color":category.color} as React.CSSProperties}>{category.icon.slice(0,1)}</span><div><h3>{category.name}</h3><p>{category.description} · أيقونة: رابط أو رفع عند Firebase</p></div><span className="muted-text">{data.services.filter((item) => item.categoryId === category.id).length} خدمات</span><button className="danger-button" onClick={() => setDeleteId(category.id)}><Trash2 size={15}/> حذف</button></article>)}</div></section>}
      {tab === "customers" && <section className="cmc-card"><div className="section-title"><div><p className="eyebrow">المحافظ والتواصل</p><h2>العملاء</h2></div><span className="muted-text">تعديل الرصيد مسجل في الإنتاج</span></div><div className="customer-grid">{data.customers.map((customer) => <article className="customer-card large" key={customer.id}><span className="avatar">{customer.fullName.slice(0,1)}</span><div><h3>{customer.fullName}</h3><p>{customer.phone}</p><strong>رصيد {formatMAD(customer.walletMad)}</strong></div><div className="wallet-actions"><button onClick={() => adjustWallet(customer.id, 50)}>+50</button><button onClick={() => adjustWallet(customer.id, -50)}>-50</button></div></article>)}</div></section>}
    </section>
    {deleteId && <div className="dialog-backdrop"><div className="confirm-dialog"><p className="eyebrow">حذف متسلسل</p><h2>حذف التصنيف وخدماته؟</h2><p>سيُحذف التصنيف «{data.categories.find((item) => item.id === deleteId)?.name}» وجميع منتجاته التابعة في وضع التجربة. اكتب اسم التصنيف للتأكيد.</p><input autoFocus value={typedName} onChange={(event) => setTypedName(event.target.value)} placeholder="اسم التصنيف"/><div><button className="filter-button" onClick={() => { setDeleteId(null); setTypedName(""); }}>إلغاء</button><button className="danger-button" disabled={typedName !== data.categories.find((item) => item.id === deleteId)?.name} onClick={deleteCategory}>تأكيد الحذف</button></div></div></div>}
  </div>;
}
function Metric({icon,label,value,note}:{icon:React.ReactNode;label:string;value:string;note:string}){return <article className="metric-card"><span>{icon}</span><p>{label}</p><strong>{value}</strong><small>{note}</small></article>}
function OrderGrid({orders,data,onStatus}:{orders:DemoSnapshot["orders"];data:DemoSnapshot;onStatus:(id:string,status:OrderStatus)=>void}){return <div className="cmc-order-grid">{orders.map((order)=>{const customer=data.customers.find((item)=>item.id===order.customerId);const service=data.services.find((item)=>item.id===order.serviceId);return <article className="cmc-order-card" key={order.id}><div className="order-card-top"><span className={`status-pill ${orderTone(order.status)}`}>{statusLabels[order.status]}</span><span>{order.id}</span></div><h3>{service?.title}</h3><p>{customer?.fullName} · {customer?.phone}</p><strong>{formatMAD(order.totalMad)}</strong><select value={order.status} onChange={(event)=>onStatus(order.id,event.target.value as OrderStatus)}>{statusOptions.map((status)=><option key={status} value={status}>{statusLabels[status]}</option>)}</select>{order.deliveryCode && <code>{order.deliveryCode}</code>}</article>})}</div>}
