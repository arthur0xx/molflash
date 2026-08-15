import { createHash } from "node:crypto";

const serviceFolder = "chrigsm/catalog";
const legacyServiceFolder = "chrigsm/services";
const profileFolder = "chrigsm/profiles";

export type CloudinaryServerConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

export type MediaKind = "service" | "profile";

export type CloudinaryUploadTarget = {
  kind: MediaKind;
  publicId: string;
};

function safeAssetSegment(value: string, fallback: string) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return normalized || fallback;
}

export function serviceImagePublicId(title: string, serviceId: string, categoryId = "uncategorized") {
  const category = safeAssetSegment(categoryId, "uncategorized");
  return `${serviceFolder}/${category}/${safeAssetSegment(title, "service")}-${safeAssetSegment(serviceId, "item")}`;
}

export function profileImagePublicId(fullName: string, userId: string) {
  return `${profileFolder}/${safeAssetSegment(fullName, "customer")}-${safeAssetSegment(userId, "account")}`;
}

function isManagedPublicId(publicId: string, kind?: MediaKind) {
  const isServiceAsset = publicId.startsWith(`${serviceFolder}/`) || publicId.startsWith(`${legacyServiceFolder}/`);
  const isProfileAsset = publicId.startsWith(`${profileFolder}/`);
  const permitted = kind === "service" ? isServiceAsset : kind === "profile" ? isProfileAsset : publicId.startsWith("chrigsm/");
  return permitted && /^[a-z0-9/_-]{5,220}$/.test(publicId);
}

export function getCloudinaryServerConfig(): CloudinaryServerConfig | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  return cloudName && apiKey && apiSecret ? { cloudName, apiKey, apiSecret } : null;
}

export function cloudinaryUploadStatus() {
  const config = getCloudinaryServerConfig();
  return config ? { configured: true, cloudName: config.cloudName } : { configured: false };
}

function cloudinarySignature(parameters: Record<string, string | number>, apiSecret: string) {
  const canonical = Object.entries(parameters)
    .filter(([, value]) => value !== "" && value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return createHash("sha1").update(`${canonical}${apiSecret}`).digest("hex");
}

export function createCloudinaryUploadSignature(target: CloudinaryUploadTarget, timestamp: number) {
  const config = getCloudinaryServerConfig();
  if (!config || !isManagedPublicId(target.publicId, target.kind)) return null;

  const separator = target.publicId.lastIndexOf("/");
  const folder = target.publicId.slice(0, separator);
  const assetName = target.publicId.slice(separator + 1);
  if (!folder || !assetName) return null;
  const parameters = {
    folder,
    invalidate: "true",
    overwrite: "true",
    public_id: assetName,
    timestamp,
  };

  return {
    cloudName: config.cloudName,
    apiKey: config.apiKey,
    folder,
    publicId: parameters.public_id,
    overwrite: true,
    invalidate: true,
    timestamp,
    signature: cloudinarySignature(parameters, config.apiSecret),
  };
}

export async function deleteCloudinaryImage(publicId: string, kind?: MediaKind) {
  const config = getCloudinaryServerConfig();
  if (!config || !isManagedPublicId(publicId, kind)) return false;

  const timestamp = Math.floor(Date.now() / 1000);
  const parameters = { invalidate: "true", public_id: publicId, timestamp };
  const body = new URLSearchParams({
    api_key: config.apiKey,
    invalidate: parameters.invalidate,
    public_id: parameters.public_id,
    signature: cloudinarySignature(parameters, config.apiSecret),
    timestamp: String(timestamp),
  });

  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/destroy`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return response.ok;
}
