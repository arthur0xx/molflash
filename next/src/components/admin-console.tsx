"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { Boxes, CreditCard, FolderTree, MessageCircle, Pencil, Plus, Send, Settings2, Trash2, UsersRound } from "lucide-react";
import type { Category, DemoSnapshot, Order, OrderStatus, Service, SupportTicket } from "@/lib/types";
import { formatMAD, statusLabels } from "@/lib/types";
import { firebaseServices } from "@/lib/firebase/client";
import { getBrowserDemoOrders, updateBrowserDemoOrder, type BrowserDemoOrder } from "@/lib/demo-browser";
import { AdminSessionControls } from "@/components/admin-session-controls";

const statusOptions: OrderStatus[] = ["new", "processing", "waiting", "completed", "rejected"];
const orderTone = (status: OrderStatus) => ({ new: "blue", processing: "amber", waiting: "violet", completed: "green", rejected: "red" }[status]);
const fieldLabels: Record<string, string> = { email: "البريد الإلكتروني", imei: "IMEI", model: "موديل الجهاز", serial: "Serial Number", username: "اسم المستخدم", plan: "الباقة", duration: "مدة الكراء", game: "اللعبة", playerId: "Player ID" };
type Tab = "overview" | "orders" | "products" | "categories" | "customers" | "support" | "settings";
type DisplayOrder = Order & { browserOrder?: BrowserDemoOrder };
type Editor = { kind: "category" | "service"; mode: "create" | "edit"; id?: string } | null;
type CategoryForm = { name: string; icon: string; color: string; description: string; order: string; isActive: boolean };
type ServiceForm = { slug: string; title: string; categoryId: string; description: string; priceMad: string; delivery: string; badge: string; imageUrl: string; isActive: boolean };
type MediaStatus = { configured: boolean; cloudName?: string; folder?: string };

const emptyCategoryForm = (order: number): CategoryForm => ({ name: "", icon: "Folder", color: "#1479FF", description: "", order: String(order), isActive: true });
const emptyServiceForm = (categoryId = ""): ServiceForm => ({ slug: "", title: "", categoryId, description: "", priceMad: "", delivery: "", badge: "", imageUrl: "", isActive: false });

export function AdminConsole({ initial }: { initial: DemoSnapshot }) {
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState<Tab>("overview");
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [typedName, setTypedName] = useState("");
  const firebase = useMemo(() => firebaseServices(), []);
  const [notice, setNotice] = useState(firebase ? "Firebase متصل: الطلبات والتصنيفات والخدمات والأرصدة والدعم تُحفظ عبر المسارات الخادمية." : "وضع تجريبي: لا يمكن تعديل التصنيفات أو الخدمات أو الأرصدة أو الدعم قبل اتصال Firebase.");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [browserOrders, setBrowserOrders] = useState<BrowserDemoOrder[]>([]);
  const [deliveryDrafts, setDeliveryDrafts] = useState<Record<string, string>>({});
  const [deliveryNotes, setDeliveryNotes] = useState<Record<string, string>>({});
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(() => emptyCategoryForm(initial.categories.length + 1));
  const [serviceForm, setServiceForm] = useState<ServiceForm>(() => emptyServiceForm(initial.categories.find((category) => category.isActive)?.id));
  const [isSaving, setIsSaving] = useState(false);
  const [walletReasons, setWalletReasons] = useState<Record<string, string>>({});
  const [walletSavingId, setWalletSavingId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [supportSavingId, setSupportSavingId] = useState<string | null>(null);
  const [mediaStatus, setMediaStatus] = useState<MediaStatus | null>(null);
  const [imageUploading, setImageUploading] = useState(false);

  useEffect(() => {
    if (!firebase) {
      const refreshOrders = () => setBrowserOrders(getBrowserDemoOrders());
      refreshOrders(); window.addEventListener("chrigsm:demo-order", refreshOrders);
      return () => window.removeEventListener("chrigsm:demo-order", refreshOrders);
    }
    return onAuthStateChanged(firebase.auth, async (user) => {
      if (!user) { setTickets([]); return; }
      try {
        const response = await fetch("/api/admin/support", { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
        const result = await response.json().catch(() => ({})) as { tickets?: SupportTicket[]; error?: string };
        if (!response.ok) throw new Error(result.error || "تعذر تحميل رسائل الدعم.");
        setTickets(result.tickets || []);
      } catch (reason) { setNotice(reason instanceof Error ? reason.message : "تعذر تحميل رسائل الدعم."); }
    });
  }, [firebase]);

  useEffect(() => {
    if (!firebase) { setMediaStatus({ configured: false }); return; }
    return onAuthStateChanged(firebase.auth, async (user) => {
      if (!user) { setMediaStatus(null); return; }
      try {
        const response = await fetch("/api/admin/media/signature", { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
        const result = await response.json().catch(() => ({})) as MediaStatus & { error?: string };
        setMediaStatus(response.ok ? result : { configured: false });
      } catch { setMediaStatus({ configured: false }); }
    });
  }, [firebase]);

  const allOrders = useMemo<DisplayOrder[]>(() => firebase ? data.orders : [
    ...browserOrders.map((order) => ({ id: order.id, customerId: order.customerId, serviceId: order.serviceId, status: order.status, totalMad: order.totalMad, createdAt: order.createdAt, updatedAt: order.updatedAt, deliveryCode: order.deliveryCode, deliveryNote: order.deliveryNote, formData: order.answers, statusHistory: order.statusHistory, notification: order.notification, browserOrder: order })),
    ...data.orders,
  ], [browserOrders, data.orders, firebase]);
  const totalWallet = useMemo(() => data.customers.reduce((sum, item) => sum + item.walletMad, 0), [data.customers]);
  const processing = allOrders.filter((item) => item.status === "processing").length;
  const activeCategory = data.categories.find((item) => item.id === openFolder);
  const visibleOrders = selectedCustomerId ? allOrders.filter((order) => order.customerId === selectedCustomerId) : allOrders;
  const activeCategories = data.categories.filter((category) => category.isActive);

  async function adminRequest<T>(path: string, method: "GET" | "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
    const user = firebase?.auth.currentUser;
    if (!firebase || !user) throw new Error("يتطلب هذا الإجراء تسجيل دخول مدير عبر Firebase.");

    const response = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({})) as { error?: string } & T;
    if (!response.ok) throw new Error(result.error || "تعذر حفظ التغيير في Firebase.");
    return result;
  }

  async function uploadServiceImage(file: File) {
    if (!mediaStatus?.configured) throw new Error("تهيئة Cloudinary الخادمية غير مكتملة؛ استخدم رابط صورة خارجيًا الآن.");
    if (!file.type.startsWith("image/")) throw new Error("اختر ملف صورة صالحًا.");
    if (file.size > 10 * 1024 * 1024) throw new Error("حجم الصورة يتجاوز الحد المسموح 10 ميغابايت.");

    setImageUploading(true);
    try {
      const signed = await adminRequest<{ cloudName: string; apiKey: string; folder: string; timestamp: number; signature: string }>("/api/admin/media/signature", "POST");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", signed.apiKey);
      formData.append("timestamp", String(signed.timestamp));
      formData.append("signature", signed.signature);
      formData.append("folder", signed.folder);
      const response = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`, { method: "POST", body: formData });
      const result = await response.json().catch(() => ({})) as { secure_url?: string; error?: { message?: string } };
      if (!response.ok || !result.secure_url?.startsWith("https://")) throw new Error(result.error?.message || "تعذر رفع الصورة إلى Cloudinary.");
      setServiceForm((previous) => ({ ...previous, imageUrl: result.secure_url || "" }));
      setNotice("رُفعت الصورة إلى Cloudinary؛ احفظ الخدمة لتثبيت رابطها في Firebase.");
    } finally { setImageUploading(false); }
  }

  async function patchFirebaseOrder(orderId: string, payload: { status?: OrderStatus; deliveryCode?: string; deliveryNote?: string }) {
    const user = firebase?.auth.currentUser;
    if (!firebase || !user) return false;
    const response = await fetch(`/api/orders/${orderId}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify(payload) });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error || "تعذر حفظ تحديث الطلب في Firebase.");
    return true;
  }

  async function updateOrder(orderId: string, status: OrderStatus) {
    const target = allOrders.find((order) => order.id === orderId);
    if (!target) return;
    const now = new Date().toISOString();
    const note = status === "processing" ? "بدأ فريق ChriGsm معالجة الطلب. بيانات العميل أصبحت مقفلة." : `غيّر فريق ChriGsm الحالة إلى «${statusLabels[status]}».`;
    try {
      if (firebase) await patchFirebaseOrder(orderId, { status });
      if (target.browserOrder && !firebase) updateBrowserDemoOrder(orderId, (order) => ({ ...order, status, updatedAt: now, statusHistory: [...order.statusHistory, { status, at: now, note }] }));
      else setData((previous) => ({ ...previous, orders: previous.orders.map((order) => order.id === orderId ? { ...order, status, updatedAt: now, statusHistory: [...(order.statusHistory || []), { status, at: now, note }] } : order) }));
      setNotice(`تم تحديث الطلب ${orderId} إلى «${statusLabels[status]}».`);
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : "تعذر تحديث الطلب."); }
  }

  async function sendDelivery(orderId: string) {
    const target = allOrders.find((order) => order.id === orderId);
    const code = deliveryDrafts[orderId]?.trim();
    const deliveryNote = deliveryNotes[orderId]?.trim();
    if (!target || !code) { setNotice("أدخل كود التفعيل أو تفاصيل التسليم أولًا."); return; }
    const now = new Date().toISOString();
    const notification = { title: "تم إنجاز طلبك بنجاح", body: `تم تسليم ${data.services.find((service) => service.id === target.serviceId)?.title || "الخدمة"}. راجع كود التسليم في تفاصيل الطلب.`, createdAt: now, read: false };
    const history = { status: "completed" as const, at: now, note: "تم إرسال كود أو تفاصيل التسليم إلى حساب العميل." };
    try {
      if (firebase) await patchFirebaseOrder(orderId, { deliveryCode: code, deliveryNote });
      if (target.browserOrder && !firebase) updateBrowserDemoOrder(orderId, (order) => ({ ...order, status: "completed", deliveryCode: code, deliveryNote, updatedAt: now, statusHistory: [...order.statusHistory, history], notification }));
      else setData((previous) => ({ ...previous, orders: previous.orders.map((order) => order.id === orderId ? { ...order, status: "completed", deliveryCode: code, deliveryNote, notification, updatedAt: now, statusHistory: [...(order.statusHistory || []), history] } : order) }));
      setNotice(`تم التسليم للطلب ${orderId}. وصل إشعار داخل الحساب؛ WhatsApp ينتظر إعداد التكامل الحقيقي.`);
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : "تعذر تسليم الطلب."); }
  }

  async function answerTicket(ticketId: string) {
    const reply = replyDrafts[ticketId]?.trim();
    if (!firebase) { setNotice("يتطلب الرد على الدعم اتصال Firebase وحساب مدير."); return; }
    if (!reply || reply.length < 4) { setNotice("اكتب ردًا واضحًا من 4 أحرف على الأقل قبل الحفظ."); return; }
    try {
      setSupportSavingId(ticketId);
      const result = await adminRequest<{ ticket: SupportTicket }>(`/api/admin/support/${ticketId}`, "PATCH", { reply });
      setTickets((previous) => previous.map((ticket) => ticket.id === ticketId ? result.ticket : ticket));
      setReplyDrafts((previous) => ({ ...previous, [ticketId]: "" }));
      setNotice("حُفظ رد الدعم خادميًا وسيظهر للعميل في حسابه.");
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : "تعذر حفظ رد الدعم."); }
    finally { setSupportSavingId(null); }
  }

  async function adjustWallet(customerId: string, amountMad: number) {
    const reason = walletReasons[customerId]?.trim();
    if (!firebase) { setNotice("يتطلب تعديل الرصيد اتصال Firebase وحساب مدير."); return; }
    if (!reason || reason.length < 4) { setNotice("اكتب سببًا واضحًا من 4 أحرف على الأقل قبل تعديل الرصيد."); return; }

    try {
      setWalletSavingId(customerId);
      const result = await adminRequest<{ customer: { id: string; walletMad: number; lastActivity: string }; walletEntry: { amountMad: number } }>(`/api/admin/customers/${customerId}/wallet`, "POST", { amountMad, reason });
      setData((previous) => ({ ...previous, customers: previous.customers.map((customer) => customer.id === customerId ? { ...customer, walletMad: result.customer.walletMad, lastActivity: result.customer.lastActivity } : customer) }));
      setWalletReasons((previous) => ({ ...previous, [customerId]: "" }));
      setNotice(`تم ${result.walletEntry.amountMad > 0 ? "إضافة" : "خصم"} ${formatMAD(Math.abs(result.walletEntry.amountMad))} من محفظة العميل بسجل تدقيق خادمي.`);
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "تعذر تعديل رصيد العميل.");
    } finally {
      setWalletSavingId(null);
    }
  }

  function openCategoryEditor(category?: Category) {
    if (!firebase) { setNotice("يتطلب تعديل التصنيفات اتصال Firebase وحساب مدير."); return; }
    if (category) {
      setCategoryForm({ name: category.name, icon: category.icon, color: category.color, description: category.description, order: String(category.order), isActive: category.isActive });
      setEditor({ kind: "category", mode: "edit", id: category.id });
    } else {
      setCategoryForm(emptyCategoryForm(data.categories.length + 1));
      setEditor({ kind: "category", mode: "create" });
    }
  }

  function openServiceEditor(categoryId?: string, service?: Service) {
    if (!firebase) { setNotice("يتطلب تعديل الخدمات اتصال Firebase وحساب مدير."); return; }
    if (service) {
      setServiceForm({ slug: service.slug, title: service.title, categoryId: service.categoryId, description: service.description, priceMad: String(service.priceMad), delivery: service.delivery, badge: service.badge || "", imageUrl: service.imageUrl || "", isActive: service.isActive });
      setEditor({ kind: "service", mode: "edit", id: service.id });
    } else {
      setServiceForm(emptyServiceForm(categoryId || activeCategories[0]?.id));
      setEditor({ kind: "service", mode: "create" });
    }
  }

  async function saveEditor() {
    if (!editor) return;
    try {
      setIsSaving(true);
      if (editor.kind === "category") {
        const order = Number(categoryForm.order);
        if (!Number.isInteger(order) || order < 0) throw new Error("رتبة التصنيف يجب أن تكون رقمًا صحيحًا موجبًا أو صفرًا.");
        const payload = { ...categoryForm, name: categoryForm.name.trim(), icon: categoryForm.icon.trim(), color: categoryForm.color.trim(), description: categoryForm.description.trim(), order };
        if (editor.mode === "create") {
          const result = await adminRequest<{ category: Category }>("/api/admin/categories", "POST", payload);
          setData((previous) => ({ ...previous, categories: [...previous.categories, result.category].sort((left, right) => left.order - right.order) }));
          setNotice(`تمت إضافة التصنيف «${result.category.name}» وحفظه في Firebase.`);
        } else {
          const result = await adminRequest<{ category: Category }>(`/api/admin/categories/${editor.id}`, "PATCH", payload);
          setData((previous) => ({ ...previous, categories: previous.categories.map((category) => category.id === result.category.id ? result.category : category).sort((left, right) => left.order - right.order) }));
          setNotice(`تم تعديل التصنيف «${result.category.name}» وحفظه في Firebase.`);
        }
      } else {
        const priceMad = Number(serviceForm.priceMad);
        if (!Number.isFinite(priceMad) || priceMad < 0) throw new Error("أدخل سعرًا صالحًا بالدرهم المغربي.");
        const existing = editor.id ? data.services.find((service) => service.id === editor.id) : undefined;
        const basePayload = { slug: serviceForm.slug.trim(), title: serviceForm.title.trim(), categoryId: serviceForm.categoryId, description: serviceForm.description.trim(), priceMad, delivery: serviceForm.delivery.trim(), imageUrl: serviceForm.imageUrl.trim() || undefined, isActive: serviceForm.isActive };
        if (editor.mode === "create") {
          const result = await adminRequest<{ service: Service }>("/api/admin/services", "POST", { ...basePayload, badge: serviceForm.badge.trim() || undefined, fields: [] });
          setData((previous) => ({ ...previous, services: [...previous.services, result.service] }));
          setOpenFolder(result.service.categoryId);
          setNotice(`تمت إضافة الخدمة «${result.service.title}» وحفظها في Firebase.`);
        } else {
          const result = await adminRequest<{ service: Service }>(`/api/admin/services/${editor.id}`, "PATCH", { ...basePayload, imageUrl: serviceForm.imageUrl.trim() || null, badge: serviceForm.badge.trim() || null, fields: existing?.fields || [] });
          setData((previous) => ({ ...previous, services: previous.services.map((service) => service.id === result.service.id ? result.service : service) }));
          setNotice(`تم تعديل الخدمة «${result.service.title}» وحفظها في Firebase.`);
        }
      }
      setEditor(null);
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "تعذر حفظ التغيير.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteCategory() {
    const category = data.categories.find((item) => item.id === deleteId);
    if (!category || typedName !== category.name) return;
    try {
      setIsSaving(true);
      const result = await adminRequest<{ deletedServiceCount: number }>(`/api/admin/categories/${category.id}`, "DELETE");
      setData((previous) => ({ ...previous, categories: previous.categories.filter((item) => item.id !== category.id), services: previous.services.filter((service) => service.categoryId !== category.id) }));
      setOpenFolder(null);
      setDeleteId(null);
      setTypedName("");
      setNotice(`تم حذف التصنيف «${category.name}» وخدماته (${result.deletedServiceCount}) من Firebase.`);
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "تعذر حذف التصنيف.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteService(service: Service) {
    if (!window.confirm(`حذف الخدمة «${service.title}»؟ لا يمكن حذف خدمة مرتبطة بطلبات.`)) return;
    try {
      setIsSaving(true);
      await adminRequest(`/api/admin/services/${service.id}`, "DELETE");
      setData((previous) => ({ ...previous, services: previous.services.filter((item) => item.id !== service.id) }));
      setNotice(`تم حذف الخدمة «${service.title}» من Firebase.`);
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "تعذر حذف الخدمة.");
    } finally {
      setIsSaving(false);
    }
  }

  return <div className="admin-console"><aside className="cmc-sidebar"><div className="cmc-title">ChriGsm <b>CMC</b></div><nav>{([ ["overview", "نظرة عامة"], ["orders", "الطلبات"], ["products", "المنتجات"], ["categories", "التصنيفات"], ["customers", "العملاء"], ["support", "الدعم"], ["settings", "الإعدادات"] ] as [Tab, string][]).map(([id, label]) => <button className={tab === id ? "active" : ""} onClick={() => setTab(id)} key={id}>{label}</button>)}</nav><div className="demo-mode">{firebase ? <>Firebase متصل<br/><span>الطلبات والتصنيفات والخدمات تحفظ خادميًا</span></> : <>وضع تجريبي<br/><span>تعديل التصنيفات والخدمات متاح عند Firebase فقط</span></>}</div></aside><section className="cmc-content"><header className="cmc-heading"><div><p className="eyebrow">إدارة العمليات</p><h1>{({ overview: "نظرة عامة CMC", orders: "إدارة الطلبات", products: "مجلدات المنتجات", categories: "إدارة التصنيفات", customers: "العملاء والمحافظ", support: "رسائل الدعم", settings: "إعدادات المتجر" } as Record<Tab, string>)[tab]}</h1></div><span className="live-pill"><span/> {firebase ? "Firebase متصل" : "تجربة محلية"}</span></header><p className="admin-notice">{notice}</p>
    {tab === "overview" && <><div className="metric-grid"><Metric icon={<UsersRound/>} label="عملاء نشطون" value={String(data.customers.length)} note="بيانات تجريبية"/><Metric icon={<Boxes/>} label="طلبات جديدة" value={String(allOrders.filter((item) => item.status === "new").length)} note="تصل من المتجر"/><Metric icon={<FolderTree/>} label="قيد المعالجة" value={String(processing)} note="بيانات مقفلة للعميل"/><Metric icon={<CreditCard/>} label="إجمالي الأرصدة" value={formatMAD(totalWallet)} note="محافظ العملاء"/></div><section className="cmc-card"><h2>آخر الطلبات</h2><OrderGrid orders={allOrders} data={data} onStatus={updateOrder} deliveryDrafts={deliveryDrafts} deliveryNotes={deliveryNotes} onDeliveryDraft={setDeliveryDrafts} onDeliveryNote={setDeliveryNotes} onSendDelivery={sendDelivery}/></section></>}
    {tab === "orders" && <section className="cmc-card"><div className="section-title"><div><p className="eyebrow">بيانات وتسليم واضح</p><h2>طلبات الخدمات</h2></div>{selectedCustomerId ? <button className="filter-button" onClick={() => setSelectedCustomerId(null)}>كل العملاء</button> : <span className="muted-text">يصل إشعار داخل الحساب عند الإكمال</span>}</div><OrderGrid orders={visibleOrders} data={data} onStatus={updateOrder} deliveryDrafts={deliveryDrafts} deliveryNotes={deliveryNotes} onDeliveryDraft={setDeliveryDrafts} onDeliveryNote={setDeliveryNotes} onSendDelivery={sendDelivery}/></section>}
    {tab === "products" && <section className="cmc-card"><div className="section-title"><div><p className="eyebrow">خدمات محفوظة خادميًا</p><h2>{activeCategory ? activeCategory.name : "مجلدات المنتجات"}</h2></div>{activeCategory && <button className="filter-button" onClick={() => setOpenFolder(null)}>رجوع للمجلدات</button>}</div>{!activeCategory ? <div className="folder-grid">{data.categories.map((category) => <article className="folder-card" key={category.id} style={{ "--folder-color": category.color } as CSSProperties}><button className="folder-open" onClick={() => setOpenFolder(category.id)}><span className="folder-icon">{category.icon.slice(0, 1)}</span><span><b>{category.name}</b><small>{data.services.filter((item) => item.categoryId === category.id).length} خدمات</small></span></button></article>)}</div> : <div className="product-list">{data.services.filter((item) => item.categoryId === activeCategory.id).map((service) => <article className="product-row" key={service.id}>{service.imageUrl ? <img className="service-image" src={service.imageUrl} alt=""/> : <span className="service-glyph">{service.title.slice(0, 2)}</span>}<div><h3>{service.title}</h3><p>{service.description}</p></div><strong>{formatMAD(service.priceMad)}</strong><div className="row-actions"><button className="filter-button" onClick={() => openServiceEditor(undefined, service)}><Pencil size={14}/> تعديل</button><button className="danger-button" onClick={() => deleteService(service)} disabled={isSaving}><Trash2 size={14}/> حذف</button></div></article>)}<button className="primary-button" onClick={() => openServiceEditor(activeCategory.id)} disabled={!firebase || isSaving}><Plus size={16}/> إضافة خدمة</button></div>}</section>}
    {tab === "categories" && <section className="cmc-card"><div className="section-title"><div><p className="eyebrow">إضافة وتعديل وحذف خادمي</p><h2>التصنيفات والأيقونات</h2></div><button className="primary-button small" onClick={() => openCategoryEditor()} disabled={!firebase || isSaving}><Plus size={15}/> إضافة تصنيف</button></div><div className="category-admin-list">{data.categories.map((category) => <article key={category.id} className="category-admin-row"><span className="folder-icon" style={{ "--folder-color": category.color } as CSSProperties}>{category.icon.slice(0, 1)}</span><div><h3>{category.name}</h3><p>{category.description || "من دون وصف"} · أيقونة: {category.icon}</p></div><span className="muted-text">{data.services.filter((item) => item.categoryId === category.id).length} خدمات</span><div className="row-actions"><button className="filter-button" onClick={() => openCategoryEditor(category)} disabled={!firebase || isSaving}><Pencil size={14}/> تعديل</button><button className="danger-button" onClick={() => setDeleteId(category.id)} disabled={!firebase || isSaving}><Trash2 size={15}/> حذف</button></div></article>)}</div></section>}
    {tab === "customers" && <section className="cmc-card"><div className="section-title"><div><p className="eyebrow">محافظ وسجل تدقيق</p><h2>العملاء</h2></div><span className="muted-text">كل تعديل يتطلب سببًا ويُسجل خادميًا</span></div><div className="customer-grid">{data.customers.map((customer) => <article className="customer-card large" key={customer.id}><span className="avatar">{customer.fullName.slice(0, 1)}</span><div><h3>{customer.fullName}</h3><p>{customer.phone}</p><strong>رصيد {formatMAD(customer.walletMad)} · {allOrders.filter((order) => order.customerId === customer.id).length} طلبات</strong></div><div className="wallet-actions"><input aria-label={`سبب تعديل رصيد ${customer.fullName}`} value={walletReasons[customer.id] || ""} onChange={(event) => setWalletReasons((previous) => ({ ...previous, [customer.id]: event.target.value }))} placeholder="سبب التعديل (مطلوب)" disabled={!firebase || walletSavingId === customer.id}/><div><button onClick={() => adjustWallet(customer.id, 50)} disabled={!firebase || walletSavingId === customer.id}>+50</button><button onClick={() => adjustWallet(customer.id, -50)} disabled={!firebase || walletSavingId === customer.id}>-50</button><button onClick={() => { setSelectedCustomerId(customer.id); setTab("orders"); }} disabled={walletSavingId === customer.id}>طلبات</button></div></div></article>)}</div></section>}
    {tab === "support" && <section className="cmc-card"><div className="section-title"><div><p className="eyebrow">رسائل العملاء المحفوظة</p><h2>الدعم</h2></div><span className="muted-text">{firebase ? `${tickets.length} رسائل في Firebase` : "الدعم يحتاج Firebase"}</span></div>{tickets.length ? <div className="admin-ticket-list">{tickets.map((ticket) => { const ticketCustomer = data.customers.find((customer) => customer.id === ticket.customerId); return <article key={ticket.id}><MessageCircle size={20}/><div><b>{ticket.subject}</b><p>{ticket.message}</p><small>{ticketCustomer?.fullName || ticket.customerId} · {ticket.createdAt.slice(0, 10)}</small>{ticket.reply && <div className="ticket-reply"><b>رد CMC</b><p>{ticket.reply.message}</p></div>}</div><div><span className={`status-pill ${ticket.status === "open" ? "amber" : "green"}`}>{ticket.status === "open" ? "مفتوح" : "تم الرد"}</span>{ticket.status === "open" && <div className="support-reply-draft"><textarea value={replyDrafts[ticket.id] || ""} onChange={(event) => setReplyDrafts((previous) => ({ ...previous, [ticket.id]: event.target.value }))} placeholder="اكتب ردًا يظهر للعميل" disabled={!firebase || supportSavingId === ticket.id}/><button className="filter-button" onClick={() => answerTicket(ticket.id)} disabled={!firebase || supportSavingId === ticket.id}><Send size={14}/> {supportSavingId === ticket.id ? "جارٍ الحفظ..." : "إرسال الرد"}</button></div>}</div></article>; })}</div> : <div className="empty-state"><MessageCircle size={24}/><h2>لا توجد رسائل دعم محفوظة</h2><p>{firebase ? "ستظهر رسائل العملاء هنا فور إرسالها من حساباتهم." : "اربط Firebase لإتاحة رسائل الدعم الحقيقية."}</p></div>}</section>}
    {tab === "settings" && <section className="cmc-card"><div className="section-title"><div><p className="eyebrow">إعداد محلي قبل الإنتاج</p><h2>إعدادات المتجر والإدارة</h2></div><Settings2 size={22}/></div><AdminSessionControls/><div className="admin-settings-grid"><article><p>اسم المتجر</p><strong>ChriGsm</strong><small>يظهر في الرأس ورسائل الحساب</small></article><article><p>عملة المتجر</p><strong>الدرهم المغربي (د.م.)</strong><small>معتمدة في الأسعار والمحافظ</small></article><article><p>WhatsApp Business</p><strong>مؤجل</strong><small>تحتاج API ورقم العمل قبل أي إرسال فعلي</small></article><article><p>المصادقة</p><strong>Firebase Authentication</strong><small>تُفعل بعد إنشاء مشروع Firebase</small></article></div><section className="whatsapp-placeholder"><MessageCircle size={21}/><div><p className="eyebrow">تكامل مؤجل وآمن</p><h3>إشعار WhatsApp عند إتمام الطلب</h3><p>لن تُرسل النسخة التجريبية أي رسالة. عند الجاهزية، سيُنفَّذ الإرسال من دالة خادمية بعد تسليم الطلب فقط، باستخدام رقم WhatsApp Business معتمد وقالب Meta مصادق عليه.</p><div className="whatsapp-requirements"><span>رقم عمل موثّق</span><span>Meta Business API</span><span>قالب رسالة معتمد</span><span>مفاتيح خادمية فقط</span></div></div></section></section>}
  </section>{deleteId && <div className="dialog-backdrop"><div className="confirm-dialog"><p className="eyebrow">حذف متسلسل</p><h2>حذف التصنيف وخدماته؟</h2><p>سيُحذف التصنيف «{data.categories.find((item) => item.id === deleteId)?.name}» وجميع خدماته التابعة غير المرتبطة بطلبات. اكتب اسم التصنيف للتأكيد.</p><input autoFocus value={typedName} onChange={(event) => setTypedName(event.target.value)} placeholder="اسم التصنيف"/><div><button className="filter-button" onClick={() => { setDeleteId(null); setTypedName(""); }} disabled={isSaving}>إلغاء</button><button className="danger-button" disabled={isSaving || typedName !== data.categories.find((item) => item.id === deleteId)?.name} onClick={deleteCategory}>تأكيد الحذف</button></div></div></div>}{editor && <EditorDialog editor={editor} categoryForm={categoryForm} serviceForm={serviceForm} categories={activeCategories} existingService={editor.id ? data.services.find((service) => service.id === editor.id) : undefined} saving={isSaving} mediaStatus={mediaStatus} imageUploading={imageUploading} onUploadImage={async (file) => { try { await uploadServiceImage(file); } catch (reason) { setNotice(reason instanceof Error ? reason.message : "تعذر رفع الصورة."); } }} onClose={() => setEditor(null)} onSave={saveEditor} onCategoryChange={setCategoryForm} onServiceChange={setServiceForm}/>}</div>;
}

function EditorDialog({ editor, categoryForm, serviceForm, categories, existingService, saving, mediaStatus, imageUploading, onUploadImage, onClose, onSave, onCategoryChange, onServiceChange }: { editor: Exclude<Editor, null>; categoryForm: CategoryForm; serviceForm: ServiceForm; categories: Category[]; existingService?: Service; saving: boolean; mediaStatus: MediaStatus | null; imageUploading: boolean; onUploadImage: (file: File) => Promise<void>; onClose: () => void; onSave: () => void; onCategoryChange: React.Dispatch<React.SetStateAction<CategoryForm>>; onServiceChange: React.Dispatch<React.SetStateAction<ServiceForm>> }) {
  const isCategory = editor.kind === "category";
  const title = `${editor.mode === "create" ? "إضافة" : "تعديل"} ${isCategory ? "تصنيف" : "خدمة"}`;
  return <div className="dialog-backdrop"><div className="confirm-dialog editor-dialog"><p className="eyebrow">حفظ خادمي في Firebase</p><h2>{title}</h2>{isCategory ? <div className="editor-grid"><FormField label="اسم التصنيف"><input value={categoryForm.name} onChange={(event) => onCategoryChange((previous) => ({ ...previous, name: event.target.value }))} placeholder="مثل خدمات Server"/></FormField><FormField label="الأيقونة أو الرابط"><input value={categoryForm.icon} onChange={(event) => onCategoryChange((previous) => ({ ...previous, icon: event.target.value }))} placeholder="Folder أو رابط أيقونة"/></FormField><FormField label="اللون"><input type="color" value={categoryForm.color} onChange={(event) => onCategoryChange((previous) => ({ ...previous, color: event.target.value }))}/></FormField><FormField label="الترتيب"><input type="number" min="0" value={categoryForm.order} onChange={(event) => onCategoryChange((previous) => ({ ...previous, order: event.target.value }))}/></FormField><FormField label="الوصف" wide><textarea value={categoryForm.description} onChange={(event) => onCategoryChange((previous) => ({ ...previous, description: event.target.value }))} placeholder="وصف قصير يظهر للعملاء"/></FormField><Toggle checked={categoryForm.isActive} onChange={(isActive) => onCategoryChange((previous) => ({ ...previous, isActive }))} label="تصنيف نشط"/></div> : <div className="editor-grid"><FormField label="اسم الخدمة" wide><input value={serviceForm.title} onChange={(event) => onServiceChange((previous) => ({ ...previous, title: event.target.value }))} placeholder="مثل TSL Tool Activation"/></FormField><FormField label="رابط الخدمة"><input dir="ltr" value={serviceForm.slug} onChange={(event) => onServiceChange((previous) => ({ ...previous, slug: event.target.value.toLowerCase().replace(/\s+/g, "-") }))} placeholder="tsl-tool-activation"/></FormField><FormField label="التصنيف"><select value={serviceForm.categoryId} onChange={(event) => onServiceChange((previous) => ({ ...previous, categoryId: event.target.value }))}><option value="">اختر التصنيف</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></FormField><FormField label="السعر (د.م.)"><input type="number" min="0" step="0.01" value={serviceForm.priceMad} onChange={(event) => onServiceChange((previous) => ({ ...previous, priceMad: event.target.value }))} placeholder="0"/></FormField><FormField label="التسليم"><input value={serviceForm.delivery} onChange={(event) => onServiceChange((previous) => ({ ...previous, delivery: event.target.value }))} placeholder="مثال: فوري بعد المعالجة"/></FormField><FormField label="شارة اختيارية"><input value={serviceForm.badge} onChange={(event) => onServiceChange((previous) => ({ ...previous, badge: event.target.value }))} placeholder="مثل الأكثر طلبًا"/></FormField><FormField label="رابط الصورة (HTTPS)" wide><input dir="ltr" type="url" value={serviceForm.imageUrl} onChange={(event) => onServiceChange((previous) => ({ ...previous, imageUrl: event.target.value }))} placeholder="https://res.cloudinary.com/..."/></FormField>{mediaStatus?.configured ? <FormField label={`رفع إلى Cloudinary (${mediaStatus.cloudName})`} wide><input type="file" accept="image/png,image/jpeg,image/webp" disabled={imageUploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void onUploadImage(file); }}/><small>PNG أو JPEG أو WebP حتى 10 ميغابايت. احفظ الخدمة بعد اكتمال الرفع.</small></FormField> : <p className="editor-hint">رفع Cloudinary معطل حتى تكتمل متغيرات البيئة الخادمية. يمكنك حفظ رابط HTTPS خارجي الآن.</p>}<FormField label="الوصف" wide><textarea value={serviceForm.description} onChange={(event) => onServiceChange((previous) => ({ ...previous, description: event.target.value }))} placeholder="وصف واضح للخدمة"/></FormField><Toggle checked={serviceForm.isActive} onChange={(isActive) => onServiceChange((previous) => ({ ...previous, isActive }))} label="إتاحة الخدمة للعملاء"/>{existingService && <p className="editor-hint">سيُحافظ الحفظ على {existingService.fields.length} حقل ديناميكي مرتبط بالخدمة.</p>}</div>}<div><button className="filter-button" onClick={onClose} disabled={saving}>إلغاء</button><button className="primary-button" onClick={onSave} disabled={saving || (!isCategory && categories.length === 0)}>{saving ? "جارٍ الحفظ..." : "حفظ في Firebase"}</button></div></div></div>;
}

function FormField({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) { return <label className={`editor-field${wide ? " wide" : ""}`}><span>{label}</span>{children}</label>; }
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) { return <label className="editor-toggle"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)}/><span>{label}</span></label>; }
function Metric({ icon, label, value, note }: { icon: ReactNode; label: string; value: string; note: string }) { return <article className="metric-card"><span>{icon}</span><p>{label}</p><strong>{value}</strong><small>{note}</small></article>; }
function OrderGrid({ orders, data, onStatus, deliveryDrafts, deliveryNotes, onDeliveryDraft, onDeliveryNote, onSendDelivery }: { orders: DisplayOrder[]; data: DemoSnapshot; onStatus: (id: string, status: OrderStatus) => void; deliveryDrafts: Record<string, string>; deliveryNotes: Record<string, string>; onDeliveryDraft: React.Dispatch<React.SetStateAction<Record<string, string>>>; onDeliveryNote: React.Dispatch<React.SetStateAction<Record<string, string>>>; onSendDelivery: (id: string) => void }) { return <div className="cmc-order-grid">{orders.map((order) => { const customer = data.customers.find((item) => item.id === order.customerId); const service = data.services.find((item) => item.id === order.serviceId); const history = order.statusHistory?.length ? order.statusHistory : [{ status: order.status, at: order.updatedAt, note: `الحالة الحالية: ${statusLabels[order.status]}` }]; return <article className="cmc-order-card detailed-cmc-order" key={order.id}><div className="order-card-top"><span className={`status-pill ${orderTone(order.status)}`}>{statusLabels[order.status]}</span><span>{order.id}</span></div><h3>{service?.title || order.browserOrder?.serviceTitle}</h3><p>{customer?.fullName || order.browserOrder?.customerName} · {customer?.phone || order.browserOrder?.customerPhone}</p><strong>{formatMAD(order.totalMad)}</strong><details className="cmc-order-details"><summary>البيانات المرسلة وسجل الطلب</summary><div><b>بيانات العميل</b><p>{order.browserOrder?.customerEmail || customer?.email}</p></div><div><b>الحقول المرسلة</b>{Object.entries(order.formData).map(([key, value]) => <p key={key}><span>{fieldLabels[key] || key}</span>{value}</p>)}</div><div><b>سجل الحالة</b>{history.map((event, index) => <p key={`${event.at}-${index}`}><span className={`status-pill ${orderTone(event.status)}`}>{statusLabels[event.status]}</span>{event.note}</p>)}</div></details><select value={order.status} onChange={(event) => onStatus(order.id, event.target.value as OrderStatus)}>{statusOptions.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select>{order.status !== "completed" && <div className="delivery-box"><input value={deliveryDrafts[order.id] || ""} onChange={(event) => onDeliveryDraft((previous) => ({ ...previous, [order.id]: event.target.value }))} placeholder="كود التفعيل أو تفاصيل التسليم"/><textarea value={deliveryNotes[order.id] || ""} onChange={(event) => onDeliveryNote((previous) => ({ ...previous, [order.id]: event.target.value }))} placeholder="ملاحظة تظهر للعميل (اختياري)"/><button type="button" onClick={() => onSendDelivery(order.id)}>تسليم وإشعار العميل</button></div>}{order.deliveryCode && <code>{order.deliveryCode}</code>}</article>; })}</div>; }
