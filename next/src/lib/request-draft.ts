export type RequestDraft = {
  serviceId: string;
  serviceSlug: string;
  formData: Record<string, string>;
  createdAt: number;
};

const PREFIX = "chrigsm:request-draft:";
const MAX_AGE_MS = 60 * 60 * 1000;

function storageKey(serviceId: string) {
  return `${PREFIX}${serviceId}`;
}

function browserStorage() {
  return typeof window === "undefined" ? null : window.sessionStorage;
}

export function saveRequestDraft(draft: RequestDraft) {
  const storage = browserStorage();
  if (!storage) return;
  try {
    storage.setItem(storageKey(draft.serviceId), JSON.stringify(draft));
  } catch {
    // لا نمنع المستخدم من الدخول إذا كانت مساحة تخزين التبويب غير متاحة.
  }
}

export function loadRequestDraft(serviceId: string, serviceSlug: string): RequestDraft | null {
  const storage = browserStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(storageKey(serviceId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as Partial<RequestDraft>;
    const valid = draft.serviceId === serviceId
      && draft.serviceSlug === serviceSlug
      && typeof draft.createdAt === "number"
      && Date.now() - draft.createdAt >= 0
      && Date.now() - draft.createdAt <= MAX_AGE_MS
      && draft.formData
      && typeof draft.formData === "object";
    if (!valid) {
      storage.removeItem(storageKey(serviceId));
      return null;
    }
    return { serviceId, serviceSlug, createdAt: Number(draft.createdAt), formData: draft.formData as Record<string, string> };
  } catch {
    storage.removeItem(storageKey(serviceId));
    return null;
  }
}

export function clearRequestDraft(serviceId: string) {
  const storage = browserStorage();
  if (!storage) return;
  try {
    storage.removeItem(storageKey(serviceId));
  } catch {
    // لا يلزم إظهار خطأ للمستخدم لأن هذا التنظيف غير حرج.
  }
}

export function hasRequestDraft(serviceId: string, serviceSlug: string) {
  return Boolean(loadRequestDraft(serviceId, serviceSlug));
}
