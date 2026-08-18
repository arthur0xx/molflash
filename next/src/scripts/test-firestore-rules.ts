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
    await setDoc(doc(database, "servicePrivate", "svc-live"), { supplierCostSnapshot: 12.5, sourceCurrency: "USD", supplierServiceId: "123" });
    await setDoc(doc(database, "customers", "customer-one"), { fullName: "العميل الأول", walletMad: 120 });
    await setDoc(doc(database, "customers", "customer-two"), { fullName: "العميل الثاني", walletMad: 80, accountStatus: "blocked" });
    await setDoc(doc(database, "orders", "order-one"), { customerId: "customer-one", serviceId: "svc-live" });
    await setDoc(doc(database, "orders", "order-two"), { customerId: "customer-two", serviceId: "svc-live" });
    await setDoc(doc(database, "walletEntries", "wallet-one"), { customerId: "customer-one", amountMad: 120, reason: "رصيد اختبار" });
    await setDoc(doc(database, "walletEntries", "wallet-two"), { customerId: "customer-two", amountMad: 80, reason: "رصيد اختبار" });
    await setDoc(doc(database, "paymentMethods", "cash-plus"), { title: "Cash Plus", status: "active", type: "cash_transfer", scope: "both", instructions: "مرجع {paymentReference}", sortOrder: 10 });
    await setDoc(doc(database, "payments", "CHR-CUSTOMER1"), { customerId: "customer-one", purpose: "wallet_topup", amountMad: 100, status: "manual_transfer_pending" });
    await setDoc(doc(database, "payments", "CHR-CUSTOMER2"), { customerId: "customer-two", purpose: "order", orderId: "order-two", amountMad: 80, status: "manual_transfer_pending" });
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
    await assertFails(getDoc(doc(visitor, "servicePrivate", "svc-live")));
    await assertFails(getDoc(doc(visitor, "customers", "customer-one")));
    await assertFails(getDoc(doc(visitor, "orders", "order-one")));
    await assertFails(getDoc(doc(visitor, "walletEntries", "wallet-one")));
    await assertFails(getDoc(doc(visitor, "paymentMethods", "cash-plus")));
    await assertFails(getDoc(doc(visitor, "payments", "CHR-CUSTOMER1")));
    await assertFails(getDoc(doc(visitor, "supportTickets", "support-one")));
    await assertFails(setDoc(doc(visitor, "categories", "cat-visitor"), { name: "غير مسموح" }));

    const customerOne = environment.authenticatedContext("customer-one", { role: "customer" }).firestore();
    await assertSucceeds(getDoc(doc(customerOne, "customers", "customer-one")));
    await assertFails(getDoc(doc(customerOne, "customers", "customer-two")));
    await assertSucceeds(getDoc(doc(customerOne, "orders", "order-one")));
    await assertFails(getDoc(doc(customerOne, "orders", "order-two")));
    await assertSucceeds(getDoc(doc(customerOne, "walletEntries", "wallet-one")));
    await assertFails(getDoc(doc(customerOne, "walletEntries", "wallet-two")));
    await assertSucceeds(getDoc(doc(customerOne, "payments", "CHR-CUSTOMER1")));
    await assertFails(getDoc(doc(customerOne, "payments", "CHR-CUSTOMER2")));
    await assertFails(getDoc(doc(customerOne, "paymentMethods", "cash-plus")));
    await assertSucceeds(getDoc(doc(customerOne, "supportTickets", "support-one")));
    await assertFails(getDoc(doc(customerOne, "supportTickets", "support-two")));
    await assertFails(setDoc(doc(customerOne, "supportTickets", "support-client-write"), { customerId: "customer-one", subject: "محاولة غير مصرح بها" }));
    await assertFails(setDoc(doc(customerOne, "customers", "customer-one"), { walletMad: 9999 }, { merge: true }));
    await assertFails(setDoc(doc(customerOne, "walletEntries", "wallet-client-write"), { customerId: "customer-one", amountMad: 1, reason: "محاولة غير مصرح بها" }));
    await assertFails(setDoc(doc(customerOne, "payments", "payment-client-write"), { customerId: "customer-one", amountMad: 1, status: "confirmed" }));
    await assertFails(setDoc(doc(customerOne, "services", "svc-client-write"), { isActive: true }));
    await assertFails(getDoc(doc(customerOne, "servicePrivate", "svc-live")));
    await assertFails(setDoc(doc(customerOne, "servicePrivate", "svc-live"), { supplierCostSnapshot: 0 }, { merge: true }));

    const blockedCustomer = environment.authenticatedContext("customer-two", { role: "customer" }).firestore();
    await assertFails(getDoc(doc(blockedCustomer, "customers", "customer-two")));
    await assertFails(getDoc(doc(blockedCustomer, "orders", "order-two")));
    await assertFails(getDoc(doc(blockedCustomer, "walletEntries", "wallet-two")));
    await assertFails(getDoc(doc(blockedCustomer, "payments", "CHR-CUSTOMER2")));
    await assertFails(getDoc(doc(blockedCustomer, "supportTickets", "support-two")));

    const adminClient = environment.authenticatedContext("admin-user", { role: "admin" }).firestore();
    await assertSucceeds(getDoc(doc(adminClient, "customers", "customer-one")));
    await assertSucceeds(getDoc(doc(adminClient, "orders", "order-one")));
    await assertSucceeds(getDoc(doc(adminClient, "walletEntries", "wallet-one")));
    await assertSucceeds(getDoc(doc(adminClient, "paymentMethods", "cash-plus")));
    await assertSucceeds(getDoc(doc(adminClient, "payments", "CHR-CUSTOMER1")));
    await assertSucceeds(getDoc(doc(adminClient, "supportTickets", "support-one")));
    await assertFails(setDoc(doc(adminClient, "supportTickets", "support-admin-direct"), { customerId: "customer-one", subject: "يجب أن يفشل" }));
    await assertFails(setDoc(doc(adminClient, "categories", "cat-admin-direct"), { name: "يجب أن يفشل" }));
    await assertFails(setDoc(doc(adminClient, "services", "svc-admin-direct"), { isActive: true }));
    await assertFails(getDoc(doc(adminClient, "servicePrivate", "svc-live")));
    await assertFails(setDoc(doc(adminClient, "servicePrivate", "svc-live"), { supplierCostSnapshot: 0 }, { merge: true }));
    await assertFails(setDoc(doc(adminClient, "customers", "customer-one"), { walletMad: 9999 }, { merge: true }));
    await assertFails(setDoc(doc(adminClient, "walletEntries", "wallet-admin-direct"), { customerId: "customer-one", amountMad: 1, reason: "يجب أن يفشل" }));
    await assertFails(setDoc(doc(adminClient, "paymentMethods", "cash-plus"), { status: "disabled" }, { merge: true }));
    await assertFails(setDoc(doc(adminClient, "payments", "CHR-CUSTOMER1"), { status: "confirmed" }, { merge: true }));

    const ownerClient = environment.authenticatedContext("owner-user", { role: "owner" }).firestore();
    await assertSucceeds(getDoc(doc(ownerClient, "customers", "customer-one")));
    await assertSucceeds(getDoc(doc(ownerClient, "orders", "order-one")));
    await assertSucceeds(getDoc(doc(ownerClient, "paymentMethods", "cash-plus")));
    await assertSucceeds(getDoc(doc(ownerClient, "payments", "CHR-CUSTOMER1")));
    await assertFails(setDoc(doc(ownerClient, "customers", "customer-one"), { walletMad: 9999 }, { merge: true }));

    const managerClient = environment.authenticatedContext("manager-user", { role: "manager", managerPermissions: { orders: true, support: true } }).firestore();
    await assertFails(getDoc(doc(managerClient, "customers", "customer-one")));
    await assertFails(getDoc(doc(managerClient, "orders", "order-one")));
    await assertFails(getDoc(doc(managerClient, "walletEntries", "wallet-one")));
    await assertFails(getDoc(doc(managerClient, "paymentMethods", "cash-plus")));
    await assertFails(getDoc(doc(managerClient, "payments", "CHR-CUSTOMER1")));

    console.log("Firestore rules passed: visitor, customer isolation, blocked-account access, owner-only payment reads, manager SDK denial, and direct payment/wallet/CMC writes are protected.");
  } finally {
    await environment.cleanup();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
