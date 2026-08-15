import "server-only";

type WhatsAppTemplateInput = {
  to: string;
  template: string;
  language?: string;
  bodyParameters?: string[];
};

type WhatsAppConfig = {
  accessToken: string;
  phoneNumberId: string;
  graphVersion: string;
};

export function normalizeMoroccanMobile(value: string): string | null {
  const compact = value.trim().replace(/[\s()-]/g, "");
  const local = compact.replace(/^\+?212/, "0");
  if (!/^0[67]\d{8}$/.test(local)) return null;
  return `+212${local.slice(1)}`;
}

function configuration(): WhatsAppConfig | null {
  if (process.env.WHATSAPP_ENABLED !== "true") return null;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!accessToken || !phoneNumberId) return null;
  return { accessToken, phoneNumberId, graphVersion: process.env.WHATSAPP_GRAPH_VERSION?.trim() || "v22.0" };
}

export function whatsappConfigured() {
  return Boolean(configuration());
}

export function phoneVerificationTemplate() {
  return process.env.WHATSAPP_PHONE_VERIFICATION_TEMPLATE?.trim() || "";
}

export async function sendWhatsAppTemplate({ to, template, language = process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || "ar", bodyParameters = [] }: WhatsAppTemplateInput) {
  const config = configuration();
  const normalized = normalizeMoroccanMobile(to);
  if (!config) throw new Error("WHATSAPP_UNAVAILABLE");
  if (!normalized) throw new Error("INVALID_MOROCCAN_PHONE");
  if (!/^[a-z0-9_]{1,512}$/i.test(template)) throw new Error("INVALID_TEMPLATE");

  const components = bodyParameters.length ? [{ type: "body", parameters: bodyParameters.map((text) => ({ type: "text", text })) }] : [];
  const response = await fetch(`https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: normalized.slice(1), type: "template", template: { name: template, language: { code: language }, components } }),
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({})) as { messages?: Array<{ id?: string }>; error?: { code?: number; message?: string } };
  if (!response.ok) {
    console.error("WhatsApp template failed", { status: response.status, code: result.error?.code, template });
    throw new Error("WHATSAPP_SEND_FAILED");
  }
  return { providerMessageId: result.messages?.[0]?.id || "", normalizedPhone: normalized };
}
