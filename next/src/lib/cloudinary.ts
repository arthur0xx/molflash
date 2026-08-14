import { createHash } from "node:crypto";

const uploadFolder = "chrigsm/services";

export type CloudinaryServerConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

export function getCloudinaryServerConfig(): CloudinaryServerConfig | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  return cloudName && apiKey && apiSecret ? { cloudName, apiKey, apiSecret } : null;
}

export function cloudinaryUploadStatus() {
  const config = getCloudinaryServerConfig();
  return config ? { configured: true, cloudName: config.cloudName, folder: uploadFolder } : { configured: false };
}

export function createCloudinaryUploadSignature(timestamp: number) {
  const config = getCloudinaryServerConfig();
  if (!config) return null;
  const toSign = `folder=${uploadFolder}&timestamp=${timestamp}${config.apiSecret}`;
  return {
    cloudName: config.cloudName,
    apiKey: config.apiKey,
    folder: uploadFolder,
    timestamp,
    signature: createHash("sha1").update(toSign).digest("hex"),
  };
}
