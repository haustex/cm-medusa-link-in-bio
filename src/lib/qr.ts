import QRCode from "qrcode"

/** SVG of a QR code for `text` (quiet zone of one module, black on transparent) */
export async function qrSvg(text: string, options: { dark?: string; light?: string } = {}): Promise<string> {
  return QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: options.dark ?? "#000000ff", light: options.light ?? "#00000000" } })
}

/** PNG of a QR code, `size` pixels wide */
export async function qrPng(text: string, size = 1024, options: { dark?: string; light?: string } = {}): Promise<Buffer> {
  return QRCode.toBuffer(text, { type: "png", width: Math.min(Math.max(size, 128), 4096), margin: 1, errorCorrectionLevel: "M", color: { dark: options.dark ?? "#000000ff", light: options.light ?? "#ffffffff" } })
}
