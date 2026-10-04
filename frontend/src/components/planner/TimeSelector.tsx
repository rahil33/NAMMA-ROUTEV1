import { Clock } from 'lucide-react'

export type TimeMode = 'depart' | 'arrive'

interface TimeSelectorProps {
  mode: TimeMode
  onModeChange: (mode: TimeMode) => void
  time: string // "HH:MM"
  onTimeChange: (time: string) => void
}

export function TimeSelector({ mode, onModeChange, time, onTimeChange }: TimeSelectorProps) {
  return (
    <div className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-3">
      <Clock size={16} className="shrink-0 text-[var(--color-ink-700)]" aria-hidden />
      <select
        aria-label="Depart or arrive by"
        value={mode}
        onChange={(e) => onModeChange(e.target.value as TimeMode)}
        className="bg-transparent text-sm font-medium outline-none"
      >
        <option value="depart">Depart at</option>
        <option value="arrive">Arrive by</option>
      </select>
      <input
        aria-label="Time"
        type="time"
        value={time}
        onChange={(e) => onTimeChange(e.target.value)}
        className="ml-auto bg-transparent text-sm outline-none"
      />
    </div>
  )
}
