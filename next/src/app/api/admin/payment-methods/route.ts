import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireOwner } from "@/lib/api/admin-auth";
import type { PaymentMethod, PaymentMethodType } from "@/lib/types";

const methodTypeSchema = z.enum(["cash_transfer", "bank_transfer", "electronic_gateway"]);
const providerSchema = z.enum(["cmi", "payzone", "custom"]);

const paymentMethodSchema = z.object({
  title: z.string().trim().min(2, "اسم وسيلة الدفع قصير جدًا").max(100, "اسم وسيلة الدفع طويل جدًا"),
  code: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "معرف وسيلة الدفع غير صحيح").min(2).max(60),
  type: methodTypeSchema,
  status: z.enum(["draft", "active", "disabled"]).default("draft"),
  scope: z.enum(["order", "wallet_topup", "both"]).default("both"),
  instructions: z.string().trim().max(2400, "تعليمات الدفع طويلة جدًا").default(""),
  sortOrder: z.number().int().min(0).max(10000).default(100),
  provider: providerSchema.optional(),
}).superRefine((method, context) => {
  if (method.type === "electronic_gateway" && method.status === "active") {
    context.addIssue({ code: "custom", path: ["status"], message: "لا يمكن تفعيل بوابة إلكترونية قبل اكتمال الربط الخادمي واختبارها." });
  }
  if (method.type !== "electronic_gateway" && method.status === "active" && method.instructions.trim().length < 8) {
    context.addIssue({ code: "custom", path: ["instructions"], message: "اكتب تعليمات تحويل واضحة قبل تفعيل الوسيلة." });
  }
  if (method.type === "electronic_gateway" && !method.provider) {
    context.addIssue({ code: "custom", path: ["provider"], message: "حدد مزود البوابة الإلكترونية." });
  }
});

function providerFor(type: PaymentMethodType, provider?: "cmi" | "payzone" | "custom") {
  return type === "electronic_gateway" ? provider || "custom" : "custom" as const;
}

export async function GET(request: NextRequest) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const db = adminDb();
  if (!db) return NextResponse.json({ error: "إعداد الدفع غير متاح حاليًا" }, { status: 503 });

  try {
    const methods = await db.collection("paymentMethods").orderBy("sortOrder", "asc").get();
    return NextResponse.json({ methods: methods.docs.map((document) => ({ id: document.id, ...document.data() })) as PaymentMethod[] });
  } catch (error) {
    console.error("Failed to list payment methods", error);
    return NextResponse.json({ error: "تعذر تحميل وسائل الدفع" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const db = adminDb();
  if (!db) return NextResponse.json({ error: "إعداد الدفع غير متاح حاليًا" }, { status: 503 });

  try {
    const parsed = paymentMethodSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "بيانات وسيلة الدفع غير صحيحة" }, { status: 400 });

    const existing = await db.collection("paymentMethods").where("code", "==", parsed.data.code).limit(1).get();
    if (!existing.empty) return NextResponse.json({ error: "معرف وسيلة الدفع مستخدم بالفعل" }, { status: 409 });

    const now = new Date().toISOString();
    const reference = db.collection("paymentMethods").doc();
    const method: PaymentMethod = {
      id: reference.id,
      ...parsed.data,
      provider: providerFor(parsed.data.type, parsed.data.provider),
      createdAt: now,
      updatedAt: now,
      createdBy: owner.uid,
      updatedBy: owner.uid,
    };

    const auditReference = db.collection("auditLogs").doc();
    const batch = db.batch();
    batch.create(reference, method);
    batch.create(auditReference, { action: "payment_method_created", paymentMethodId: reference.id, code: method.code, type: method.type, status: method.status, actorUid: owner.uid, at: now });
    await batch.commit();

    return NextResponse.json({ method }, { status: 201 });
  } catch (error) {
    console.error("Failed to create payment method", error);
    return NextResponse.json({ error: "تعذر إنشاء وسيلة الدفع" }, { status: 500 });
  }
}
