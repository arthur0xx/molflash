import { MessageCircle } from "lucide-react";

type WhatsAppSupportLinkProps = {
  className?: string;
  label?: string;
  message?: string;
};

/**
 * رقم دعم عام يملكه المتجر. يستطيع إعداد النشر العام تجاوزه لاحقًا عبر
 * NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER، بينما تظل رموز Cloud API خادمية فقط.
 */
const DEFAULT_SUPPORT_NUMBER = "212770903699";
const DEFAULT_SUPPORT_MESSAGE = "مرحبًا، أحتاج مساعدة بخصوص خدمات ChriGsm.";

function normalizedSupportNumber() {
  const configured = process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER?.replace(/\D/g, "") || DEFAULT_SUPPORT_NUMBER;
  return /^212[67]\d{8}$/.test(configured) ? configured : DEFAULT_SUPPORT_NUMBER;
}

function supportHref(message: string) {
  const normalizedMessage = message.trim().slice(0, 500) || DEFAULT_SUPPORT_MESSAGE;
  return `https://wa.me/${normalizedSupportNumber()}?text=${encodeURIComponent(normalizedMessage)}`;
}

/**
 * رابط دعم عام فقط؛ الإرسال الآلي وتحقق واتساب يظلان مقيدين بخدمة Cloud API
 * خادمية مفعّلة رسميًا. لا يُجرى أي طلب API من هذا المكوّن.
 */
export function WhatsAppSupportLink({
  className = "support-link",
  label = "واتساب",
  message = DEFAULT_SUPPORT_MESSAGE,
}: WhatsAppSupportLinkProps) {
  return <a href={supportHref(message)} className={className} target="_blank" rel="noopener noreferrer" aria-label="التواصل مع دعم ChriGsm عبر واتساب"><MessageCircle size={18} /> {label}</a>;
}
