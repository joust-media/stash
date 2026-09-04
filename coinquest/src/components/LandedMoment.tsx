import { useMemo, useState } from 'react'
import type { KidHome } from '../../shared/types'
import { Leaf } from './ForestBackdrop'
import { Mascot } from './Mascot'
import { Money } from './Money'
import { Button } from './ui'

/*
 * The "it landed" moment: a parent confirmed cash the kid handed over, and the
 * next time the kid looks at Home or their Stash, the landing gets a beat of
 * its own. Deliberately restrained next to Celebration — no gold, no confetti:
 * this money was already theirs, so it gets leaves drifting home, not a party.
 *
 * Which landings have been seen lives in this browser (localStorage), pruned
 * to the ids the server still reports, so nothing is written server-side and
 * the list can never grow unbounded. Declined requests never reach this
 * component at all — the server only sends confirmed ones.
 */

const seenKey = (kidId: number) => `stash.landedSeen.${kidId}`

function readSeen(kidId: number): number[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(seenKey(kidId)) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === 'number') : []
  } catch {
    return []
  }
}

function writeSeen(kidId: number, ids: number[]) {
  try {
    localStorage.setItem(seenKey(kidId), JSON.stringify(ids))
  } catch {
    // Storage refusing to write only means the moment may replay. Fine.
  }
}

/** White and cream leaves drifting down — a leaf-fall, not confetti. */
function LeafFall() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        left: (i * 31 + 8) % 88,
        delay: (i % 5) * 220,
        duration: 2400 + ((i * 137) % 900),
        color: i % 2 === 0 ? '#FFFFFF' : '#FAF3E3',
        width: 15 + ((i * 7) % 9),
      })),
    [],
  )
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            top: 20,
            color: p.color,
            animationDelay: `${p.delay}ms`,
            animationDuration: `${p.duration}ms`,
          }}
        >
          <Leaf style={{ width: p.width, opacity: 0.85 }} />
        </span>
      ))}
    </div>
  )
}

/**
 * Mounts on Home and the Stash tab. Renders nothing until the payload carries
 * a confirmed hand-over this browser hasn't shown yet, then takes the screen
 * once. Several landings collapse into one moment with the summed amount.
 */
export function LandedMoment({ home }: { home: KidHome }) {
  const kidId = home.kid.id
  const [dismissed, setDismissed] = useState(false)

  const unseen = useMemo(() => {
    const seen = new Set(readSeen(kidId))
    return home.landed.filter((d) => !seen.has(d.id))
  }, [home.landed, kidId])

  if (dismissed || unseen.length === 0) return null

  const totalCents = unseen.reduce((s, d) => s + d.amountCents, 0)
  const byName = unseen[0].byName
  const notes = unseen.map((d) => d.note).filter((n): n is string => Boolean(n))

  const close = () => {
    // Everything currently reported counts as seen; ids that have aged out of
    // the server's window are dropped, so the stored list stays small.
    writeSeen(kidId, home.landed.map((d) => d.id))
    setDismissed(true)
  }

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="Your cash landed"
      className="absolute inset-0 z-50 flex flex-col overflow-hidden"
      style={{ background: 'var(--screen-tint, var(--leaf-green))' }}
    >
      <LeafFall />

      <div className="relative flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <Mascot pose="nut-pile" height={180} />
        <h1 className="animate-fade-up display text-[32px] font-extrabold text-white">It landed!</h1>
        <Money cents={totalCents} size={46} tone="onGreen" sign="+" className="animate-bounce-in" />
        <p className="max-w-[280px] text-[15px] leading-[1.5] text-white/90">
          Your cash made it home &mdash; {byName} confirmed it. That&rsquo;s the good stuff.
        </p>
        {notes.length > 0 && (
          <p className="max-w-[280px] text-[13px] leading-snug text-white/70">{notes.join(' · ')}</p>
        )}
      </div>

      <div className="relative shrink-0 px-6 pb-8">
        <Button variant="onGreen" onClick={close}>
          Nice
        </Button>
      </div>
    </div>
  )
}
