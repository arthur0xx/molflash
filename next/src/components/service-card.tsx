import Link from "next/link";
import { ArrowLeft, Clock3 } from "lucide-react";
import { formatMAD, type Service } from "@/lib/types";

export function ServiceCard({ service, categoryName }: { service: Service; categoryName?: string }) {
  return (
    <article className="service-card">
      <div className="service-card-top">
        <span className="service-glyph">{service.title.slice(0, 2).toUpperCase()}</span>
        {service.badge && <span className="tag tag-blue">{service.badge}</span>}
      </div>
      <p className="eyebrow">{categoryName || "خدمة رقمية"}</p>
      <h3>{service.title}</h3>
      <p className="service-description">{service.description}</p>
      <div className="service-meta"><Clock3 size={15} /> {service.delivery}</div>
      <div className="service-card-footer">
        <strong>{formatMAD(service.priceMad)}</strong>
        <Link href={`/service/${service.slug}`} aria-label={`عرض ${service.title}`} className="round-link"><ArrowLeft size={17} /></Link>
      </div>
    </article>
  );
}
