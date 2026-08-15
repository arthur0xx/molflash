import { NextRequest, NextResponse } from "next/server";
import type { DocumentReference } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/api/admin-auth";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

const OWNER = {
  uid: "h32apgdkHIeGsO3vaHYFOruLmaw2",
  email: "afficheurma.lcd@gmail.com",
};
const QA_EMAIL = "qa.signup.20260814.2349@chrigsm.test";
const LINKED_COLLECTIONS = ["orders", "walletEntries", "supportTickets"] as const;

async function deleteInBatches(db: NonNullable<ReturnType<typeof adminDb>>, references: DocumentReference[]) {
  for (let start = 0; start < references.length; start += 450) {
    const batch = db.batch();
    references.slice(start, start + 450).forEach((reference) => batch.delete(reference));
    await batch.commit();
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin || admin.uid !== OWNER.uid || admin.email !== OWNER.email) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const db = adminDb();
  const auth = adminAuth();
  if (!db || !auth) {
    return NextResponse.json({ error: "إعداد Firebase الخادمي غير مكتمل" }, { status: 503 });
  }

  try {
    const qaUser = await auth.getUserByEmail(QA_EMAIL);
    if (qaUser.uid === OWNER.uid || qaUser.email === OWNER.email) {
      return NextResponse.json({ error: "توقفت العملية لحماية حساب المالك" }, { status: 409 });
    }

    const candidates = new Map<string, DocumentReference>();
    const add = (reference: DocumentReference) => candidates.set(reference.path, reference);
    const customer = db.collection("customers").doc(qaUser.uid);
    const customerSnapshot = await customer.get();
    if (customerSnapshot.exists) add(customer);

    for (const collection of LINKED_COLLECTIONS) {
      const snapshot = await db.collection(collection).where("customerId", "==", qaUser.uid).get();
      snapshot.docs.forEach((document) => add(document.ref));
    }

    const [customerAudit, actorAudit] = await Promise.all([
      db.collection("auditLogs").where("customerId", "==", qaUser.uid).get(),
      db.collection("auditLogs").where("actorUid", "==", qaUser.uid).get(),
    ]);
    customerAudit.docs.forEach((document) => add(document.ref));
    actorAudit.docs.forEach((document) => add(document.ref));

    await deleteInBatches(db, Array.from(candidates.values()));
    await auth.deleteUser(qaUser.uid);

    return NextResponse.json({
      deleted: {
        authUser: qaUser.uid,
        documents: candidates.size,
      },
    });
  } catch (error: unknown) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "auth/user-not-found") {
      return NextResponse.json({ error: "حساب الاختبار غير موجود" }, { status: 404 });
    }
    console.error("Failed to clean up QA account", error);
    return NextResponse.json({ error: "تعذر تنظيف حساب الاختبار" }, { status: 500 });
  }
}
