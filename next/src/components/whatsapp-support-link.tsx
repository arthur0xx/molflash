import { MessageCircle } from "lucide-react";

type WhatsAppSupportLinkProps = {
  className?: string;
  label?: string;
};

function supportHref() {
  const configured = process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER?.replace(/\D/g, "") || "";
  if (!/^212[67]\d{8}$/.test(configured)) return null;
  return `https://wa.me/${configured}`;
}

/**
 * رقم الدعم رابط عام فقط؛ الإرسال الآلي وتحقق واتساب يظلان مقيدين بخدمة Cloud API الخادمية.
 */
export function WhatsAppSupportLink({ className = "support-link", label = "واتساب" }: WhatsAppSupportLinkProps) {
  const href = supportHref();
  if (!href) return null;
  return <a href={href} className={className} target="_blank" rel="noopener noreferrer" aria-label="التواصل مع دعم ChriGsm عبر واتساب"><MessageCircle size={18} /> {label}</a>;
}
