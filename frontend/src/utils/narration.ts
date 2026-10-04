import type { Journey } from '@/types'
import type { Translate } from '@/i18n/useT'
import { formatDistance } from '@/utils/formatting'

/** One short spoken instruction for the current live segment. */
export function narrationText(journey: Journey, index: number, t: Translate): string {
  const seg = journey.segments[index]
  if (!seg) return t('narArrived', { place: journey.destination.name })
  if (seg.mode === 'walk') return t('narWalk', { distance: formatDistance(seg.distanceMeters ?? 0), place: seg.to })
  if (seg.mode === 'auto') return t('narAuto', { place: seg.to })
  return t('narAlight', { place: seg.to })
}
