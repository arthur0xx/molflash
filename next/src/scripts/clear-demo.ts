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
const dryRun = process.argv.includes("--dry-run");
const deleteDemoAuthUsers = process.argv.includes("--delete-demo-auth");
const demoAuthUids = ["admin-demo", "cus-yassine"];
const demoCollections = ["categories", "services", "customers", "orders", "walletEntries", "supportTickets", "auditLogs"];

type DocumentManifest = Record<string, string[]>;
type AuthManifest = Array<{ uid: string; email: string }>;

async function demoDocuments(collection: string) {
  return db.collection(collection).where("demo", "==", true).get();
}

async function removeDemoDocuments(collection: string) {
  const snapshot = await demoDocuments(collection);
  const ids = snapshot.docs.map((document) => document.id);
  if (dryRun || snapshot.empty) return ids;

  for (let start = 0; start < snapshot.docs.length; start += 450) {
    const batch = db.batch();
    snapshot.docs.slice(start, start + 450).forEach((document) => batch.delete(document.ref));
    await batch.commit();
  }
  return ids;
}

async function demoAuthenticationUsers(): Promise<AuthManifest> {
  const users: AuthManifest = [];
  for (const uid of demoAuthUids) {
    try {
      const user = await auth.getUser(uid);
      users.push({ uid: user.uid, email: user.email || "" });
    } catch (error: unknown) {
      if (typeof error === "object" && error && "code" in error && error.code === "auth/user-not-found") continue;
      throw error;
    }
  }
  return users;
}

async function removeDemoAuth(users: AuthManifest) {
  if (dryRun || !deleteDemoAuthUsers) return;
  for (const user of users) await auth.deleteUser(user.uid);
}

async function main() {
  const documents: DocumentManifest = {};
  for (const collection of demoCollections) documents[collection] = await removeDemoDocuments(collection);
  const authenticationUsers = await demoAuthenticationUsers();
  await removeDemoAuth(authenticationUsers);

  const manifest = {
    generatedAt: new Date().toISOString(),
    mode: dryRun ? "dry-run" : "execute",
    documents,
    authenticationUsers,
    authenticationDeletionRequested: deleteDemoAuthUsers,
    note: dryRun
      ? "No data was deleted. Review this manifest before executing cleanup."
      : deleteDemoAuthUsers
        ? "Only documents with demo:true and explicitly listed demo Authentication users were deleted."
        : "Only documents with demo:true were deleted. Authentication users were retained.",
  };
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
