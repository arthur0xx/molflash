import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Clock3 } from "lucide-react";
import { formatMAD, type Service } from "@/lib/types";

export function ServiceCard({ service, categoryName }: { service: Service; categoryName?: string }) {
  return (
    <article className="service-card">
      <Link href={`/service/${service.slug}`} aria-label={`عرض تفاصيل ${service.title}`} className="service-card-link">
        <div className="service-card-media">
          {service.imageUrl ? (
            <Image className="service-image" src={service.imageUrl} alt={`صورة ${service.title}`} fill sizes="(max-width: 600px) calc(100vw - 32px), (max-width: 900px) calc(50vw - 32px), 360px" />
          ) : (
            <span className="service-glyph" aria-hidden="true">{service.title.slice(0, 2).toUpperCase()}</span>
          )}
          {service.badge && <span className="tag tag-blue">{service.badge}</span>}
        </div>
        <div className="service-card-content">
          <p className="eyebrow">{categoryName || "خدمة رقمية"}</p>
          <h3>{service.title}</h3>
          <p className="service-description">{service.description}</p>
        </div>
        <div className="service-meta"><Clock3 size={15} /> {service.delivery}</div>
        <div className="service-card-footer">
          <strong>{formatMAD(service.priceMad)}</strong>
          <span className="round-link" aria-hidden="true"><ArrowLeft size={17} /></span>
        </div>
      </Link>
    </article>
  );
}
