import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { deleteCloudinaryImage } from "@/lib/cloudinary";
import { requireAdmin } from "@/lib/api/admin-auth";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { Customer } from "@/lib/types";

const lifecycleSchema = z.object({
  action: z.enum(["block", "unblock"]),
  reason: z.string().trim().max(240, "سبب الحظر طويل جدًا").optional().default(""),
}).superRefine((value, context) => {
  if (value.action === "block" && value.reason.length < 4) {
    context.addIssue({ code: "custom", path: ["reason"], message: "اكتب سبب الحظر بوضوح (4 أحرف على الأقل)." });
  }
});

class CustomerLifecycleError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function customerFromRaw(id: string, raw: Record<string, unknown>): Customer {
  return {
    id,
    fullName: String(raw.fullName || "عميل ChriGsm"),
    phone: String(raw.phone || ""),
    email: String(raw.email || ""),
    walletMad: typeof raw.walletMad === "number" ? raw.walletMad : 0,
    ordersCount: typeof raw.ordersCount === "number" ? raw.ordersCount : 0,
    lastActivity: String(raw.lastActivity || raw.updatedAt || raw.createdAt || ""),
    whatsappEnabled: Boolean(raw.whatsappEnabled),
    avatarUrl: typeof raw.avatarUrl === "string" && raw.avatarUrl.startsWith("https://") ? raw.avatarUrl : undefined,
    avatarPublicId: typeof raw.avatarPublicId === "string" && raw.avatarPublicId.startsWith("chrigsm/profiles/") ? raw.avatarPublicId : undefined,
    accountStatus: raw.accountStatus === "blocked" ? "blocked" : "active",
    blockedAt: typeof raw.blockedAt === "string" ? raw.blockedAt : undefined,
    blockedReason: typeof raw.blockedReason === "string" ? raw.blockedReason : undefined,
  };
}

async function requireCustomerRecord(customerId: string, actorUid: string) {
  if (!customerId) throw new CustomerLifecycleError("معرف العميل غير صحيح.", 400);
  if (customerId === actorUid) throw new CustomerLifecycleError("لا يمكن تنفيذ هذا الإجراء على حساب المدير الحالي.", 409);

  const db = adminDb();
  if (!db) throw new CustomerLifecycleError("خدمة إدارة العملاء غير متاحة حاليًا.", 503);
  const reference = db.collection("customers").doc(customerId);
  const snapshot = await reference.get();
  if (!snapshot.exists) throw new CustomerLifecycleError("ملف العميل غير موجود.", 404);

  const raw = snapshot.data() as Record<string, unknown>;
  if (raw.role === "admin") throw new CustomerLifecycleError("لا يمكن تعديل حساب إداري من إجراءات العملاء.", 409);
  return { db, reference, raw };
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  try {
    const { id } = await context.params;
    const customerId = id.trim();
    const parsed = lifecycleSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "إجراء العميل غير صالح." }, { status: 400 });

    const { db, reference, raw } = await requireCustomerRecord(customerId, admin.uid);
    const auth = adminAuth();
    if (!auth) throw new CustomerLifecycleError("خدمة إدارة الهوية غير متاحة حاليًا.", 503);

    const isBlocked = raw.accountStatus === "blocked";
    const wantsBlock = parsed.data.action === "block";
    const now = new Date().toISOString();

    if (wantsBlock !== isBlocked) {
      await auth.updateUser(customerId, { disabled: wantsBlock });
      if (wantsBlock) await auth.revokeRefreshTokens(customerId);
    }

    const update = wantsBlock
      ? { accountStatus: "blocked", blockedAt: now, blockedReason: parsed.data.reason, updatedAt: now, updatedBy: admin.uid }
      : { accountStatus: "active", blockedAt: "", blockedReason: "", updatedAt: now, updatedBy: admin.uid };

    await db.runTransaction(async (transaction) => {
      transaction.update(reference, update);
      transaction.create(db.collection("auditLogs").doc(), {
        action: wantsBlock ? "customer_blocked" : "customer_unblocked",
        customerId,
        actorUid: admin.uid,
        reason: wantsBlock ? parsed.data.reason : "",
        at: now,
      });
    });

    return NextResponse.json({
      customer: customerFromRaw(customerId, { ...raw, ...update }),
      message: wantsBlock ? "تم حظر العميل وإنهاء جلساته الحالية." : "تم إلغاء حظر العميل ويمكنه تسجيل الدخول من جديد.",
    });
  } catch (error) {
    if (error instanceof CustomerLifecycleError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Failed to update customer lifecycle", error);
    return NextResponse.json({ error: "تعذر تحديث حالة العميل." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  try {
    const { id } = await context.params;
    const customerId = id.trim();
    const { db, reference, raw } = await requireCustomerRecord(customerId, admin.uid);
    const currentBalance = typeof raw.walletMad === "number" ? raw.walletMad : 0;
    if (currentBalance !== 0) throw new CustomerLifecycleError("لا يمكن حذف عميل لديه رصيد. سوِّ الرصيد أو احظر الحساب بدلًا من ذلك.", 409);

    const [orders, tickets, walletEntries] = await Promise.all([
      db.collection("orders").where("customerId", "==", customerId).limit(1).get(),
      db.collection("supportTickets").where("customerId", "==", customerId).limit(225).get(),
      db.collection("walletEntries").where("customerId", "==", customerId).limit(225).get(),
    ]);
    if (!orders.empty) throw new CustomerLifecycleError("لا يمكن حذف عميل لديه طلبات محفوظة. استخدم الحظر للحفاظ على سجل الطلبات.", 409);
    if (tickets.size === 225 || walletEntries.size === 225) throw new CustomerLifecycleError("سجل العميل كبير ولا يمكن حذفه دفعة واحدة. استخدم الحظر ثم راجع السجل.", 409);

    const auth = adminAuth();
    if (!auth) throw new CustomerLifecycleError("خدمة إدارة الهوية غير متاحة حاليًا.", 503);
    try {
      await auth.revokeRefreshTokens(customerId);
      await auth.deleteUser(customerId);
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (code !== "auth/user-not-found") throw error;
    }

    const now = new Date().toISOString();
    const avatarPublicId = typeof raw.avatarPublicId === "string" ? raw.avatarPublicId : "";
    const batch = db.batch();
    batch.delete(reference);
    for (const ticket of tickets.docs) batch.delete(ticket.ref);
    for (const entry of walletEntries.docs) batch.delete(entry.ref);
    batch.create(db.collection("auditLogs").doc(), {
      action: "customer_deleted",
      customerId,
      actorUid: admin.uid,
      deletedTicketCount: tickets.size,
      deletedWalletEntryCount: walletEntries.size,
      at: now,
    });
    await batch.commit();

    if (avatarPublicId) void deleteCloudinaryImage(avatarPublicId, "profile").catch((error) => console.error("Failed to delete customer avatar", error));
    return NextResponse.json({ deleted: true, deletedTicketCount: tickets.size, deletedWalletEntryCount: walletEntries.size });
  } catch (error) {
    if (error instanceof CustomerLifecycleError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Failed to delete customer", error);
    return NextResponse.json({ error: "تعذر حذف حساب العميل." }, { status: 500 });
  }
}
