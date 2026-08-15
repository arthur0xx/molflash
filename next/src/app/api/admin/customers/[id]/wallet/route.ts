import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/api/admin-auth";
import type { Customer, WalletEntry } from "@/lib/types";

const adjustWalletSchema = z.object({
  amountMad: z.number().finite().min(-1000000, "قيمة التعديل أصغر من الحد المسموح").max(1000000, "قيمة التعديل أكبر من الحد المسموح").refine((value) => value !== 0, "قيمة التعديل لا يمكن أن تكون صفرًا").refine((value) => Math.round(value * 100) === value * 100, "قيمة التعديل يجب أن تكون بمنزلتين عشريتين كحد أقصى"),
  reason: z.string().trim().min(4, "سبب تعديل الرصيد قصير جدًا").max(240, "سبب تعديل الرصيد طويل جدًا"),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const db = adminDb();
  if (!db) return NextResponse.json({ error: "خدمة تعديل الرصيد غير متاحة حاليًا" }, { status: 503 });

  try {
    const { id } = await context.params;
    const customerId = id.trim();
    if (!customerId) return NextResponse.json({ error: "معرف العميل غير صحيح" }, { status: 400 });

    const parsed = adjustWalletSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "بيانات المحفظة غير صحيحة" }, { status: 400 });

    const now = new Date().toISOString();
    const customerReference = db.collection("customers").doc(customerId);
    const walletEntryReference = db.collection("walletEntries").doc();
    const auditReference = db.collection("auditLogs").doc();

    const result = await db.runTransaction(async (transaction) => {
      const customerSnapshot = await transaction.get(customerReference);
      if (!customerSnapshot.exists) throw new WalletRouteError("العميل غير موجود", 404);

      const customerData = customerSnapshot.data() as Omit<Customer, "id">;
      const previousBalance = customerData.walletMad;
      if (!Number.isFinite(previousBalance) || previousBalance < 0) {
        throw new WalletRouteError("رصيد العميل الحالي غير صالح؛ أوقف التعديل حتى المراجعة", 409);
      }

      const nextBalance = Math.round((previousBalance + parsed.data.amountMad) * 100) / 100;
      if (nextBalance < 0) {
        throw new WalletRouteError(`لا يمكن خصم ${Math.abs(parsed.data.amountMad)} د.م. لأن الرصيد المتاح هو ${previousBalance} د.م.`, 409);
      }

      const walletEntry: WalletEntry = {
        id: walletEntryReference.id,
        customerId,
        amountMad: parsed.data.amountMad,
        reason: parsed.data.reason,
        createdAt: now,
        createdBy: admin.uid,
      };

      transaction.update(customerReference, { walletMad: nextBalance, lastActivity: now, updatedAt: now, updatedBy: admin.uid });
      transaction.create(walletEntryReference, walletEntry);
      transaction.create(auditReference, {
        action: "wallet_adjusted",
        customerId,
        walletEntryId: walletEntryReference.id,
        amountMad: parsed.data.amountMad,
        previousBalance,
        nextBalance,
        reason: parsed.data.reason,
        actorUid: admin.uid,
        at: now,
      });

      return {
        customer: { id: customerId, ...customerData, walletMad: nextBalance, lastActivity: now } as Customer,
        walletEntry,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof WalletRouteError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Failed to adjust wallet", error);
    return NextResponse.json({ error: "تعذر تعديل رصيد العميل" }, { status: 500 });
  }
}

class WalletRouteError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
