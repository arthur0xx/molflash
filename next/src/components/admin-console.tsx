"use client";

import { useEffect, useMemo, useState } from "react";
import { Boxes, CreditCard, FolderTree, MessageCircle, Plus, Send, Settings2, Trash2, UsersRound } from "lucide-react";
import type { DemoSnapshot, OrderStatus } from "@/lib/types";
import { formatMAD, statusLabels } from "@/lib/types";
import { getBrowserSupportTickets, saveBrowserSupportTickets, type BrowserSupportTicket } from "@/lib/demo-browser";

type Tab = "overview" | "orders" | "products" | "categories" | "customers" | "support" | "settings";
const statusOptions: OrderStatus[] = ["new", "processing", "waiting", "completed", "rejected"];
const orderTone = (status: OrderStatus) => ({ new: "blue", processing: "amber", waiting: "violet", completed: "green", rejected: "red" }[status]);

export function AdminConsole({ initial }: { initial: DemoSnapshot }) {
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState<Tab>("overview");
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [typedName, setTypedName] = useState("");
  const [notice, setNotice] = useState("وضع تجريبي: التغييرات هنا محلية وتُمحى عند تحديث الصفحة.");
  const [tickets, setTickets] = useState<BrowserSupportTicket[]>([]);
  const [deliveryDrafts, setDeliveryDrafts] = useState<Record<string, string>>({});
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const totalWallet = useMemo(() => data.customers.reduce((sum, item) => sum + item.walletMad, 0), [data.customers]);
  const processing = data.orders.filter((item) => item.status === "processing").length;
  useEffect(() => { const refresh = () => setTickets(getBrowserSupportTickets()); refresh(); window.addEventListener("chrigsm:demo-support", refresh); return () => window.removeEventListener("chrigsm:demo-support", refresh); }, []);

  function updateOrder(orderId: string, status: OrderStatus) {
    setData((previous) => ({ ...previous, orders: previous.orders.map((order) => order.id === orderId ? { ...order, status, updatedAt: new Date().toISOString(), deliveryCode: status === "completed" ? order.deliveryCode || `DEMO-${order.id}` : order.deliveryCode } : order) }));
    setNotice(`تم تحديث الطلب ${orderId} إلى «${statusLabels[status]}» في وضع التجربة.`);
  }
  function sendDelivery(orderId: string) {
    const code = deliveryDrafts[orderId]?.trim();
    if (!code) { setNotice("أدخل كود التفعيل أو تفاصيل التسليم أولًا."); return; }
    setData((previous) => ({ ...previous, orders: previous.orders.map((order) => order.id === orderId ? { ...order, status: "completed", deliveryCode: code, updatedAt: new Date().toISOString() } : order) }));
    setNotice(`تم تسليم التفعيل التجريبي للطلب ${orderId}. سيصبح الإرسال خادميًا ومسجلًا عند Firebase.`);
  }
  function answerTicket(ticketId: string) {
    const next = tickets.map((ticket) => ticket.id === ticketId ? { ...ticket, status: "answered" as const } : ticket);
    setTickets(next); saveBrowserSupportTickets(next); setNotice(`تم وضع رسالة الدعم ${ticketId} كـ«تم الرد» في وضع التجربة.`);
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
  const visibleOrders = selectedCustomerId ? data.orders.filter((order) => order.customerId === selectedCustomerId) : data.orders;

  return <div className="admin-console">
    <aside className="cmc-sidebar"><div className="cmc-title">ChriGsm <b>CMC</b></div><nav>{([ ["overview","نظرة عامة"], ["orders","الطلبات"], ["products","المنتجات"], ["categories","التصنيفات"], ["customers","العملاء"], ["support","الدعم"], ["settings","الإعدادات"] ] as [Tab,string][]).map(([id,label]) => <button className={tab === id ? "active" : ""} onClick={() => setTab(id)} key={id}>{label}</button>)}</nav><div className="demo-mode">وضع تجريبي<br/><span>البيانات تُمسح عند التحديث</span></div></aside>
    <section className="cmc-content"><header className="cmc-heading"><div><p className="eyebrow">إدارة العمليات</p><h1>{({overview:"نظرة عامة CMC",orders:"إدارة الطلبات",products:"مجلدات المنتجات",categories:"إدارة التصنيفات",customers:"العملاء والمحافظ",support:"رسائل الدعم",settings:"إعدادات المتجر"} as Record<Tab,string>)[tab]}</h1></div><span className="live-pill"><span/> تجربة محلية</span></header><p className="admin-notice">{notice}</p>
      {tab === "overview" && <><div className="metric-grid"><Metric icon={<UsersRound/>} label="عملاء نشطون" value={String(data.customers.length)} note="بيانات تجريبية" /><Metric icon={<Boxes/>} label="طلبات جديدة" value={String(data.orders.filter((item) => item.status === "new").length)} note="تحديث فوري عند Firebase" /><Metric icon={<FolderTree/>} label="قيد المعالجة" value={String(processing)} note="تحتاج إجراء" /><Metric icon={<CreditCard/>} label="إجمالي الأرصدة" value={formatMAD(totalWallet)} note="محافظ العملاء" /></div><section className="cmc-card"><h2>آخر الطلبات</h2><OrderGrid orders={data.orders} data={data} onStatus={updateOrder} deliveryDrafts={deliveryDrafts} onDeliveryDraft={setDeliveryDrafts} onSendDelivery={sendDelivery}/></section></>}
      {tab === "orders" && <section className="cmc-card"><div className="section-title"><div><p className="eyebrow">حالات واضحة</p><h2>طلبات الخدمات</h2></div>{selectedCustomerId ? <button className="filter-button" onClick={() => setSelectedCustomerId(null)}>كل العملاء</button> : <span className="muted-text">تسليم الكود عند الإكمال</span>}</div><OrderGrid orders={visibleOrders} data={data} onStatus={updateOrder} deliveryDrafts={deliveryDrafts} onDeliveryDraft={setDeliveryDrafts} onSendDelivery={sendDelivery}/></section>}
      {tab === "products" && <section className="cmc-card"><div className="section-title"><div><p className="eyebrow">عرض فقط للتصنيفات</p><h2>{activeCategory ? activeCategory.name : "مجلدات المنتجات"}</h2></div>{activeCategory && <button className="filter-button" onClick={() => setOpenFolder(null)}>رجوع للمجلدات</button>}</div>{!activeCategory ? <div className="folder-grid">{data.categories.map((category) => <article className="folder-card" key={category.id} style={{"--folder-color":category.color} as React.CSSProperties}><button className="folder-open" onClick={() => setOpenFolder(category.id)}><span className="folder-icon">{category.icon.slice(0,1)}</span><span><b>{category.name}</b><small>{data.services.filter((item) => item.categoryId === category.id).length} خدمات</small></span></button></article>)}</div> : <div className="product-list">{data.services.filter((item) => item.categoryId === activeCategory.id).map((service) => <article className="product-row" key={service.id}><span className="service-glyph">{service.title.slice(0,2)}</span><div><h3>{service.title}</h3><p>{service.description}</p></div><strong>{formatMAD(service.priceMad)}</strong><button className="filter-button">تعديل</button></article>)}<button className="primary-button" onClick={() => addDemoService(activeCategory.id)}><Plus size={16}/> إضافة منتج تجريبي</button></div>}</section>}
      {tab === "categories" && <section className="cmc-card"><div className="section-title"><div><p className="eyebrow">إضافة وتعديل وحذف</p><h2>التصنيفات والأيقونات</h2></div><button className="primary-button small" onClick={addCategory}><Plus size={15}/> إضافة تصنيف</button></div><div className="category-admin-list">{data.categories.map((category) => <article key={category.id} className="category-admin-row"><span className="folder-icon" style={{"--folder-color":category.color} as React.CSSProperties}>{category.icon.slice(0,1)}</span><div><h3>{category.name}</h3><p>{category.description} · أيقونة: رابط أو رفع عند Firebase</p></div><span className="muted-text">{data.services.filter((item) => item.categoryId === category.id).length} خدمات</span><button className="danger-button" onClick={() => setDeleteId(category.id)}><Trash2 size={15}/> حذف</button></article>)}</div></section>}
      {tab === "customers" && <section className="cmc-card"><div className="section-title"><div><p className="eyebrow">المحافظ والتواصل</p><h2>العملاء</h2></div><span className="muted-text">تعديل الرصيد مسجل في الإنتاج</span></div><div className="customer-grid">{data.customers.map((customer) => <article className="customer-card large" key={customer.id}><span className="avatar">{customer.fullName.slice(0,1)}</span><div><h3>{customer.fullName}</h3><p>{customer.phone}</p><strong>رصيد {formatMAD(customer.walletMad)} · {data.orders.filter((order) => order.customerId === customer.id).length} طلبات</strong></div><div className="wallet-actions"><button onClick={() => adjustWallet(customer.id, 50)}>+50</button><button onClick={() => adjustWallet(customer.id, -50)}>-50</button><button onClick={() => { setSelectedCustomerId(customer.id); setTab("orders"); }}>طلبات</button></div></article>)}</div></section>}
      {tab === "support" && <section className="cmc-card"><div className="section-title"><div><p className="eyebrow">منطقة العميل</p><h2>رسائل الدعم</h2></div><span className="muted-text">{tickets.length} رسائل تجريبية</span></div>{tickets.length ? <div className="admin-ticket-list">{tickets.map((ticket) => <article key={ticket.id}><MessageCircle size={20}/><div><b>{ticket.subject}</b><p>{ticket.message}</p><small>{ticket.id} · {ticket.createdAt.slice(0, 10)}</small></div><div><span className={`status-pill ${ticket.status === "open" ? "amber" : "green"}`}>{ticket.status === "open" ? "مفتوح" : "تم الرد"}</span>{ticket.status === "open" && <button className="filter-button" onClick={() => answerTicket(ticket.id)}><Send size={14}/> تم الرد</button>}</div></article>)}</div> : <div className="empty-state"><MessageCircle size={24}/><h2>لا توجد رسائل دعم</h2><p>ستظهر رسائل العملاء هنا عند إرسالها من حساب التجربة أو بعد ربط Firebase.</p></div>}</section>}
      {tab === "settings" && <section className="cmc-card"><div className="section-title"><div><p className="eyebrow">إعداد محلي قبل الإنتاج</p><h2>إعدادات المتجر</h2></div><Settings2 size={22}/></div><div className="admin-settings-grid"><article><p>اسم المتجر</p><strong>ChriGsm</strong><small>يظهر في الرأس ورسائل الحساب</small></article><article><p>عملة المتجر</p><strong>الدرهم المغربي (د.م.)</strong><small>معتمدة في الأسعار والمحافظ</small></article><article><p>دعم WhatsApp</p><strong>مؤجل</strong><small>يتطلب WhatsApp Business ورقم العمل</small></article><article><p>المصادقة</p><strong>Firebase Authentication</strong><small>تُفعل بعد إنشاء مشروع Firebase</small></article></div></section>}
    </section>
    {deleteId && <div className="dialog-backdrop"><div className="confirm-dialog"><p className="eyebrow">حذف متسلسل</p><h2>حذف التصنيف وخدماته؟</h2><p>سيُحذف التصنيف «{data.categories.find((item) => item.id === deleteId)?.name}» وجميع منتجاته التابعة في وضع التجربة. اكتب اسم التصنيف للتأكيد.</p><input autoFocus value={typedName} onChange={(event) => setTypedName(event.target.value)} placeholder="اسم التصنيف"/><div><button className="filter-button" onClick={() => { setDeleteId(null); setTypedName(""); }}>إلغاء</button><button className="danger-button" disabled={typedName !== data.categories.find((item) => item.id === deleteId)?.name} onClick={deleteCategory}>تأكيد الحذف</button></div></div></div>}
  </div>;
}
function Metric({icon,label,value,note}:{icon:React.ReactNode;label:string;value:string;note:string}){return <article className="metric-card"><span>{icon}</span><p>{label}</p><strong>{value}</strong><small>{note}</small></article>}
function OrderGrid({orders,data,onStatus,deliveryDrafts,onDeliveryDraft,onSendDelivery}:{orders:DemoSnapshot["orders"];data:DemoSnapshot;onStatus:(id:string,status:OrderStatus)=>void;deliveryDrafts:Record<string,string>;onDeliveryDraft:React.Dispatch<React.SetStateAction<Record<string,string>>>;onSendDelivery:(id:string)=>void}){return <div className="cmc-order-grid">{orders.map((order)=>{const customer=data.customers.find((item)=>item.id===order.customerId);const service=data.services.find((item)=>item.id===order.serviceId);return <article className="cmc-order-card" key={order.id}><div className="order-card-top"><span className={`status-pill ${orderTone(order.status)}`}>{statusLabels[order.status]}</span><span>{order.id}</span></div><h3>{service?.title}</h3><p>{customer?.fullName} · {customer?.phone}</p><strong>{formatMAD(order.totalMad)}</strong><select value={order.status} onChange={(event)=>onStatus(order.id,event.target.value as OrderStatus)}>{statusOptions.map((status)=><option key={status} value={status}>{statusLabels[status]}</option>)}</select>{order.status !== "completed" && <div className="delivery-box"><input value={deliveryDrafts[order.id] || ""} onChange={(event)=>onDeliveryDraft((previous)=>({...previous,[order.id]:event.target.value}))} placeholder="كود التفعيل أو تفاصيل التسليم"/><button type="button" onClick={()=>onSendDelivery(order.id)}>إرسال</button></div>}{order.deliveryCode && <code>{order.deliveryCode}</code>}</article>})}</div>}
