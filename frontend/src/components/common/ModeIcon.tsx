import { Bus, Footprints, TrainFront, Car, TramFront } from 'lucide-react'
import type { TransportMode } from '@/types'
import { MODE_COLOR } from '@/utils/formatting'

const ICONS: Record<TransportMode, typeof Bus> = {
  walk: Footprints,
  bus: Bus,
  metro: TramFront,
  'suburban-rail': TrainFront,
  auto: Car,
}

export function ModeIcon({ mode, size = 16, className = '' }: { mode: TransportMode; size?: number; className?: string }) {
  const Icon = ICONS[mode]
  return <Icon size={size} className={className} style={{ color: MODE_COLOR[mode] }} aria-hidden />
}
