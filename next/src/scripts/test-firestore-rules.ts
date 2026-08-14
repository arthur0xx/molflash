import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

const projectId = "chrigsm-rules-test";
let environment: RulesTestEnvironment;

async function seed() {
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await setDoc(doc(database, "categories", "cat-live"), { name: "خدمات Server", isActive: true });
    await setDoc(doc(database, "services", "svc-live"), { title: "خدمة نشطة", isActive: true, categoryId: "cat-live" });
    await setDoc(doc(database, "services", "svc-hidden"), { title: "خدمة غير نشطة", isActive: false, categoryId: "cat-live" });
    await setDoc(doc(database, "customers", "customer-one"), { fullName: "العميل الأول", walletMad: 120 });
    await setDoc(doc(database, "customers", "customer-two"), { fullName: "العميل الثاني", walletMad: 80 });
    await setDoc(doc(database, "orders", "order-one"), { customerId: "customer-one", serviceId: "svc-live" });
    await setDoc(doc(database, "orders", "order-two"), { customerId: "customer-two", serviceId: "svc-live" });
    await setDoc(doc(database, "walletEntries", "wallet-one"), { customerId: "customer-one", amountMad: 120, reason: "رصيد اختبار" });
    await setDoc(doc(database, "walletEntries", "wallet-two"), { customerId: "customer-two", amountMad: 80, reason: "رصيد اختبار" });
    await setDoc(doc(database, "supportTickets", "support-one"), { customerId: "customer-one", subject: "رسالة العميل الأول", message: "تفاصيل اختبار الدعم" });
    await setDoc(doc(database, "supportTickets", "support-two"), { customerId: "customer-two", subject: "رسالة العميل الثاني", message: "تفاصيل اختبار الدعم" });
  });
}

async function run() {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });

  try {
    await seed();

    const visitor = environment.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(visitor, "categories", "cat-live")));
    await assertSucceeds(getDoc(doc(visitor, "services", "svc-live")));
    await assertFails(getDoc(doc(visitor, "services", "svc-hidden")));
    await assertFails(getDoc(doc(visitor, "customers", "customer-one")));
    await assertFails(getDoc(doc(visitor, "orders", "order-one")));
    await assertFails(getDoc(doc(visitor, "walletEntries", "wallet-one")));
    await assertFails(getDoc(doc(visitor, "supportTickets", "support-one")));
    await assertFails(setDoc(doc(visitor, "categories", "cat-visitor"), { name: "غير مسموح" }));

    const customerOne = environment.authenticatedContext("customer-one", { role: "customer" }).firestore();
    await assertSucceeds(getDoc(doc(customerOne, "customers", "customer-one")));
    await assertFails(getDoc(doc(customerOne, "customers", "customer-two")));
    await assertSucceeds(getDoc(doc(customerOne, "orders", "order-one")));
    await assertFails(getDoc(doc(customerOne, "orders", "order-two")));
    await assertSucceeds(getDoc(doc(customerOne, "walletEntries", "wallet-one")));
    await assertFails(getDoc(doc(customerOne, "walletEntries", "wallet-two")));
    await assertSucceeds(getDoc(doc(customerOne, "supportTickets", "support-one")));
    await assertFails(getDoc(doc(customerOne, "supportTickets", "support-two")));
    await assertFails(setDoc(doc(customerOne, "supportTickets", "support-client-write"), { customerId: "customer-one", subject: "محاولة غير مصرح بها" }));
    await assertFails(setDoc(doc(customerOne, "customers", "customer-one"), { walletMad: 9999 }, { merge: true }));
    await assertFails(setDoc(doc(customerOne, "walletEntries", "wallet-client-write"), { customerId: "customer-one", amountMad: 1, reason: "محاولة غير مصرح بها" }));
    await assertFails(setDoc(doc(customerOne, "services", "svc-client-write"), { isActive: true }));

    const adminClient = environment.authenticatedContext("admin-user", { role: "admin" }).firestore();
    await assertSucceeds(getDoc(doc(adminClient, "customers", "customer-one")));
    await assertSucceeds(getDoc(doc(adminClient, "orders", "order-one")));
    await assertSucceeds(getDoc(doc(adminClient, "walletEntries", "wallet-one")));
    await assertSucceeds(getDoc(doc(adminClient, "supportTickets", "support-one")));
    await assertFails(setDoc(doc(adminClient, "supportTickets", "support-admin-direct"), { customerId: "customer-one", subject: "يجب أن يفشل" }));
    await assertFails(setDoc(doc(adminClient, "categories", "cat-admin-direct"), { name: "يجب أن يفشل" }));
    await assertFails(setDoc(doc(adminClient, "services", "svc-admin-direct"), { isActive: true }));
    await assertFails(setDoc(doc(adminClient, "customers", "customer-one"), { walletMad: 9999 }, { merge: true }));
    await assertFails(setDoc(doc(adminClient, "walletEntries", "wallet-admin-direct"), { customerId: "customer-one", amountMad: 1, reason: "يجب أن يفشل" }));

    console.log("Firestore rules passed: visitor, customer isolation, support tickets, and direct wallet/CMC writes are protected.");
  } finally {
    await environment.cleanup();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
