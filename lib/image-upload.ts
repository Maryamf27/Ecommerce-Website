/** Shared rules for product images uploaded from the admin's device. */

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB after the browser has resized the photo
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export type UploadImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((value, index) => bytes[offset + index] === value);
}

/**
 * Detects the real image type from the file's first bytes. The browser-supplied
 * Content-Type is never trusted, so only genuine PNG/JPEG/WebP/GIF files are stored
 * (SVG and HTML are rejected, which also rules out script injection through uploads).
 */
export function detectImageType(bytes: Uint8Array): UploadImageType | null {
  if (bytes.length < 12) return null;
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38]) && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61) return "image/gif";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}
