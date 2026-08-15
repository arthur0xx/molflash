"use client";

import Image from "next/image";
import { useId } from "react";
import { Pencil, Trash2, UserRound } from "lucide-react";

type MediaImageControlProps = {
  imageUrl?: string;
  alt: string;
  fallbackLabel: string;
  kind: "service" | "profile";
  onSelect: (file: File) => void;
  onRemove: () => void;
  disabled?: boolean;
  uploading?: boolean;
};

export function MediaImageControl({ imageUrl, alt, fallbackLabel, kind, onSelect, onRemove, disabled = false, uploading = false }: MediaImageControlProps) {
  const inputId = useId();
  const hasImage = Boolean(imageUrl);
  const label = kind === "profile" ? "صورة الحساب" : "صورة الخدمة";

  return <section className={`media-image-control ${kind}`} aria-label={label}>
    <div className="media-image-preview">
      {hasImage ? <Image src={imageUrl!} alt={alt} width={128} height={128} sizes="128px"/> : kind === "profile" ? <UserRound aria-label="الصورة الافتراضية"/> : <span aria-label="صورة خدمة افتراضية">{fallbackLabel.slice(0, 2)}</span>}
    </div>
    <div className="media-image-actions">
      <div><b>{hasImage ? label : `${label} افتراضية`}</b><small>{hasImage ? "استخدم القلم للاستبدال أو أزل الصورة للعودة إلى الافتراضية." : "ارفع صورة عند الحاجة؛ لن يظهر الرابط لأي مستخدم."}</small></div>
      <div className="media-image-buttons">
        <label className="icon-action-button" htmlFor={inputId} title={hasImage ? "استبدال الصورة" : "إضافة صورة"} aria-label={hasImage ? "استبدال الصورة" : "إضافة صورة"}>
          <Pencil size={16}/><input id={inputId} type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled || uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) onSelect(file); event.currentTarget.value = ""; }}/>
        </label>
        {hasImage && <button type="button" className="icon-action-button danger" title="إزالة الصورة" aria-label="إزالة الصورة" onClick={onRemove} disabled={disabled || uploading}><Trash2 size={16}/></button>}
      </div>
    </div>
    {uploading && <p className="media-image-progress">جارٍ رفع الصورة…</p>}
  </section>;
}
