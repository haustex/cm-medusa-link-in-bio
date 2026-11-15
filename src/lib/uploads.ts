import type { IFileModuleService, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { randomBytes } from "node:crypto"
import { IMAGE_SLOTS, type ImageSlot, type PageFiles, type PageRow } from "./types"
import { LibRuleError } from "./validate"

/**
 * Images a page owns (avatar, hero, QR logo), stored through Medusa's File Module, so they land wherever the
 * project keeps its files (local `static`, S3, R2, …). Only raster images are accepted, recognised by their first
 * bytes — the file name and the declared MIME type are not trusted — and SVG never is (it can carry scripts). One
 * file per slot: uploading again or removing deletes the previous file, so nothing piles up in the bucket.
 */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
export const UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const
export type UploadType = (typeof UPLOAD_TYPES)[number]

const EXT: Record<UploadType, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" }

/** The image type by magic bytes, null for anything else (SVG, GIF, HEIC, text, …) */
export function sniffImage(buf: Buffer): UploadType | null {
  if (buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg"
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png"
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp"
  // ISO BMFF: size (4) + "ftyp" + major brand; AVIF files say avif or avis (sequence) in the major or compatible brands
  if (buf.subarray(4, 8).toString("latin1") === "ftyp") {
    const boxLen = Math.min(buf.readUInt32BE(0) || 32, 64, buf.length)
    const brands = buf.subarray(8, boxLen).toString("latin1")
    if (/avif|avis/.test(brands) && !/heic|heix|mif1$/.test(brands.slice(0, 4))) return "image/avif"
    if (brands.slice(0, 4) === "avif" || brands.slice(0, 4) === "avis") return "image/avif"
  }
  return null
}

export const isSlot = (v: unknown): v is ImageSlot => typeof v === "string" && (IMAGE_SLOTS as string[]).includes(v)

const fileService = (container: MedusaContainer) => container.resolve<IFileModuleService>(Modules.FILE)
const column = (slot: ImageSlot) => slot // avatar → page.avatar, hero → page.hero, qr_logo → page.qr_logo

type PageService = { updateLibPages: (d: Record<string, unknown>) => Promise<PageRow> }

/** Deletes the file the page owns in `slot` (if any) and forgets its id; never throws (a missing file is fine) */
export async function releaseFile(container: MedusaContainer, page: PageRow, slot: ImageSlot): Promise<PageFiles> {
  const files: PageFiles = { ...(page.files ?? {}) }
  const id = files[slot]
  if (id) {
    try {
      await fileService(container).deleteFiles([id])
    } catch (e) {
      container.resolve(ContainerRegistrationKeys.LOGGER).warn(`[link-in-bio] could not delete file ${id} (${slot} of page ${page.handle}): ${(e as Error).message}`)
    }
    files[slot] = null // null, not delete: JSON columns are merged on update
  }
  return files
}

/** When an admin pastes a different URL over an upload, the upload is deleted */
export async function filesAfterUrlChange(container: MedusaContainer, page: PageRow, slot: ImageSlot, nextUrl: string | null): Promise<PageFiles | undefined> {
  const current = page[column(slot)] as string | null
  if (!page.files?.[slot] || nextUrl === current) return undefined
  return releaseFile(container, page, slot)
}

/** On page delete: every upload the page owns */
export async function releaseAllFiles(container: MedusaContainer, page: PageRow): Promise<void> {
  for (const slot of IMAGE_SLOTS) if (page.files?.[slot]) await releaseFile(container, page, slot)
}

export type UploadInput = { buffer: Buffer; originalname?: string; mimetype?: string }

/** Stores the image in `slot` of `page` (replacing the previous upload) and returns the page's new column values */
export async function storeUpload(container: MedusaContainer, svc: PageService, page: PageRow, slot: ImageSlot, file: UploadInput): Promise<void> {
  if (!file?.buffer?.length) throw new LibRuleError("invalid", "No file was uploaded", "file")
  if (file.buffer.length > MAX_UPLOAD_BYTES) throw new LibRuleError("file_too_large", `The image may be at most ${MAX_UPLOAD_BYTES / 1024 / 1024} MB`, "file")
  const type = sniffImage(file.buffer)
  if (!type) throw new LibRuleError("invalid_image", "Only JPEG, PNG, WebP and AVIF images are accepted (no SVG)", "file")
  const name = `lib-${page.handle}-${slot.replace("_", "-")}-${randomBytes(4).toString("hex")}.${EXT[type]}`
  const created = await fileService(container).createFiles({ filename: name, mimeType: type, content: file.buffer.toString("base64"), access: "public" } as Parameters<IFileModuleService["createFiles"]>[0] & { access: "public" })
  const files = await releaseFile(container, page, slot)
  files[slot] = created.id
  await svc.updateLibPages({ id: page.id, [column(slot)]: created.url, files })
}

/** Removes the image in `slot` (deleting the upload if the page owns it) */
export async function removeUpload(container: MedusaContainer, svc: PageService, page: PageRow, slot: ImageSlot): Promise<void> {
  const files = await releaseFile(container, page, slot)
  const focus = { ...(page.focus ?? {}) }
  if (slot !== "qr_logo") focus[slot] = null
  await svc.updateLibPages({ id: page.id, [column(slot)]: null, files, focus })
}
