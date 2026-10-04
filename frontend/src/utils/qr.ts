// Minimal self-contained QR Code encoder (byte mode, error correction M, versions 1-10).
// Written in-house so the app needs no extra dependency. Returns a square boolean matrix
// (true = dark module) without the quiet zone.

// Data codewords and block layout for EC level M: [ecPerBlock, [blockCount, dataPerBlock][]]
const M_TABLE: [number, [number, number][]][] = [
  [10, [[1, 16]]], [16, [[1, 28]]], [26, [[1, 44]]], [18, [[2, 32]]], [24, [[2, 43]]],
  [16, [[4, 27]]], [18, [[4, 31]]], [22, [[2, 38], [2, 39]]], [22, [[3, 36], [2, 37]]], [26, [[4, 43], [1, 44]]],
]
const ALIGN: number[][] = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]]

const EXP: number[] = []
const LOG: number[] = []
;(() => {
  let x = 1
  for (let i = 0; i < 255; i++) {
    EXP[i] = x
    LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]
})()

const gfMul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]])

function rsRemainder(data: number[], degree: number): number[] {
  let gen = [1]
  for (let i = 0; i < degree; i++) {
    const next = new Array(gen.length + 1).fill(0)
    gen.forEach((c, j) => {
      next[j] ^= gfMul(c, EXP[i])
      next[j + 1] ^= c
    })
    gen = next
  }
  // gen is stored low-order first; the leading coefficient (1) is last.
  const rem: number[] = new Array(degree).fill(0)
  for (const b of data) {
    const factor = b ^ rem[0]
    rem.shift()
    rem.push(0)
    for (let i = 0; i < degree; i++) rem[i] ^= gfMul(gen[degree - 1 - i], factor)
  }
  return rem
}

const bit = (v: number, i: number) => ((v >>> i) & 1) === 1

function encodeData(bytes: number[], version: number): number[] {
  const capacity = M_TABLE[version - 1][1].reduce((s, [n, d]) => s + n * d, 0)
  const bits: number[] = []
  const push = (v: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((v >>> i) & 1)
  }
  push(0b0100, 4)
  push(bytes.length, version >= 10 ? 16 : 8)
  bytes.forEach((b) => push(b, 8))
  push(0, Math.min(4, capacity * 8 - bits.length))
  while (bits.length % 8) bits.push(0)
  const out: number[] = []
  for (let i = 0; i < bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8).join(''), 2))
  for (let pad = 0xec; out.length < capacity; pad ^= 0xec ^ 0x11) out.push(pad)
  return out
}

function interleave(data: number[], version: number): number[] {
  const [ec, layout] = M_TABLE[version - 1]
  const blocks: number[][] = []
  let pos = 0
  for (const [count, size] of layout) {
    for (let i = 0; i < count; i++) {
      blocks.push(data.slice(pos, pos + size))
      pos += size
    }
  }
  const ecs = blocks.map((b) => rsRemainder(b, ec))
  const out: number[] = []
  const maxLen = Math.max(...blocks.map((b) => b.length))
  for (let i = 0; i < maxLen; i++) blocks.forEach((b) => i < b.length && out.push(b[i]))
  for (let i = 0; i < ec; i++) ecs.forEach((e) => out.push(e[i]))
  return out
}

function penalty(m: boolean[][]): number {
  const n = m.length
  let p = 0
  const runs = (get: (i: number, j: number) => boolean) => {
    for (let i = 0; i < n; i++) {
      let run = 1
      for (let j = 1; j < n; j++) {
        if (get(i, j) === get(i, j - 1)) run++
        else {
          if (run >= 5) p += run - 2
          run = 1
        }
      }
      if (run >= 5) p += run - 2
      const line = Array.from({ length: n }, (_, j) => (get(i, j) ? 1 : 0)).join('')
      for (const pat of ['10111010000', '00001011101']) {
        let k = line.indexOf(pat)
        while (k !== -1) {
          p += 40
          k = line.indexOf(pat, k + 1)
        }
      }
    }
  }
  runs((i, j) => m[i][j])
  runs((i, j) => m[j][i])
  for (let y = 0; y < n - 1; y++)
    for (let x = 0; x < n - 1; x++) if (m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3
  const dark = m.flat().filter(Boolean).length
  p += Math.floor(Math.abs((dark * 20) / (n * n) - 10)) * 10 // 10 points per 5% away from balance... (coarse)
  return p
}

const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
]

function writeFormat(put: (x: number, y: number, dark: boolean) => void, size: number, mask: number) {
  let rem = mask // EC level M = 00, so the 5 data bits are just the mask
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
  const bits = ((mask << 10) | rem) ^ 0x5412
  for (let i = 0; i <= 5; i++) put(8, i, bit(bits, i))
  put(8, 7, bit(bits, 6))
  put(8, 8, bit(bits, 7))
  put(7, 8, bit(bits, 8))
  for (let i = 9; i < 15; i++) put(14 - i, 8, bit(bits, i))
  for (let i = 0; i < 8; i++) put(size - 1 - i, 8, bit(bits, i))
  for (let i = 8; i < 15; i++) put(8, size - 15 + i, bit(bits, i))
  put(8, size - 8, true) // always-dark module
}

export function encodeQr(text: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(text))
  let version = 1
  const fits = (v: number) => (v >= 10 ? 4 + 16 : 4 + 8) + bytes.length * 8 <= M_TABLE[v - 1][1].reduce((s, [n, d]) => s + n * d, 0) * 8
  while (version <= 10 && !fits(version)) version++
  if (version > 10) throw new Error('Ticket payload too long for QR')

  const size = version * 4 + 17
  const mod: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false))
  const fn: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false))
  const set = (x: number, y: number, dark: boolean) => {
    mod[y][x] = dark
    fn[y][x] = true
  }

  // Timing patterns
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0)
    set(i, 6, i % 2 === 0)
  }
  // Finder patterns with separators
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy
        if (x < 0 || y < 0 || x >= size || y >= size) continue
        const d = Math.max(Math.abs(dx), Math.abs(dy))
        set(x, y, d !== 2 && d !== 4)
      }
  }
  // Alignment patterns
  const pos = ALIGN[version - 1]
  pos.forEach((cy, i) =>
    pos.forEach((cx, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === pos.length - 1) || (i === pos.length - 1 && j === 0)) return
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
    }),
  )
  writeFormat(set, size, 0) // reserve the format areas; real bits are written after masking
  if (version >= 7) {
    let rem = version
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
    const bits = (version << 12) | rem
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3), b = Math.floor(i / 3)
      set(a, b, bit(bits, i))
      set(b, a, bit(bits, i))
    }
  }

  // Place data bits in the zig-zag order
  const codewords = interleave(encodeData(bytes, version), version)
  let k = 0
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < size; vert++)
      for (let j = 0; j < 2; j++) {
        const x = right - j
        const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert
        if (!fn[y][x] && k < codewords.length * 8) {
          mod[y][x] = bit(codewords[k >>> 3], 7 - (k & 7))
          k++
        }
      }
  }

  // Choose the mask with the lowest penalty
  let best = mod, bestPenalty = Infinity
  for (let mask = 0; mask < 8; mask++) {
    const trial = mod.map((row) => row.slice())
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[mask](x, y)) trial[y][x] = !trial[y][x]
    writeFormat((x, y, dark) => { trial[y][x] = dark }, size, mask)
    const p = penalty(trial)
    if (p < bestPenalty) { bestPenalty = p; best = trial }
  }
  return best
}
