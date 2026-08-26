import type { MoneyTone } from '../components/Money'
import { formatMoney, splitMoney } from '../../shared/money'

/** A true minus sign (U+2212), not a hyphen. */
export const MINUS = '−'

export { splitMoney }

export const money = formatMoney

export function signedMoney(cents: number): string {
  return `${cents < 0 ? MINUS : '+'}${money(cents)}`
}

/**
 * Colour by meaning, within the Stash palette:
 * gold is the earned colour and shows only when the kid wins, a parent's
 * deposit is Leaf Green, and money going back out takes the coral caution accent.
 */
export function amountTone(type: 'earn' | 'deposit' | 'withdraw'): MoneyTone {
  if (type === 'earn') return 'reward'
  if (type === 'deposit') return 'leaf'
  return 'spend'
}
