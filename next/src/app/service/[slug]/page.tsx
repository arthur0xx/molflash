import { notFound } from "next/navigation";
import { Check, Clock3, ShieldCheck } from "lucide-react";
import { BottomNav, Header } from "@/components/header";
import { RequestForm } from "@/components/request-form";
import { getSnapshot } from "@/lib/repository";
import { formatMAD } from "@/lib/types";

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const snapshot = await getSnapshot();
  const service = snapshot.services.find((item) => item.slug === slug);
  if (!service) notFound();
  const category = snapshot.categories.find((item) => item.id === service.categoryId);

  return <><Header /><main className="store-shell detail-shell">
    <section className="detail-hero"><div className="service-glyph large-glyph">{service.title.slice(0, 2).toUpperCase()}</div><div><p className="eyebrow">{category?.name}</p><h1>{service.title}</h1><p>{service.description}</p><div className="detail-tags"><span><Clock3 size={15}/> {service.delivery}</span><span><ShieldCheck size={15}/> معالجة آمنة</span></div></div><strong className="detail-price">{formatMAD(service.priceMad)}</strong></section>
    <section className="detail-layout"><div className="detail-info"><h2>كيف يعمل الطلب؟</h2><p>املأ البيانات المطلوبة بدقة. في النسخة الحقيقية، ينشأ الطلب في حسابك مباشرة ويظهر لفريق CMC مع حالة المعالجة ورسائل الدعم.</p><ul><li><Check size={17}/> تحقق تلقائي من الحقول المطلوبة</li><li><Check size={17}/> تحديث حالة الطلب لحظيًا</li><li><Check size={17}/> تسليم الكود من صفحة الطلب عند اكتمال المعالجة</li></ul></div><div className="form-panel"><div className="form-panel-head"><p className="eyebrow">طلب جديد</p><h2>بيانات الخدمة</h2></div><RequestForm service={service} /></div></section>
  </main><BottomNav /></>;
}
