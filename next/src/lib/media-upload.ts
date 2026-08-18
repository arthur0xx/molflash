export type SignedMediaUpload = {
  cloudName: string;
  apiKey: string;
  folder: string;
  publicId: string;
  deliveryType?: "upload" | "authenticated";
  timestamp: number;
  signature: string;
  overwrite: boolean;
  invalidate: boolean;
};

export type UploadedMediaAsset = {
  imageUrl: string;
  imagePublicId: string;
};

const ACCEPTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function validateMediaImage(file: File) {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) return "اختر صورة PNG أو JPEG أو WebP.";
  if (file.size > MAX_IMAGE_BYTES) return "حجم الصورة يتجاوز الحد المسموح 10 ميغابايت.";
  return "";
}

export async function requestSignedMediaUpload(token: string, path: string, body?: Record<string, unknown>): Promise<SignedMediaUpload> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({})) as Partial<SignedMediaUpload> & { error?: string };
  if (!response.ok || !result.cloudName || !result.apiKey || !result.folder || !result.publicId || !result.timestamp || !result.signature) {
    throw new Error(result.error || "تعذر تجهيز رفع الصورة بأمان.");
  }
  return result as SignedMediaUpload;
}

export async function uploadSignedMediaImage(file: File, signed: SignedMediaUpload, expectedPrefix: "chrigsm/catalog/" | "chrigsm/profiles/" | "chrigsm/payment-proofs/", label: string): Promise<UploadedMediaAsset> {
  const validationError = validateMediaImage(file);
  if (validationError) throw new Error(validationError);

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20_000);
  try {
    const form = new FormData();
    form.append("file", file);
    form.append("api_key", signed.apiKey);
    form.append("timestamp", String(signed.timestamp));
    form.append("signature", signed.signature);
    form.append("folder", signed.folder);
    form.append("public_id", signed.publicId);
    if (signed.deliveryType) form.append("type", signed.deliveryType);
    form.append("overwrite", String(signed.overwrite));
    form.append("invalidate", String(signed.invalidate));

    const response = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
    const result = await response.json().catch(() => ({})) as { secure_url?: string; public_id?: string; error?: { message?: string } };
    if (!response.ok || !result.secure_url?.startsWith("https://") || !result.public_id?.startsWith(expectedPrefix)) {
      throw new Error(result.error?.message || `تعذر ${label} إلى Cloudinary.`);
    }
    return { imageUrl: result.secure_url, imagePublicId: result.public_id };
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`انتهت مهلة ${label}. تحقق من الاتصال ثم أعد المحاولة.`);
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
