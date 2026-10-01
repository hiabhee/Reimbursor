export const MAX_RECEIPT_SIZE = 10 * 1024 * 1024

export const OCR_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/tiff",
] as const

export const RECEIPT_FILE_TYPES = [...OCR_IMAGE_TYPES, "application/pdf"] as const

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "image/tiff": "tiff",
  "application/pdf": "pdf",
}

export function extensionForMimeType(mimeType: string): string {
  return EXTENSIONS[mimeType] ?? "bin"
}

export function hasValidFileSignature(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === "image/jpeg") return buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
  if (mimeType === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  if (mimeType === "image/gif") return buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a"
  if (mimeType === "image/webp") return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP"
  if (mimeType === "image/bmp") return buffer.subarray(0, 2).toString("ascii") === "BM"
  if (mimeType === "image/tiff") return buffer.subarray(0, 4).equals(Buffer.from([0x49, 0x49, 0x2a, 0x00])) || buffer.subarray(0, 4).equals(Buffer.from([0x4d, 0x4d, 0x00, 0x2a]))
  if (mimeType === "application/pdf") return buffer.subarray(0, 5).toString("ascii") === "%PDF-"
  return false
}

export async function readReceiptFile(file: File, allowedTypes: readonly string[]) {
  if (!allowedTypes.includes(file.type)) {
    throw new Error("Unsupported file type")
  }
  if (file.size <= 0 || file.size > MAX_RECEIPT_SIZE) {
    throw new Error("File too large or empty (max 10MB)")
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  if (!hasValidFileSignature(buffer, file.type)) {
    throw new Error("File content does not match its declared type")
  }

  return { buffer, mimeType: file.type }
}
