import "server-only";

export const blogAiActions = ["outline", "draft", "rewrite", "titles", "seo"] as const;
export type BlogAiAction = (typeof blogAiActions)[number];

type BlogAiProtocol = "openai-chat" | "gemini-generate-content";
type BlogAiConfig = {
  enabled: boolean;
  provider: string;
  apiUrl: string;
  token: string;
  model: string;
  protocol: BlogAiProtocol;
  instructions: string;
  allowedHosts: string[];
};

type BlogAiRequest = { action: BlogAiAction; prompt: string; title?: string; excerpt?: string; markdown?: string; tags?: string[] };

type OpenAiResponse = { choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }> };
type GeminiResponse = { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };

function parseAllowedHosts(value: string | undefined) {
  return (value || "").split(",").map((item) => item.trim().toLowerCase()).filter((item) => /^[a-z0-9.-]+$/i.test(item));
}

function hostAllowed(hostname: string, allowedHosts: string[]) {
  const host = hostname.toLowerCase();
  return allowedHosts.some((allowed) => host === allowed || (allowed.startsWith("*.") && host.endsWith(allowed.slice(1))));
}

function configuration(): BlogAiConfig | null {
  if (process.env.CONTENT_AI_ENABLED !== "true") return null;
  const apiUrl = process.env.CONTENT_AI_API_URL?.trim();
  const token = process.env.CONTENT_AI_API_TOKEN?.trim();
  const model = process.env.CONTENT_AI_MODEL?.trim();
  const allowedHosts = parseAllowedHosts(process.env.CONTENT_AI_ALLOWED_HOSTS);
  if (!apiUrl || !token || !model || !allowedHosts.length) return null;
  let endpoint: URL;
  try { endpoint = new URL(apiUrl); } catch { return null; }
  if (endpoint.protocol !== "https:" || !hostAllowed(endpoint.hostname, allowedHosts)) return null;
  const protocol = process.env.CONTENT_AI_PROTOCOL === "gemini-generate-content" ? "gemini-generate-content" : "openai-chat";
  return { enabled: true, provider: process.env.CONTENT_AI_PROVIDER?.trim() || "موصل AI", apiUrl: endpoint.toString(), token, model, protocol, instructions: process.env.CONTENT_AI_INSTRUCTIONS?.trim().slice(0, 4000) || "اكتب بالعربية الواضحة. لا تخترع حقائق أو أسعارًا أو مصادر. اترك أي معلومة غير مؤكدة بصيغة تحتاج مراجعة.", allowedHosts };
}

export function blogAiStatus() {
  const config = configuration();
  if (!config) return { enabled: false, configured: false, actions: [...blogAiActions] };
  const endpoint = new URL(config.apiUrl);
  return { enabled: true, configured: true, provider: config.provider, model: config.model, endpointHost: endpoint.hostname, protocol: config.protocol, actions: [...blogAiActions] };
}

function buildSystemInstructions(config: BlogAiConfig, action: BlogAiAction) {
  const actionInstruction: Record<BlogAiAction, string> = {
    outline: "أنشئ مخططًا هرميًا للمقال فقط بصيغة Markdown.",
    draft: "اكتب مسودة مقال Markdown كاملة مع عناوين واضحة، من دون HTML خام.",
    rewrite: "حسّن النص المعطى فقط بصيغة Markdown، وحافظ على المعنى ولا تضف ادعاءات غير مؤكدة.",
    titles: "اقترح عناوين عربية وslug إنجليزيًا مناسبًا ووصف SEO؛ لا تكتب المقال كاملًا.",
    seo: "اقترح عنوان SEO ووصف SEO ووسومًا مناسبة للمحتوى المعطى؛ لا تخترع مصادر أو روابط.",
  };
  return [
    "أنت مساعد كتابة داخلي لمدونة ChriGsm فقط.",
    "نطاقك الوحيد هو نصوص المقالات والملخصات والعناوين وSEO بصيغة Markdown. لا تقدم أي أوامر برمجية أو عمليات على حسابات أو بيانات عملاء أو طلبات أو مدفوعات.",
    "لا تستخدم أدوات أو اتصالات خارجية ولا تدّعِ أنك تحققت من الويب. لا تدرج HTML أو JavaScript أو روابط مصادر غير موجودة في طلب المستخدم.",
    "الناتج مسودة للمراجعة البشرية فقط؛ لا تتحدث عن نشر أو حفظ أو تنفيذ أي تغيير.",
    actionInstruction[action],
    `تعليمات المالك الدائمة: ${config.instructions}`,
  ].join("\n");
}

function buildUserMessage(input: BlogAiRequest) {
  return JSON.stringify({ task: input.prompt, articleContext: { title: input.title || "", excerpt: input.excerpt || "", tags: input.tags || [], markdown: input.markdown || "" } });
}

function outputFromOpenAi(result: OpenAiResponse) {
  const content = result.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) return content.map((item) => item.text || "").join("\n").trim();
  return "";
}

function outputFromGemini(result: GeminiResponse) {
  return result.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n").trim() || "";
}

export async function requestBlogAiDraft(input: BlogAiRequest) {
  const config = configuration();
  if (!config) throw new Error("CONTENT_AI_UNAVAILABLE");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35_000);
  const systemInstruction = buildSystemInstructions(config, input.action);
  const userMessage = buildUserMessage(input);
  try {
    const request: { url: string; headers: Record<string, string>; body: object } = config.protocol === "gemini-generate-content"
      ? { url: config.apiUrl, headers: { "Content-Type": "application/json", "x-goog-api-key": config.token }, body: { systemInstruction: { parts: [{ text: systemInstruction }] }, contents: [{ role: "user", parts: [{ text: userMessage }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 5000 } } }
      : { url: config.apiUrl, headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.token}` }, body: { model: config.model, messages: [{ role: "system", content: systemInstruction }, { role: "user", content: userMessage }], temperature: 0.4, max_tokens: 5000 } };
    const response = await fetch(request.url, { method: "POST", headers: request.headers, body: JSON.stringify(request.body), cache: "no-store", redirect: "error", signal: controller.signal });
    const result = await response.json().catch(() => ({})) as OpenAiResponse & GeminiResponse;
    if (!response.ok) {
      console.error("Blog AI provider request failed", { provider: config.provider, status: response.status, protocol: config.protocol });
      throw new Error("CONTENT_AI_PROVIDER_FAILED");
    }
    const draft = (config.protocol === "gemini-generate-content" ? outputFromGemini(result) : outputFromOpenAi(result)).slice(0, 60_000);
    if (!draft) throw new Error("CONTENT_AI_EMPTY_RESPONSE");
    return { draft, provider: config.provider, model: config.model };
  } catch (error) {
    if (controller.signal.aborted) throw new Error("CONTENT_AI_TIMEOUT");
    throw error;
  } finally { clearTimeout(timeout); }
}
