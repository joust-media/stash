import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { ForestShapes } from './ForestBackdrop'

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

/* ------------------------------------------------------------- chrome ---- */

function useClock(): string {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  return now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M/i, '')
}

export function StatusBar({ onGreen }: { onGreen?: boolean }) {
  const time = useClock()
  return (
    <div
      className={cx(
        'device__statusbar h-11 shrink-0 items-center justify-between px-7 text-[13px] font-bold',
        onGreen ? 'text-white' : 'text-chestnut',
      )}
    >
      <span>{time}</span>
      <span className="tracking-[0.15em] opacity-70">●●●</span>
    </div>
  )
}

/**
 * The phone frame. `tone="green"` paints the whole screen Leaf Green with the
 * locked forest layer behind it — used for the welcome and celebration takeovers.
 */
/**
 * A profile colour is an identity, not a guaranteed surface: the picker offers
 * gold, and gold behind white text is unreadable. Darken anything too bright
 * until it can carry white, so "my colour is gold" becomes a deep ochre page
 * rather than a broken one.
 */
export function pageTint(color: string | null | undefined): string | undefined {
  if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) return undefined
  let r = parseInt(color.slice(1, 3), 16)
  let g = parseInt(color.slice(3, 5), 16)
  let b = parseInt(color.slice(5, 7), 16)
  let guard = 0
  while ((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.45 && guard++ < 8) {
    r = Math.round(r * 0.85)
    g = Math.round(g * 0.85)
    b = Math.round(b * 0.85)
  }
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

export function Screen({
  children,
  tone = 'cream',
  hero,
  tint,
}: {
  children: ReactNode
  tone?: 'cream' | 'green'
  /** A <Hero>, which paints its own Leaf Green band and status bar. */
  hero?: ReactNode
  /** The kid's profile colour — recolours the hero band and any green surface. */
  tint?: string | null
}) {
  const safe = pageTint(tint)
  return (
    <div className="device" style={safe ? ({ '--screen-tint': safe } as React.CSSProperties) : undefined}>
      <div className={cx('device__screen', tone === 'green' && 'device__screen--green')}>
        {tone === 'green' && <ForestShapes />}
        {hero ?? <StatusBar onGreen={tone === 'green'} />}
        {children}
      </div>
    </div>
  )
}

export function BackHeader({
  title,
  to,
  onGreen,
}: {
  title: string
  to?: string
  onGreen?: boolean
}) {
  const navigate = useNavigate()
  return (
    <div className="flex shrink-0 items-center gap-3 px-5 py-3">
      <button
        type="button"
        aria-label="Go back"
        onClick={() => (to ? navigate(to) : navigate(-1))}
        className={cx(
          'pressable flex h-11 w-11 items-center justify-center rounded-full text-[18px]',
          onGreen ? 'bg-white/20 text-white' : 'text-chestnut bg-white shadow-[var(--shadow-card)]',
        )}
      >
        ←
      </button>
      <h1 className={cx('text-[26px] font-extrabold', onGreen && 'text-white')}>{title}</h1>
    </div>
  )
}

/** The wordmark is typeset, not a logo file: "Stash." in Baloo 2 ExtraBold. */
export function Wordmark({ size = 44, onGreen = true }: { size?: number; onGreen?: boolean }) {
  return (
    <span
      className={cx('display leading-none font-extrabold', onGreen ? 'text-white' : 'text-chestnut')}
      style={{ fontSize: size, letterSpacing: '-0.01em' }}
    >
      Stash.
    </span>
  )
}

/* -------------------------------------------------------------- labels --- */

export function Eyebrow({
  children,
  onGreen,
  className,
}: {
  children: ReactNode
  onGreen?: boolean
  className?: string
}) {
  return (
    <span className={cx('eyebrow', onGreen ? 'text-white/85' : 'text-leaf-deep', className)}>{children}</span>
  )
}

/** Uppercase metadata pill. Translucent white on green, cream on light. */
export function Chip({
  children,
  onGreen = false,
  tone = 'default',
}: {
  children: ReactNode
  onGreen?: boolean
  /** `reward` is gold and only legal at win moments. */
  tone?: 'default' | 'reward' | 'caution'
}) {
  const skin = onGreen
    ? 'bg-white/16 text-white'
    : tone === 'reward'
      ? 'bg-gold/20 text-chestnut'
      : tone === 'caution'
        ? 'bg-coral/12 text-coral'
        : 'bg-cream text-leaf-deep'
  return (
    <span className={cx('chip-text inline-flex items-center gap-2 rounded-full px-4 py-2', skin)}>
      {children}
    </span>
  )
}

/* --------------------------------------------------------------- cards --- */

export function Card({
  children,
  className,
  onClick,
  style,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
  style?: CSSProperties
}) {
  const classes = cx(
    'bg-surface rounded-card shrink-0 shadow-[var(--shadow-card)]',
    onClick && 'liftable w-full text-left',
    className,
  )
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes} style={style}>
        {children}
      </button>
    )
  }
  return (
    <div className={classes} style={style}>
      {children}
    </div>
  )
}

/** Cream example panel, radius 12, used inside cards. */
export function InsetPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('bg-cream rounded-inset px-3 py-2.5', className)}>{children}</div>
}

/* ------------------------------------------------------------ avatars ---- */

/** Picks legible text for a given avatar colour rather than assuming white. */
function inkFor(hex: string): string {
  const v = hex.replace('#', '')
  const r = parseInt(v.slice(0, 2), 16)
  const g = parseInt(v.slice(2, 4), 16)
  const b = parseInt(v.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.55 ? '#5C3319' : '#FAF3E3'
}

export function Avatar({
  initial,
  color,
  size = 44,
  ring,
  image,
}: {
  initial: string
  color: string
  size?: number
  /** 3px white ring for overlapping stacks. */
  ring?: boolean
  /** A real photo replaces the initial disc entirely. */
  image?: string | null
}) {
  if (image) {
    return (
      <img
        src={image}
        alt=""
        className={cx('shrink-0 rounded-full object-cover', ring && 'ring-3 ring-white')}
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="display flex shrink-0 items-center justify-center rounded-full font-extrabold"
      style={{
        width: size,
        height: size,
        background: color,
        color: inkFor(color),
        fontSize: Math.round(size * 0.44),
        border: ring ? '3px solid #FFFFFF' : undefined,
      }}
    >
      {initial}
    </div>
  )
}

/* ------------------------------------------------------------ buttons ---- */

interface ButtonProps {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}

/**
 * The pill CTA: radius 999, min-height 56, Baloo 2 Bold 18. One per screen.
 * `reward` (gold) is for wins only; `onGreen` for Leaf Green surfaces.
 */
export function Button({
  children,
  onClick,
  disabled,
  variant = 'primary',
  className,
}: ButtonProps & { variant?: 'primary' | 'reward' | 'onGreen' }) {
  const skin = {
    primary: 'bg-leaf text-white hover:bg-leaf-deep',
    reward: 'bg-gold text-mustache',
    onGreen: 'bg-white text-leaf',
  }[variant]

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'pressable display inline-flex min-h-14 w-full items-center justify-center rounded-full px-11 py-3.5',
        'text-[18px] font-bold whitespace-nowrap shadow-[var(--shadow-button)]',
        'disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none',
        skin,
        className,
      )}
    >
      {children}
    </button>
  )
}

/** Compact pill for repeated row actions, which are not the screen's one CTA. */
export function SmallButton({
  children,
  onClick,
  disabled,
  variant = 'leaf',
  className,
}: ButtonProps & { variant?: 'leaf' | 'quiet' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'pressable display inline-flex min-h-11 items-center justify-center rounded-full px-5',
        'text-[15px] font-bold whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-45',
        variant === 'leaf'
          ? 'bg-leaf text-white hover:bg-leaf-deep'
          : 'border-line-cream text-mustache border-2 bg-transparent',
        className,
      )}
    >
      {children}
    </button>
  )
}

/** Underlined text link, as under the welcome screen's CTA. */
export function TextLink({
  children,
  onClick,
  onGreen,
  className,
}: ButtonProps & { onGreen?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'w-full py-2 text-center text-[15px] font-bold underline underline-offset-4 transition-opacity hover:opacity-75',
        onGreen ? 'text-white' : 'text-leaf-deep',
        className,
      )}
    >
      {children}
    </button>
  )
}

/* --------------------------------------------------------------- chips --- */

/** Selectable chip: cream by default, Leaf Green when chosen. */
export function ChoiceChip({
  children,
  selected,
  onClick,
}: {
  children: ReactNode
  selected?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cx(
        'shrink-0 rounded-full border-2 px-4 py-2.5 text-[14px] font-bold transition-colors duration-150',
        selected
          ? 'border-leaf bg-leaf text-white'
          : 'border-line-cream text-mustache hover:border-leaf/50 bg-white',
      )}
    >
      {children}
    </button>
  )
}

/* ------------------------------------------------------------ display ---- */

/** Goal progress. Fills gold once the goal is reached — that is a win. */
export function ProgressBar({ pct, onGreen }: { pct: number; onGreen?: boolean }) {
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <div className={cx('h-2.5 overflow-hidden rounded-full', onGreen ? 'bg-white/25' : 'bg-cream')}>
      <div
        className={cx(
          'h-full rounded-full transition-[width] duration-300 ease-out',
          clamped >= 100 ? 'bg-gold' : onGreen ? 'bg-white' : 'bg-leaf',
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

export function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cx(
        'flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors duration-150',
        on ? 'bg-leaf justify-end' : 'bg-line-cream justify-start',
      )}
    >
      <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
    </button>
  )
}

/** Tinted glyph circle for ledger rows. */
export function IconCircle({
  glyph,
  tone,
}: {
  glyph: string
  tone: 'reward' | 'leaf' | 'coral'
}) {
  const skin = {
    reward: 'bg-gold/20 text-chestnut',
    leaf: 'bg-leaf/15 text-leaf-deep',
    coral: 'bg-coral/15 text-coral',
  }[tone]
  return (
    <div className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[17px]', skin)}>
      {glyph}
    </div>
  )
}

/* --------------------------------------------------------------- tabs ---- */

export interface Tab {
  to: string
  label: string
}

/*
 * Nav labels are ALL-CAPS Nunito Bold, text only — the brand guide defines no
 * icon set and says to prefer labels. The money tab is the kid's own stash,
 * so it carries the product's word for it.
 */
export const KID_TABS = (kidId: number): Tab[] => [
  { to: `/kid/${kidId}`, label: 'Home' },
  { to: `/kid/${kidId}/tasks`, label: 'Earn' },
  { to: `/kid/${kidId}/goals`, label: 'Goals' },
  { to: `/kid/${kidId}/bank`, label: 'My Stash' },
]

export const PARENT_TABS: Tab[] = [
  { to: '/parent', label: 'Family' },
  { to: '/parent/admin', label: 'Manage' },
  { to: '/parent/approvals', label: 'Approvals' },
  { to: '/parent/ledger', label: 'Ledger' },
]

export function TabBar({ tabs }: { tabs: Tab[] }) {
  return (
    <nav
      className="border-line-cream bg-surface flex shrink-0 items-stretch justify-between gap-0.5 border-t px-2 pt-3"
      style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom, 0px))' }}
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end
          className={({ isActive }) =>
            cx(
              'flex flex-1 items-center justify-center rounded-full px-1 py-2.5 text-center whitespace-nowrap',
              'font-body text-[10px] leading-none font-bold tracking-[0.05em] uppercase transition-colors duration-150',
              isActive ? 'bg-leaf text-white' : 'text-mustache/55 hover:text-mustache',
            )
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}

/* -------------------------------------------------------------- states --- */

export function ScreenMessage({ children, onGreen }: { children: ReactNode; onGreen?: boolean }) {
  return (
    <div
      className={cx(
        'flex flex-1 items-center justify-center px-8 text-center text-[15px]',
        onGreen ? 'text-white/80' : 'text-mustache/70',
      )}
    >
      {children}
    </div>
  )
}

export function Spinner({ onGreen }: { onGreen?: boolean }) {
  return (
    <ScreenMessage onGreen={onGreen}>
      <span className="animate-fade">Just a sec…</span>
    </ScreenMessage>
  )
}

/** Coral is the caution accent — it is never a button or a balance. */
export function WarningBanner({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-inset border-coral/35 bg-coral/8 flex items-start gap-3 border-2 px-4 py-3.5">
      <span className="display text-coral text-[19px] leading-none font-extrabold">!</span>
      <p className="text-mustache text-[14px] leading-[1.5]">{children}</p>
    </div>
  )
}

/* --------------------------------------------------------------- forms --- */

/** Labelled field wrapper — eyebrow above, cream input below. */
export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <Eyebrow>{label}</Eyebrow>
      {children}
      {hint && <span className="text-mustache/60 text-[12px]">{hint}</span>}
    </label>
  )
}

/*
 * White with a cream hairline, so a field reads on the cream app background as
 * well as inside a white card. A cream fill would vanish against the app.
 */
export const FIELD_CLASS =
  'bg-surface border-line-cream focus:border-leaf rounded-inset placeholder:text-mustache/45 w-full border-2 px-4 py-3 text-[16px] outline-none transition-colors'

export function TextField({
  value,
  onChange,
  placeholder,
  inputMode,
  maxLength,
  autoFocus,
}: {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  inputMode?: 'text' | 'decimal' | 'numeric'
  maxLength?: number
  autoFocus?: boolean
}) {
  return (
    <input
      value={value}
      autoFocus={autoFocus}
      inputMode={inputMode}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={FIELD_CLASS}
    />
  )
}

/** The Stash avatar palette as pickable swatches. */
export function ColorPicker({
  colors,
  value,
  onChange,
}: {
  colors: string[]
  value: string
  onChange: (next: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`Use ${color}`}
          aria-pressed={value === color}
          onClick={() => onChange(color)}
          className={cx(
            'h-11 w-11 rounded-full transition-transform duration-150',
            value === color ? 'ring-leaf-deep scale-110 ring-3 ring-offset-2' : 'hover:scale-105',
          )}
          style={{ background: color }}
        />
      ))}
    </div>
  )
}

/** Segmented switch for admin sections. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[]
  value: T
  onChange: (next: T) => void
}) {
  return (
    <div className="bg-cream flex gap-1 rounded-full p-1">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          aria-pressed={value === o.key}
          className={cx(
            'flex-1 rounded-full px-3 py-2 text-[14px] font-bold transition-colors duration-150',
            value === o.key ? 'bg-leaf text-white' : 'text-mustache/70 hover:text-mustache',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Destructive text action — coral, and never a pill. */
export function DangerLink({ children, onClick, disabled }: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-coral py-2 text-[14px] font-bold underline underline-offset-4 transition-opacity hover:opacity-75 disabled:opacity-40"
    >
      {children}
    </button>
  )
}
