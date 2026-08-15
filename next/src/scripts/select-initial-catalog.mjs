import fs from "node:fs";

const inputPath = "/home/ubuntu/chrigsm-review/supplier-snapshots/catalog-analysis-latest.json";
const outputPath = "/home/ubuntu/chrigsm-review/supplier-snapshots/initial-catalog-shortlist.json";
const analysis = JSON.parse(fs.readFileSync(inputPath, "utf8"));

const safeField = (name) => /^(email|username|user\s*name)$/i.test(name.trim());
const isTimed = (name) => /\b(?:3|6|12)\s*(?:month|months|year|years)\b/i.test(name);
const isUnlock = (name) => /\bunlock|activation|activate|frp|dongle|tool|box|license|licence|software\b/i.test(name);
const hasFastDelivery = (delivery) => /instant|minute/i.test(delivery);
const hasRestrictedTerms = (name) => /icloud|bypass|mdm|lost|stolen|blacklist|finance|remove\s*account/i.test(name);

const scored = analysis.services
  .filter((service) => isTimed(service.supplierName) && isUnlock(service.supplierName) && !hasRestrictedTerms(service.supplierName))
  .map((service) => {
    const required = service.customFields.filter((field) => field.required);
    const allFieldsSafe = required.every((field) => safeField(field.name));
    const termMatch = service.supplierName.match(/\b(3|6|12)\s*(month|months|year|years)\b/i);
    const termValue = termMatch ? Number(termMatch[1]) : null;
    const unit = termMatch && /year/i.test(termMatch[2]) ? "years" : "months";
    const score =
      (hasFastDelivery(service.delivery) ? 4 : 0) +
      (allFieldsSafe ? 4 : 0) +
      (required.length <= 2 ? 2 : 0) +
      (termValue === 3 ? 3 : 0) +
      (service.groupType === "SERVER" ? 1 : 0);
    return {
      ...service,
      termValue,
      termUnit: unit,
      requiredFields: required,
      allRequiredFieldsSafe: allFieldsSafe,
      score,
    };
  })
  .filter((service) => service.allRequiredFieldsSafe)
  .sort((a, b) => b.score - a.score || a.supplierCost - b.supplierCost || a.supplierName.localeCompare(b.supplierName));

const shortlist = scored.slice(0, 12).map((service) => ({
  supplierServiceId: service.supplierServiceId,
  supplierName: service.supplierName,
  groupName: service.groupName,
  groupType: service.groupType,
  supplierCost: service.supplierCost,
  supplierCurrency: service.supplierCurrency,
  delivery: service.delivery,
  termValue: service.termValue,
  termUnit: service.termUnit,
  requiredFields: service.requiredFields,
  score: service.score,
}));

const result = {
  generatedAt: new Date().toISOString(),
  sourceAnalysis: inputPath,
  selectionPolicy: {
    includes: "Timed tool/unlock activations with clear service names and safe required fields only.",
    excludes: "Items matching restricted or high-risk wording and items requiring fields beyond email or username.",
  },
  count: shortlist.length,
  shortlist,
};

fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({
  accountCurrency: analysis.accountRead.currency,
  catalogSummary: analysis.summary,
  shortlistCount: shortlist.length,
  shortlist: shortlist.map((service) => ({
    supplierServiceId: service.supplierServiceId,
    supplierName: service.supplierName,
    delivery: service.delivery,
    term: `${service.termValue} ${service.termUnit}`,
    requiredFields: service.requiredFields.map((field) => field.name),
    score: service.score,
  })),
  outputPath,
}, null, 2));
