import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { demoSnapshot } from "../lib/demo-data";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (!projectId || !clientEmail || !privateKey) {
  throw new Error("Firebase Admin credentials are required. Copy .env.example to .env.local and fill server-only values.");
}

function requiredDemoPassword(name: "DEMO_ADMIN_PASSWORD" | "DEMO_CUSTOMER_PASSWORD") {
  const value = process.env[name];
  if (!value || value.length < 12) throw new Error(`${name} must be set to a strong demo-only password before seeding.`);
  return value;
}

const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore(app);
const auth = getAuth(app);

type DemoUser = { uid: string; email: string; password: string; displayName: string; role?: "admin" };
const demoUsers: DemoUser[] = [
  { uid: "admin-demo", email: "admin@chrigsm.test", password: requiredDemoPassword("DEMO_ADMIN_PASSWORD"), displayName: "مدير ChriGsm", role: "admin" },
  { uid: "cus-yassine", email: "yassine.demo@chrigsm.test", password: requiredDemoPassword("DEMO_CUSTOMER_PASSWORD"), displayName: "ياسين الفاسي" },
];

async function ensureDemoAuth() {
  for (const user of demoUsers) {
    try {
      await auth.updateUser(user.uid, { email: user.email, password: user.password, displayName: user.displayName, emailVerified: true, disabled: false });
    } catch (error: unknown) {
      if (typeof error === "object" && error && "code" in error && error.code === "auth/user-not-found") {
        await auth.createUser({ uid: user.uid, email: user.email, password: user.password, displayName: user.displayName, emailVerified: true });
      } else {
        throw error;
      }
    }
    await auth.setCustomUserClaims(user.uid, user.role ? { role: user.role } : null);
  }
  console.log("Prepared Firebase Auth demo users");
}

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
  await ensureDemoAuth();
  for (const collection of ["categories", "services", "customers", "orders", "walletEntries"] as const) await writeCollection(collection);
  await db.collection("auditLogs").doc("demo-seed").set({ demo: true, event: "seed", at: new Date().toISOString(), actor: "system" });
  console.log("Demo seed finished. Run npm run clear:demo to remove demo documents or npm run clear:demo:all to also delete demo Authentication users.");
}

main().catch((error) => { console.error(error); process.exit(1); });
