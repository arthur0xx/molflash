import fs from "node:fs";

const shortlistPath = "/home/ubuntu/chrigsm-review/supplier-snapshots/initial-catalog-shortlist.json";
const outputPath = "/home/ubuntu/chrigsm-review/supplier-snapshots/initial-catalog-drafts.json";
const source = JSON.parse(fs.readFileSync(shortlistPath, "utf8"));

const FX_RATE_USD_TO_MAD = 9.302;
const FX_BUFFER = 0.03;
const MARKUP = 0.25;
const MIN_GROSS_PROFIT_MAD = 10;
const ROUND_TO_MAD = 5;

function roundUp(value, step) {
  return Math.ceil(value / step) * step;
}

function priceFor(costUsd) {
  const convertedCostMad = costUsd * FX_RATE_USD_TO_MAD;
  const bufferedCostMad = convertedCostMad * (1 + FX_BUFFER);
  const markupPriceMad = bufferedCostMad * (1 + MARKUP);
  const floorPriceMad = convertedCostMad + MIN_GROSS_PROFIT_MAD;
  const salePriceMad = roundUp(Math.max(markupPriceMad, floorPriceMad), ROUND_TO_MAD);
  return {
    convertedCostMad: Number(convertedCostMad.toFixed(2)),
    bufferedCostMad: Number(bufferedCostMad.toFixed(2)),
    salePriceMad,
    grossProfitMad: Number((salePriceMad - convertedCostMad).toFixed(2)),
    estimatedNetBeforeGatewayFeesMad: Number((salePriceMad - bufferedCostMad).toFixed(2)),
  };
}

function arabicTitle(name) {
  const clean = name
    .replace(/\s+-\s*(New|Renew|New\/ Renew|Existing Users|New User)\b.*$/i, "")
    .replace(/\[\s*A?WT\s*\]/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return clean;
}

function familyFor(name) {
  if (/3\s*months?/i.test(name)) return "timed-access";
  return "unlock";
}

const drafts = source.shortlist.slice(0, 6).map((service, order) => {
  const pricing = priceFor(service.supplierCost);
  const title = arabicTitle(service.supplierName);
  const termArabic = service.termValue === 3 ? "3 أشهر" : service.termValue === 6 ? "6 أشهر" : `${service.termValue} سنة`;
  return {
    internalId: `draft-${service.supplierServiceId}`,
    supplier: {
      serviceId: service.supplierServiceId,
      serviceNameSnapshot: service.supplierName,
      costSnapshot: service.supplierCost,
      currency: service.supplierCurrency,
      syncedAt: source.generatedAt,
      delivery: service.delivery,
      requiredFields: service.requiredFields,
    },
    storefront: {
      title,
      proposedArabicTitle: `تفعيل ${title}`,
      description: `تفعيل رقمي لمدة ${termArabic}. أدخل البيانات المطلوبة بدقة قبل إرسال الطلب.`,
      category: "unlock-tools",
      catalogFamily: familyFor(service.supplierName),
      termValue: service.termValue,
      termUnit: service.termUnit,
      delivery: service.delivery,
      badge: termArabic,
      isActive: false,
      order,
    },
    pricing,
    visual: {
      preset: service.termValue === 3 ? "unlock-duration-cyan" : "unlock-duration-blue",
      aspectRatio: "4:3",
      status: "pending-generation",
    },
  };
});

const result = {
  generatedAt: new Date().toISOString(),
  fxSnapshot: {
    source: "Bank Al-Maghrib daily indicator published 13 Aug 2026",
    pair: "USD/MAD",
    rate: FX_RATE_USD_TO_MAD,
  },
  pricingPolicy: {
    fxBufferPercent: FX_BUFFER * 100,
    markupPercent: MARKUP * 100,
    minimumGrossProfitMad: MIN_GROSS_PROFIT_MAD,
    roundUpToMad: ROUND_TO_MAD,
    formula: "max(convertedCost × (1 + FX buffer) × (1 + markup), convertedCost + minimum gross profit), rounded up",
  },
  drafts,
};

fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({
  fxSnapshot: result.fxSnapshot,
  pricingPolicy: result.pricingPolicy,
  draftCount: drafts.length,
  drafts: drafts.map((draft) => ({
    internalId: draft.internalId,
    title: draft.storefront.title,
    term: draft.storefront.badge,
    delivery: draft.storefront.delivery,
    salePriceMad: draft.pricing.salePriceMad,
    requiredFields: draft.supplier.requiredFields.map((field) => field.name),
    visualPreset: draft.visual.preset,
  })),
  outputPath,
}, null, 2));
