import type { CSSProperties } from 'react'
import { splitMoney } from '../lib/format'
import { cx } from './ui'

/*
 * Money type rule: Baloo 2 ExtraBold with the cents at 60% of the dollar size.
 * Whole dollars drop the `.00` entirely — the cents span only renders when
 * there are cents to show.
 *
 * Earned deltas bounce in Acorn Gold; gold is the earned colour and appears
 * only when the kid wins.
 */

export type MoneyTone = 'heading' | 'reward' | 'leaf' | 'onGreen' | 'spend' | 'muted'

const TONE: Record<MoneyTone, string> = {
  heading: 'text-chestnut',
  reward: 'text-gold',
  leaf: 'text-leaf-deep',
  onGreen: 'text-white',
  spend: 'text-coral',
  muted: 'text-mustache/55',
}

export function Money({
  cents,
  size = 42,
  tone = 'heading',
  sign,
  className,
  style,
}: {
  cents: number
  /** Dollar font size in px; cents render at 60%. */
  size?: number
  tone?: MoneyTone
  /** Force a leading sign. Omit for a plain balance. */
  sign?: '+' | '−'
  className?: string
  style?: CSSProperties
}) {
  const { whole, pennies } = splitMoney(cents)
  return (
    <span
      className={cx('display inline-flex items-baseline leading-none font-extrabold', TONE[tone], className)}
      style={{ fontSize: size, ...style }}
    >
      {sign}
      {whole}
      {pennies && <span style={{ fontSize: '60%' }}>{pennies}</span>}
    </span>
  )
}

/**
 * An earned amount, shown as an Acorn Gold pill with Mustache Brown text —
 * the same pairing as the brand's `reward` button. Gold as a fill rather than
 * as type keeps the win legible on both cream and Leaf Green, and gold still
 * appears only when the kid has actually won something.
 */
export function RewardBadge({
  cents,
  size = 22,
  bounce,
  className,
}: {
  cents: number
  size?: number
  bounce?: boolean
  className?: string
}) {
  const { whole, pennies } = splitMoney(cents)
  return (
    <span
      className={cx(
        'bg-gold text-mustache display inline-flex shrink-0 items-baseline rounded-full font-extrabold',
        bounce && 'animate-bounce-in',
        className,
      )}
      style={{ fontSize: size, padding: `${size * 0.3}px ${size * 0.62}px`, lineHeight: 1 }}
    >
      +{whole}
      {pennies && <span style={{ fontSize: '60%' }}>{pennies}</span>}
    </span>
  )
}
