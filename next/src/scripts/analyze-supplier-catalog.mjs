import fs from "node:fs";
import path from "node:path";

const snapshotDir = "/home/ubuntu/chrigsm-review/supplier-snapshots";
const outputPath = path.join(snapshotDir, "catalog-analysis-latest.json");

function newest(prefix) {
  const file = fs.readdirSync(snapshotDir)
    .filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
    .sort()
    .at(-1);
  if (!file) throw new Error(`Missing snapshot for ${prefix}`);
  return path.join(snapshotDir, file);
}

function arraySuccess(payload) {
  const success = payload?.SUCCESS;
  if (!Array.isArray(success) || !success[0]) throw new Error("Supplier response does not include a readable SUCCESS payload.");
  return success[0];
}

const accountPayload = JSON.parse(fs.readFileSync(newest("accountinfo-"), "utf8"));
const catalogPayload = JSON.parse(fs.readFileSync(newest("imeiservicelist-"), "utf8"));
const account = arraySuccess(accountPayload).AccountInfo ?? {};
const catalog = arraySuccess(catalogPayload);
const groups = catalog.LIST ?? {};
const now = new Date().toISOString();

const services = Object.entries(groups).flatMap(([groupName, group]) =>
  Object.values(group?.SERVICES ?? {}).map((service) => {
    const customFields = Array.isArray(service?.["Requires.Custom"]) ? service["Requires.Custom"] : [];
    return {
      supplierServiceId: String(service?.SERVICEID ?? ""),
      groupName,
      groupType: String(group?.GROUPTYPE ?? service?.SERVICETYPE ?? "").toUpperCase(),
      supplierName: String(service?.SERVICENAME ?? "").trim(),
      supplierCost: Number(service?.CREDIT ?? NaN),
      supplierCurrency: String(account?.currency ?? catalog?.ACCOUNTINFO?.currency ?? "").trim(),
      delivery: String(service?.TIME ?? "").trim(),
      minQuantity: String(service?.MINQNT ?? "").trim(),
      maxQuantity: String(service?.MAXQNT ?? "").trim(),
      customFields: customFields.map((field) => ({
        name: String(field?.fieldname ?? "").trim(),
        type: String(field?.fieldtype ?? "text").trim(),
        required: String(field?.required ?? "").toLowerCase() === "on",
      })).filter((field) => field.name),
    };
  })
).filter((service) => service.supplierServiceId && service.supplierName && Number.isFinite(service.supplierCost));

const families = [
  { key: "unlock", label: "Unlock", pattern: /\bunlock|activation|activate|unblock|remove.*lock|network\s*lock/i },
  { key: "timed-access", label: "Timed access", pattern: /\b(?:1|3|6|12)\s*(?:month|months|year|years)|\b(?:monthly|yearly)\b/i },
  { key: "rental", label: "Rental", pattern: /\brent|rental|lease|loaner/i },
  { key: "tool", label: "Tools", pattern: /\btool|box|dongle|software|license|licence|pro\b/i },
];

const candidates = families.flatMap((family) => services
  .filter((service) => family.pattern.test(`${service.groupName} ${service.supplierName}`))
  .map((service) => ({ ...service, proposedFamily: family.key, familyLabel: family.label }))
).filter((candidate, index, list) => list.findIndex((value) => value.supplierServiceId === candidate.supplierServiceId) === index);

const typeCounts = Object.fromEntries([...new Set(services.map((service) => service.groupType))]
  .sort()
  .map((type) => [type, services.filter((service) => service.groupType === type).length]));

const result = {
  generatedAt: now,
  sourceSnapshots: {
    account: path.basename(newest("accountinfo-")),
    catalog: path.basename(newest("imeiservicelist-")),
  },
  accountRead: {
    apiVersion: String(accountPayload?.apiversion ?? catalogPayload?.apiversion ?? "unknown"),
    responseValid: true,
    currency: String(account?.currency ?? catalog?.ACCOUNTINFO?.currency ?? "unknown"),
    balanceAvailable: Number(account?.creditraw ?? -1) >= 0,
  },
  summary: {
    groupCount: Object.keys(groups).length,
    serviceCount: services.length,
    typeCounts,
    candidateCount: candidates.length,
  },
  groups: Object.entries(groups).map(([name, group]) => ({
    name,
    type: String(group?.GROUPTYPE ?? "").toUpperCase(),
    serviceCount: Object.keys(group?.SERVICES ?? {}).length,
  })),
  candidates,
  services,
};

fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({
  accountRead: result.accountRead,
  summary: result.summary,
  candidatePreview: candidates.slice(0, 25).map((candidate) => ({
    supplierServiceId: candidate.supplierServiceId,
    proposedFamily: candidate.proposedFamily,
    groupName: candidate.groupName,
    supplierName: candidate.supplierName,
    delivery: candidate.delivery,
    requiredFieldCount: candidate.customFields.filter((field) => field.required).length,
  })),
  analysisFile: outputPath,
}, null, 2));
