import type { Pose } from '../../shared/types'

/*
 * Stash himself. Poses are cropped from the locked master
 * (assets/design-system/assets/stash-pose-sheet.png) — never redrawn, never
 * recoloured, never outlined. Minimum 64px tall, one Stash per screen, on flat
 * brand colour only, with a soft drop shadow (`.mascot`).
 *
 * ── Adding artwork ───────────────────────────────────────────────────────────
 * Do not hand-cut renders into this folder. Drop the raw render in
 * `assets/stash/stash-poses/`, add a row to `assets/stash/tools/build.py`, and
 * run it — it keys out the white background and the baked contact shadow,
 * exports every size, and writes the webp here. Then add one line to POSES
 * below plus the name to `Pose` in shared/types.ts. Nothing else changes:
 * every screen picks its pose through HERO_POSE.
 */

export type { Pose }

interface PoseSpec {
  file: string
  alt: string
  /** The moment this pose is for, per the character sheet. */
  moment: string
}

export const POSES: Record<Pose, PoseSpec> = {
  'coin-toss': {
    file: '/stash/stash-coin-toss.webp',
    alt: 'Stash tossing a coin',
    moment: 'earning',
  },
  'coin-toss-alt': {
    file: '/stash/stash-coin-toss-alt.webp',
    alt: 'Stash tossing a coin',
    moment: 'earning',
  },
  'nut-pile': {
    file: '/stash/stash-nut-pile.webp',
    alt: 'Stash holding a pile of nuts',
    moment: 'balance',
  },
  confetti: {
    file: '/stash/stash-confetti.webp',
    alt: 'Stash cheering under confetti',
    moment: 'achievement complete',
  },
  'acorn-hug': {
    file: '/stash/stash-acorn-hug.webp',
    alt: 'Stash hugging a giant acorn',
    moment: 'savings goals',
  },
  tada: {
    file: '/stash/stash-tada.webp',
    alt: 'Stash leaping with both arms flung wide',
    moment: 'big win',
  },
}

/** The default pose for each screen. A person's own choice overrides it. */
export const HERO_POSE = {
  welcome: 'coin-toss',
  kidHome: 'nut-pile',
  achievements: 'coin-toss',
  piggyBank: 'acorn-hug',
  history: 'nut-pile',
  // The jump-spin is reserved for a genuine win — a task approved, a rung
  // cleared. Confetti stays on the parent's queue, where the win is someone
  // else's. Welcome keeps the coin toss: it opens every session, not just the
  // first, so it is not a "first login" moment.
  celebration: 'tada',
  parentFamily: 'nut-pile',
  parentAchievements: 'coin-toss',
  approvals: 'confetti',
  ledger: 'nut-pile',
  admin: 'acorn-hug',
  profile: 'coin-toss-alt',
  pin: 'nut-pile',
} as const satisfies Record<string, Pose>

export function Mascot({
  pose,
  height = 120,
  className = '',
}: {
  pose: Pose
  /** Height in px. The brand floor is 64. */
  height?: number
  className?: string
}) {
  const spec = POSES[pose] ?? POSES['coin-toss']
  return (
    <img
      src={spec.file}
      alt={spec.alt}
      className={`mascot block w-auto shrink-0 select-none ${className}`}
      style={{ height: Math.max(64, height) }}
      draggable={false}
    />
  )
}
