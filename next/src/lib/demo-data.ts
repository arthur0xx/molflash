import type { DemoSnapshot } from "./types";

export const demoSnapshot: DemoSnapshot = {
  categories: [
    { id: "tool-activation", name: "تفعيل الأدوات", icon: "KeyRound", color: "#1479FF", description: "تفعيلات وتراخيص أدوات GSM", order: 1, isActive: true },
    { id: "server-services", name: "خدمات السيرفر", icon: "CloudCog", color: "#7C3AED", description: "خدمات FRP وIMEI عبر السيرفر", order: 2, isActive: true },
    { id: "tool-rental", name: "كراء الأدوات", icon: "Clock3", color: "#EA580C", description: "وصول مؤقت للأدوات الاحترافية", order: 3, isActive: true },
    { id: "misc", name: "متنوع", icon: "Sparkles", color: "#0F9D74", description: "بطاقات رقمية وألعاب وتفعيلات", order: 4, isActive: true },
  ],
  services: [
    { id: "svc-frp-samsung", slug: "samsung-frp-unlock", title: "Samsung FRP Unlock", categoryId: "server-services", description: "إزالة FRP لأجهزة Samsung المؤهلة عبر IMEI أو بيانات الجهاز.", priceMad: 80, delivery: "15–60 دقيقة", badge: "الأكثر طلبًا", isActive: true, fields: [{ id: "imei", label: "IMEI", type: "text", required: true, placeholder: "اكتب IMEI الصحيح" }, { id: "model", label: "موديل الجهاز", type: "text", required: true, placeholder: "مثال: Galaxy A54" }] },
    { id: "svc-honor-frp", slug: "honor-frp-service", title: "Honor FRP Service", categoryId: "server-services", description: "خدمة FRP لأجهزة Honor المدعومة مع متابعة حالة الطلب مباشرة.", priceMad: 65, delivery: "30–120 دقيقة", isActive: true, fields: [{ id: "serial", label: "Serial Number", type: "text", required: true }, { id: "model", label: "موديل Honor", type: "text", required: true }] },
    { id: "svc-tsl", slug: "tsl-tool-activation", title: "TSL Tool Activation", categoryId: "tool-activation", description: "تفعيل مرخّص لأداة TSL Tool لحساب العميل.", priceMad: 120, delivery: "فوري بعد المعالجة", badge: "فوري", isActive: true, fields: [{ id: "email", label: "البريد المرتبط بالأداة", type: "email", required: true, placeholder: "name@example.com" }] },
    { id: "svc-eft", slug: "eft-pro-activation", title: "EFT Pro Activation", categoryId: "tool-activation", description: "تفعيل EFT Pro حسب الباقة المطلوبة.", priceMad: 150, delivery: "15–30 دقيقة", isActive: true, fields: [{ id: "username", label: "اسم المستخدم", type: "text", required: true }, { id: "plan", label: "الباقة", type: "select", required: true, options: ["شهر واحد", "3 أشهر", "سنة"] }] },
    { id: "svc-alltool", slug: "alltool-rental", title: "AllTool Rental", categoryId: "tool-rental", description: "كراء وصول مؤقت إلى AllTool مع بيانات تسليم آمنة.", priceMad: 45, delivery: "فوري", badge: "24 ساعة", isActive: true, fields: [{ id: "email", label: "بريد جديد أو قائم", type: "email", required: true }, { id: "duration", label: "مدة الكراء", type: "select", required: true, options: ["24 ساعة", "3 أيام", "أسبوع"] }] },
    { id: "svc-chatgpt", slug: "chatgpt-activation", title: "تفعيل ChatGPT", categoryId: "misc", description: "تفعيل اشتراك رقمي تجريبي مع تعليمات التسليم.", priceMad: 99, delivery: "15–60 دقيقة", isActive: true, fields: [{ id: "email", label: "البريد الإلكتروني", type: "email", required: true }] },
    { id: "svc-gaming", slug: "gaming-topup", title: "شحن ألعاب وجواهر", categoryId: "misc", description: "شحن رقمي تجريبي للألعاب المدعومة.", priceMad: 30, delivery: "فوري", isActive: true, fields: [{ id: "game", label: "اللعبة", type: "select", required: true, options: ["Free Fire", "PUBG Mobile", "Mobile Legends"] }, { id: "playerId", label: "Player ID", type: "text", required: true }] },
  ],
  customers: [
    { id: "cus-yassine", fullName: "ياسين الفاسي", phone: "+212 600-111222", email: "yassine.demo@chrigsm.test", walletMad: 350, ordersCount: 4, lastActivity: "منذ 12 دقيقة", whatsappEnabled: true },
    { id: "cus-fatima", fullName: "فاطمة الزهراء", phone: "+212 600-111223", email: "fatima.demo@chrigsm.test", walletMad: 180, ordersCount: 2, lastActivity: "منذ ساعة", whatsappEnabled: true },
    { id: "cus-omar", fullName: "عمر بنعلي", phone: "+212 600-111224", email: "omar.demo@chrigsm.test", walletMad: 0, ordersCount: 1, lastActivity: "أمس", whatsappEnabled: false },
  ],
  orders: [
    { id: "ORD-10452", customerId: "cus-yassine", serviceId: "svc-tsl", status: "processing", totalMad: 120, createdAt: "2026-08-13T16:20:00.000Z", updatedAt: "2026-08-13T17:10:00.000Z", formData: { email: "yassine.demo@chrigsm.test" } },
    { id: "ORD-10451", customerId: "cus-fatima", serviceId: "svc-honor-frp", status: "waiting", totalMad: 65, createdAt: "2026-08-13T15:30:00.000Z", updatedAt: "2026-08-13T16:15:00.000Z", formData: { serial: "HONOR-DEMO-4582", model: "Honor X8" } },
    { id: "ORD-10450", customerId: "cus-yassine", serviceId: "svc-alltool", status: "completed", totalMad: 45, createdAt: "2026-08-12T19:20:00.000Z", updatedAt: "2026-08-12T19:33:00.000Z", deliveryCode: "DEMO-ALLTOOL-24H", formData: { email: "yassine.demo@chrigsm.test", duration: "24 ساعة" } },
    { id: "ORD-10449", customerId: "cus-omar", serviceId: "svc-gaming", status: "rejected", totalMad: 30, createdAt: "2026-08-12T14:05:00.000Z", updatedAt: "2026-08-12T14:09:00.000Z", formData: { game: "Free Fire", playerId: "DEMO-0099" } },
  ],
  walletEntries: [
    { id: "wal-1", customerId: "cus-yassine", amountMad: 500, reason: "شحن تجريبي", createdAt: "2026-08-10T09:00:00.000Z", createdBy: "demo-admin" },
    { id: "wal-2", customerId: "cus-yassine", amountMad: -150, reason: "طلبات تجريبية", createdAt: "2026-08-12T19:20:00.000Z", createdBy: "system" },
    { id: "wal-3", customerId: "cus-fatima", amountMad: 180, reason: "رصيد ترحيبي", createdAt: "2026-08-11T08:00:00.000Z", createdBy: "demo-admin" },
  ],
};
