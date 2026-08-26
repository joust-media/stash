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
