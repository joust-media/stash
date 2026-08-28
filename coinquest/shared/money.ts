/**
 * The one money formatter, shared by the API and the client so a label built on
 * the server never disagrees with one built in the browser.
 *
 * Whole dollars lose the `.00`; anything with cents keeps them — rounding $2.50
 * to $2 would be losing real money, so only the empty decimals go.
 */
export function formatMoney(cents: number): string {
  const abs = Math.abs(cents)
  const whole = Math.floor(abs / 100).toLocaleString('en-US')
  const pennies = abs % 100
  return pennies === 0 ? `$${whole}` : `$${whole}.${String(pennies).padStart(2, '0')}`
}

/** Dollars and cents split so the cents can render at 60%, per the type rules. */
export function splitMoney(cents: number): { whole: string; pennies: string | null } {
  const abs = Math.abs(cents)
  const remainder = abs % 100
  return {
    whole: `$${Math.floor(abs / 100).toLocaleString('en-US')}`,
    pennies: remainder === 0 ? null : `.${String(remainder).padStart(2, '0')}`,
  }
}

/* ---------------------------------------------------------------- match --- */

/**
 * The Good Stuff split. A parent names something they would like the kid to
 * have and commits to a share of it; the kid saves for the rest.
 *
 * Flooring the kid's share means the odd cent always lands on the parent.
 * Half a cent is not worth an argument.
 *
 * Shared so the number a parent sees while setting the match is the same number
 * the kid saves towards and the same number the server locks in at adoption.
 */
export function splitMatch(
  priceCents: number,
  matchPercent: number,
): { kidShareCents: number; matchAmountCents: number } {
  const price = Math.max(0, Math.round(priceCents))
  const percent = Math.min(MAX_MATCH_PERCENT, Math.max(0, Math.round(matchPercent)))
  const kidShareCents = Math.floor((price * (100 - percent)) / 100)
  return { kidShareCents, matchAmountCents: price - kidShareCents }
}

/**
 * A full match is a gift, not a goal, and it guts the premise that money is
 * earned. The cap is the feature's backbone, not a validation detail.
 */
export const MAX_MATCH_PERCENT = 90
/** Below this there is nothing left to save for. */
export const MIN_KID_SHARE_CENTS = 100
/** Matches the top savings rung. */
export const MAX_ITEM_PRICE_CENTS = 100_000

/**
 * "Dad pays half" reads better than "Dad pays 50%", and only for a half.
 * Anything else states the percentage plainly.
 *
 * The parent's own screens pass "You", which takes the second person — "You
 * pays 25%" is the kind of thing that survives all the way to a screenshot.
 */
export function matchLabel(payer: string, matchPercent: number): string {
  const verb = payer.toLowerCase() === 'you' ? 'pay' : 'pays'
  return matchPercent === 50 ? `${payer} ${verb} half` : `${payer} ${verb} ${matchPercent}%`
}
