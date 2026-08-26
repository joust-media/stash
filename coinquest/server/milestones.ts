import type { Milestone } from '../shared/types.ts'
import { formatMoney } from '../shared/money.ts'

/*
 * Milestones are derived, not stored: a fixed ladder that advances as a kid
 * earns. Nothing to configure, nothing to migrate, and a kid always has exactly
 * one rung in front of them.
 *
 * If these should become parent-authored instead, this is the seam — swap these
 * two functions for table reads and the screens do not change.
 */

interface Rung {
  at: number
  label: string
}

/** Things finished, lifetime. */
const ACHIEVEMENT_LADDER: Rung[] = [
  { at: 1, label: 'First win' },
  { at: 5, label: 'Warming up' },
  { at: 10, label: 'On a roll' },
  { at: 25, label: 'Chore champ' },
  { at: 50, label: 'Halfway to 100' },
  { at: 100, label: 'Century club' },
  { at: 250, label: 'Legend' },
]

/** Balance, in cents. */
const SAVINGS_LADDER: Rung[] = [
  { at: 1000, label: 'Save $10' },
  { at: 2500, label: 'Save $25' },
  { at: 5000, label: 'Save $50' },
  { at: 10000, label: 'Save $100' },
  { at: 25000, label: 'Save $250' },
  { at: 50000, label: 'Save $500' },
  { at: 100000, label: 'Save $1,000' },
]

function climb(ladder: Rung[], current: number, unit: 'count' | 'cents', done: string): Milestone {
  const index = ladder.findIndex((r) => current < r.at)
  const complete = index === -1
  const rung = complete ? ladder[ladder.length - 1] : ladder[index]
  // Progress runs from the rung below, so a bar never restarts from zero.
  const floor = complete ? 0 : index === 0 ? 0 : ladder[index - 1].at
  const span = Math.max(1, rung.at - floor)

  const money = formatMoney
  const remaining = rung.at - current
  const pct = complete ? 100 : Math.min(100, Math.round(((current - floor) / span) * 100))

  // Only nudge when the rung is genuinely close — otherwise "only" is a lie.
  const nudge =
    complete || pct < 80
      ? null
      : unit === 'cents'
        ? `Only ${money(remaining)} to go!`
        : `${remaining} more to go!`

  return {
    label: complete ? done : rung.label,
    detail: complete
      ? done
      : unit === 'cents'
        ? `${money(current)} of ${money(rung.at)}`
        : `${current} of ${rung.at} done`,
    current,
    target: rung.at,
    pct,
    unit,
    complete,
    nudge,
  }
}

export const achievementMilestone = (finishedCount: number): Milestone =>
  climb(ACHIEVEMENT_LADDER, finishedCount, 'count', 'Every rung climbed')

export const savingsMilestone = (balanceCents: number): Milestone =>
  climb(SAVINGS_LADDER, balanceCents, 'cents', 'Top of the ladder')
