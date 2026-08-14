import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type DocumentReference } from "firebase-admin/firestore";

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
const demoCustomerIds = ["cus-yassine", "cus-fatima", "cus-omar"];
const fixtureIds: Record<string, string[]> = {
  categories: ["tool-activation", "server-services", "tool-rental", "misc"],
  services: ["svc-frp-samsung", "svc-honor-frp", "svc-tsl", "svc-eft", "svc-alltool", "svc-chatgpt", "svc-gaming"],
  customers: demoCustomerIds,
  orders: ["ORD-10452", "ORD-10451", "ORD-10450", "ORD-10449"],
  walletEntries: ["wal-1", "wal-2", "wal-3"],
  auditLogs: ["demo-seed"],
};
const trackedCollections = ["categories", "services", "customers", "orders", "walletEntries", "supportTickets", "auditLogs"];

type AuthManifest = Array<{ uid: string; email: string }>;
type CandidateReferences = Map<string, Map<string, DocumentReference>>;

function newCandidates(): CandidateReferences {
  return new Map(trackedCollections.map((collection) => [collection, new Map<string, DocumentReference>()]));
}

function addReference(candidates: CandidateReferences, collection: string, reference: DocumentReference) {
  const entries = candidates.get(collection) || new Map<string, DocumentReference>();
  entries.set(reference.id, reference);
  candidates.set(collection, entries);
}

async function collectTaggedDocuments(candidates: CandidateReferences) {
  for (const collection of trackedCollections) {
    const snapshot = await db.collection(collection).where("demo", "==", true).get();
    snapshot.docs.forEach((document) => addReference(candidates, collection, document.ref));
  }
}

async function collectFixtureDocuments(candidates: CandidateReferences) {
  for (const [collection, ids] of Object.entries(fixtureIds)) {
    const snapshots = await Promise.all(ids.map((id) => db.collection(collection).doc(id).get()));
    snapshots.filter((snapshot) => snapshot.exists).forEach((snapshot) => addReference(candidates, collection, snapshot.ref));
  }
}

async function collectCustomerLinkedDocuments(candidates: CandidateReferences) {
  for (const collection of ["orders", "walletEntries", "supportTickets", "auditLogs"]) {
    const snapshot = await db.collection(collection).where("customerId", "in", demoCustomerIds).get();
    snapshot.docs.forEach((document) => addReference(candidates, collection, document.ref));
  }
  const actorSnapshot = await db.collection("auditLogs").where("actorUid", "in", ["admin-demo", "demo-admin"]).get();
  actorSnapshot.docs.forEach((document) => addReference(candidates, "auditLogs", document.ref));
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

async function removeCandidates(candidates: CandidateReferences) {
  if (dryRun) return;
  for (const entries of candidates.values()) {
    const references = Array.from(entries.values());
    for (let start = 0; start < references.length; start += 450) {
      const batch = db.batch();
      references.slice(start, start + 450).forEach((reference) => batch.delete(reference));
      await batch.commit();
    }
  }
}

async function removeDemoAuth(users: AuthManifest) {
  if (dryRun || !deleteDemoAuthUsers) return;
  for (const user of users) await auth.deleteUser(user.uid);
}

async function main() {
  const candidates = newCandidates();
  await collectTaggedDocuments(candidates);
  await collectFixtureDocuments(candidates);
  await collectCustomerLinkedDocuments(candidates);
  const authenticationUsers = await demoAuthenticationUsers();
  const documents = Object.fromEntries(Array.from(candidates.entries()).map(([collection, entries]) => [collection, Array.from(entries.keys()).sort()]));

  await removeCandidates(candidates);
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
        ? "Demo-marked, fixture, and demo-account-linked documents plus explicitly listed demo Authentication users were deleted."
        : "Demo-marked, fixture, and demo-account-linked documents were deleted. Authentication users were retained.",
  };
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
