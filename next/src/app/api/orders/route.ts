import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireVerifiedUser } from "@/lib/api/admin-auth";
import type { DynamicField } from "@/lib/types";
import { notifyOrderEvent } from "@/lib/order-notifications";

const createOrderSchema = z.object({
  serviceId: z.string().trim().min(1, "الخدمة غير محددة"),
  formData: z.record(z.string(), z.string()).refine((value) => Object.keys(value).length <= 20, "عدد حقول الطلب غير صحيح"),
});

class OrderRouteError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

const defaultEmailField: DynamicField = {
  id: "email",
  label: "البريد الإلكتروني لاستلام التفعيل",
  type: "email",
  required: true,
  placeholder: "name@example.com",
};

function normalizeRequestFields(fields: unknown): DynamicField[] {
  const supportedTypes = new Set<DynamicField["type"]>(["text", "email", "select", "textarea"]);
  const usedIds = new Set<string>();
  const normalized = Array.isArray(fields) ? fields.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const field = candidate as Record<string, unknown>;
    if (typeof field.id !== "string" || !field.id.trim() || usedIds.has(field.id) || typeof field.label !== "string" || !field.label.trim() || typeof field.required !== "boolean" || typeof field.type !== "string" || !supportedTypes.has(field.type as DynamicField["type"])) return [];
    const options = Array.isArray(field.options) && field.options.every((option) => typeof option === "string" && option.trim()) ? field.options : undefined;
    if (field.type === "select" && (!options || options.length === 0)) return [];
    usedIds.add(field.id);
    return [{ id: field.id, label: field.label, type: field.type as DynamicField["type"], required: field.required, placeholder: typeof field.placeholder === "string" ? field.placeholder : undefined, options }];
  }) : [];
  return normalized.length ? normalized : [defaultEmailField];
}

function validateFormData(input: Record<string, string>, fields: DynamicField[]) {
  const knownFields = new Set(fields.map((field) => field.id));
  const unknownFields = Object.keys(input).filter((key) => !knownFields.has(key));
  if (unknownFields.length) throw new OrderRouteError(400, "تتضمن بيانات الطلب حقولًا غير معتمدة");

  const normalized: Record<string, string> = {};
  for (const field of fields) {
    const value = (input[field.id] || "").trim();
    if (field.required && !value) throw new OrderRouteError(400, `الحقل «${field.label}» مطلوب`);
    if (!value) continue;
    if (value.length > 500) throw new OrderRouteError(400, `الحقل «${field.label}» طويل جدًا`);
    if (field.type === "email" && !z.string().email().safeParse(value).success) throw new OrderRouteError(400, `الحقل «${field.label}» غير صحيح`);
    if (field.type === "select" && (!field.options || !field.options.includes(value))) throw new OrderRouteError(400, `اختيار الحقل «${field.label}» غير صحيح`);
    normalized[field.id] = value;
  }
  return normalized;
}

export async function POST(request: NextRequest) {
  const user = await requireVerifiedUser(request);
  if (!user) return NextResponse.json({ error: "أكد بريدك الإلكتروني ثم سجّل الدخول لإرسال الطلب" }, { status: 401 });

  const db = adminDb();
  if (!db) return NextResponse.json({ error: "خدمة الطلبات غير متاحة حاليًا" }, { status: 503 });

  try {
    const parsed = createOrderSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "بيانات الطلب غير مكتملة" }, { status: 400 });

    const serviceReference = db.collection("services").doc(parsed.data.serviceId);
    const customerReference = db.collection("customers").doc(user.uid);
    const [serviceSnapshot, customerSnapshot] = await Promise.all([serviceReference.get(), customerReference.get()]);
    if (!customerSnapshot.exists) return NextResponse.json({ error: "ملف العميل غير موجود" }, { status: 404 });
    if (!serviceSnapshot.exists || serviceSnapshot.data()?.isActive !== true) return NextResponse.json({ error: "الخدمة غير متاحة" }, { status: 404 });

    const service = serviceSnapshot.data() as { priceMad?: unknown; fields?: unknown; title?: unknown };
    if (typeof service.priceMad !== "number" || service.priceMad < 0 || !Array.isArray(service.fields)) return NextResponse.json({ error: "بيانات الخدمة غير صحيحة" }, { status: 409 });
    const formData = validateFormData(parsed.data.formData, normalizeRequestFields(service.fields));

    const now = new Date().toISOString();
    const orderReference = db.collection("orders").doc();
    const auditReference = db.collection("auditLogs").doc();
    const batch = db.batch();
    batch.create(orderReference, {
      customerId: user.uid,
      serviceId: serviceReference.id,
      status: "new",
      totalMad: service.priceMad,
      createdAt: now,
      updatedAt: now,
      formData,
      statusHistory: [{ status: "new", at: now, note: "تم إنشاء الطلب" }],
    });
    batch.create(auditReference, { action: "order_created", orderId: orderReference.id, customerId: user.uid, actorUid: user.uid, at: now });
    await batch.commit();
    await notifyOrderEvent({ orderId: orderReference.id, customerId: user.uid, serviceTitle: typeof service.title === "string" ? service.title : "خدمة رقمية", event: "received" });

    return NextResponse.json({ ok: true, id: orderReference.id }, { status: 201 });
  } catch (error) {
    if (error instanceof OrderRouteError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Failed to create order", error);
    return NextResponse.json({ error: "تعذر إنشاء الطلب" }, { status: 500 });
  }
}
