import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { demoSnapshot } from "../lib/demo-data";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (!projectId || !clientEmail || !privateKey) {
  throw new Error("Firebase Admin credentials are required. Copy .env.example to .env.local and fill server-only values.");
}
const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore(app);

async function writeCollection(name: keyof typeof demoSnapshot) {
  const batch = db.batch();
  for (const item of demoSnapshot[name] as Array<{ id: string }>) {
    const { id, ...data } = item;
    batch.set(db.collection(name).doc(id), { ...data, demo: true, updatedAt: new Date().toISOString() }, { merge: true });
  }
  await batch.commit();
  console.log(`Seeded ${name}`);
}

async function main() {
  for (const collection of ["categories", "services", "customers", "orders", "walletEntries"] as const) await writeCollection(collection);
  await db.collection("auditLogs").doc("demo-seed").set({ demo: true, event: "seed", at: new Date().toISOString(), actor: "system" });
  console.log("Demo seed finished. Run npm run clear:demo to remove only demo documents.");
}
main().catch((error) => { console.error(error); process.exit(1); });
