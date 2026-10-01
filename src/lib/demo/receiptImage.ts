import { deflateSync } from "zlib"

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf: Buffer): number {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData), 0)
  return Buffer.concat([length, typeAndData, crc])
}

type Rgb = [number, number, number]

function encodePng(width: number, height: number, pixels: Rgb[]): Buffer {
  const raw = Buffer.alloc(height * (1 + width * 3))
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 3)
    raw[rowStart] = 0
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixels[y * width + x]
      const p = rowStart + 1 + x * 3
      raw[p] = r
      raw[p + 1] = g
      raw[p + 2] = b
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

const WIDTH = 420
const HEIGHT = 560

const PAPER: Rgb = [252, 251, 247]
const INK: Rgb = [58, 58, 62]
const MUTED: Rgb = [186, 186, 190]

export interface ReceiptImageOptions {
  merchant: string
  lines: string[]
  total: string
}

/**
 * Renders a small placeholder receipt as a real PNG so seeded demo expenses
 * have a file on disk for /api/expenses/[id]/receipt/file to stream.
 */
export function renderReceiptPng(options: ReceiptImageOptions): Buffer {
  const pixels: Rgb[] = new Array(WIDTH * HEIGHT).fill(PAPER)

  const rect = (x0: number, y0: number, w: number, h: number, color: Rgb) => {
    for (let y = Math.max(0, y0); y < Math.min(HEIGHT, y0 + h); y++) {
      for (let x = Math.max(0, x0); x < Math.min(WIDTH, x0 + w); x++) {
        pixels[y * WIDTH + x] = color
      }
    }
  }

  rect(0, 0, WIDTH, 4, INK)
  rect(40, 46, WIDTH - 80, 12, INK)
  rect(40, 72, (WIDTH - 80) * 0.55, 8, MUTED)

  let y = 116
  for (const line of options.lines.slice(0, 12)) {
    const width = Math.min(WIDTH - 80, 40 + line.length * 5)
    rect(40, y, width, 6, MUTED)
    y += 20
  }

  rect(40, y + 8, WIDTH - 80, 2, INK)
  y += 26
  rect(40, y, 150, 8, INK)
  rect(WIDTH - 40 - 150, y, 150, 10, INK)

  rect(40, HEIGHT - 70, (WIDTH - 80) * 0.7, 6, MUTED)
  rect(40, HEIGHT - 52, (WIDTH - 80) * 0.45, 6, MUTED)
  rect(0, HEIGHT - 4, WIDTH, 4, INK)

  void options.merchant

  return encodePng(WIDTH, HEIGHT, pixels)
}
