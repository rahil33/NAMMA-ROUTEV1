import { type ButtonHTMLAttributes, forwardRef } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-[var(--color-primary)] text-[var(--color-ink-950)] font-bold shadow-[0_10px_24px_-8px_rgba(32,214,199,0.7)] hover:brightness-105',
  secondary:
    'bg-white/85 text-[var(--color-ink-950)] hover:bg-white border border-white/70 shadow-sm',
  ghost: 'bg-transparent text-[var(--color-ink-950)] hover:bg-black/5',
  danger: 'bg-[var(--color-warn-600)] text-white hover:opacity-90',
}

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'px-4 py-2 text-sm rounded-full',
  md: 'px-5 py-3 text-sm rounded-full',
  lg: 'px-6 py-4 text-base rounded-full',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center gap-2 font-medium transition duration-200 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'
