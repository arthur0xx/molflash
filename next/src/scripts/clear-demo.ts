import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (!projectId || !clientEmail || !privateKey) throw new Error("Firebase Admin credentials are required.");

const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore(app);
const auth = getAuth(app);
const deleteDemoAuthUsers = process.argv.includes("--delete-demo-auth");
const demoAuthUids = ["admin-demo", "cus-yassine"];

async function removeDemoDocuments(collection: string) {
  let removed = 0;
  while (true) {
    const snapshot = await db.collection(collection).where("demo", "==", true).limit(450).get();
    if (snapshot.empty) break;
    const batch = db.batch();
    snapshot.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
    removed += snapshot.size;
  }
  console.log(`Cleared ${removed} demo document(s) from ${collection}`);
}

async function removeDemoAuth() {
  for (const uid of demoAuthUids) {
    try {
      await auth.deleteUser(uid);
      console.log(`Deleted demo Authentication user ${uid}`);
    } catch (error: unknown) {
      if (typeof error === "object" && error && "code" in error && error.code === "auth/user-not-found") continue;
      throw error;
    }
  }
}

async function main() {
  for (const collection of ["categories", "services", "customers", "orders", "walletEntries", "supportTickets", "auditLogs"]) await removeDemoDocuments(collection);
  if (deleteDemoAuthUsers) await removeDemoAuth();
  console.log(deleteDemoAuthUsers
    ? "Demo documents and explicitly listed demo Authentication users were removed. Real documents without demo:true were not touched."
    : "Demo documents were removed. Authentication users were not deleted; rerun with --delete-demo-auth only after final approval.");
}

main().catch((error) => { console.error(error); process.exit(1); });
