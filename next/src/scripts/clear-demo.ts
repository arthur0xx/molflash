import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (!projectId || !clientEmail || !privateKey) throw new Error("Firebase Admin credentials are required.");
const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore(app);

async function removeDemoDocuments(collection: string) {
  const docs = await db.collection(collection).where("demo", "==", true).get();
  while (!docs.empty) {
    const batch = db.batch();
    docs.docs.slice(0, 450).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    if (docs.size <= 450) break;
  }
  console.log(`Cleared ${docs.size} demo document(s) from ${collection}`);
}

async function main() {
  for (const collection of ["categories", "services", "customers", "orders", "walletEntries", "auditLogs"]) await removeDemoDocuments(collection);
  console.log("Demo cleanup finished. Real documents without demo:true were not touched.");
}
main().catch((error) => { console.error(error); process.exit(1); });
