import { useMemo } from 'react'
import { encodeQr } from '@/utils/qr'

export function QrCode({ value, size = 200, label }: { value: string; size?: number; label: string }) {
  const matrix = useMemo(() => {
    try {
      return encodeQr(value)
    } catch {
      return null
    }
  }, [value])
  if (!matrix) return <p className="text-sm">QR unavailable</p>
  const quiet = 4
  const n = matrix.length + quiet * 2
  const cells: string[] = []
  matrix.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      if (!row[x]) { x++; continue }
      let run = 1
      while (x + run < row.length && row[x + run]) run++
      cells.push(`M${x + quiet} ${y + quiet}h${run}v1h-${run}z`)
      x += run
    }
  })
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${n} ${n}`} width={size} height={size} shapeRendering="crispEdges" className="rounded-lg bg-white">
      <path d={cells.join('')} fill="#000" />
    </svg>
  )
}
