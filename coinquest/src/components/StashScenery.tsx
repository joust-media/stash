import { useEffect, useRef } from 'react'
import { Acorn, Leaf } from './ForestBackdrop'

/*
 * The burrow — scenery for the Stash-it takeover. Everything here is backdrop
 * silhouette work in brand colours (the same recipe as the Faint Forest
 * Layer); Stash himself stays a locked render, never drawn.
 *
 * Shading is a dark forest-neutral rather than Deep Leaf verbatim, because the
 * screen behind it may wear the kid's profile tint — a translucent dark green
 * deepens any of them without fighting the colour.
 */

const GROUND_SOFT = 'rgba(20, 46, 32, 0.35)'
const GROUND = 'rgba(20, 46, 32, 0.5)'
const BURROW = 'rgba(13, 28, 19, 0.82)'

/** White specks that pop off the burrow mouth as it swallows the acorn. */
const SPECKS = [
  { left: '32%', x: '-22px', delay: '700ms' },
  { left: '46%', x: '-8px', delay: '760ms' },
  { left: '58%', x: '10px', delay: '720ms' },
  { left: '70%', x: '24px', delay: '780ms' },
]

/** The pile outside the burrow, biggest in the middle. Drawn front to back. */
const PILE: { width: number; rotate: number; opacity: number }[] = [
  { width: 24, rotate: 0, opacity: 0.9 },
  { width: 18, rotate: -24, opacity: 0.85 },
  { width: 17, rotate: 28, opacity: 0.85 },
  { width: 15, rotate: -12, opacity: 0.8 },
  { width: 14, rotate: 18, opacity: 0.8 },
]

/**
 * The environment layer for the Stash-it flow: a canopy up top, the ground
 * falling away toward a burrow at the bottom. `pile` (1–5) sizes the acorn
 * pile outside the mouth — the kid's saving made visible, felt not counted.
 * `gulp` plays the swallow — squash-and-stretch, specks, and one more acorn
 * joining the pile — and holds its end state, so the scene carries the new
 * acorn into the next beat.
 */
export function BurrowScene({ gulp, pile = 3 }: { gulp?: boolean; pile?: number }) {
  const acorns = PILE.slice(0, Math.max(1, Math.min(PILE.length, pile)))
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Stepping down toward the forest floor. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, transparent 42%, rgba(16, 38, 26, 0.28) 72%, rgba(16, 38, 26, 0.5) 100%)',
        }}
      />

      {/* Canopy: the locked white 6–8% shapes, two of them breathing. */}
      <Leaf
        className="animate-sway absolute text-white"
        style={{ right: '-7%', top: '22%', width: 116, opacity: 0.06 }}
      />
      <Acorn
        className="absolute text-white"
        style={{ left: '-6%', top: '36%', width: 92, opacity: 0.05, transform: 'rotate(14deg)' }}
      />

      {/* The ground: two overlapping mounds. */}
      <div
        className="absolute rounded-[50%]"
        style={{ bottom: -110, left: '-28%', width: '95%', height: 230, background: GROUND_SOFT }}
      />
      <div
        className="absolute rounded-[50%]"
        style={{ bottom: -130, right: '-30%', width: '105%', height: 260, background: GROUND }}
      />

      {/* The burrow mouth, dead centre where the acorn falls. */}
      <div
        className={gulp ? 'animate-gulp absolute' : 'absolute'}
        style={{ bottom: 46, left: '50%', width: 148, transform: 'translateX(-50%)' }}
      >
        <div
          className="relative mx-auto"
          style={{ width: 132, height: 74, borderRadius: '999px 999px 0 0', background: BURROW }}
        >
          {gulp &&
            SPECKS.map((s, i) => (
              <span
                key={i}
                className="animate-pop absolute top-0 h-1.5 w-1.5 rounded-full bg-white"
                style={{ left: s.left, '--pop-x': s.x, animationDelay: s.delay } as React.CSSProperties}
              />
            ))}
        </div>
        {/* Acorns spilling from the mouth — the pile the kid is adding to. */}
        <div className="text-chestnut relative -mt-3 flex items-end justify-center gap-0.5">
          {[...acorns.filter((_, i) => i % 2 === 1).reverse(), acorns[0]].map((a, i) => (
            <Acorn
              key={`l${i}`}
              style={{ width: a.width, opacity: a.opacity, transform: `rotate(${a.rotate}deg)` }}
            />
          ))}
          {gulp && (
            <Acorn
              className="animate-bounce-in"
              style={{ width: 21, transform: 'rotate(10deg)', animationDelay: '950ms' }}
            />
          )}
          {acorns
            .filter((_, i) => i % 2 === 0 && i > 0)
            .map((a, i) => (
              <Acorn
                key={`r${i}`}
                style={{ width: a.width, opacity: a.opacity, transform: `rotate(${a.rotate}deg)` }}
              />
            ))}
        </div>
      </div>
    </div>
  )
}

/**
 * The commit moment's actor: one chestnut acorn that hops up and falls into
 * the burrow. Calls `onDone` when its travel ends — with a timeout fallback so
 * a dropped animation event (or reduced motion) still advances the flow.
 */
export function AcornDrop({ onDone }: { onDone: () => void }) {
  const fired = useRef(false)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  const finish = () => {
    if (fired.current) return
    fired.current = true
    doneRef.current()
  }

  useEffect(() => {
    const t = setTimeout(finish, 1400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    // Cream, not chestnut: the screen behind it may wear any profile tint,
    // and a brown acorn over a brown tint would fall invisibly.
    <span
      className="animate-acorn-drop text-cream inline-block"
      style={{ filter: 'drop-shadow(0 6px 8px rgba(0, 0, 0, 0.28))' }}
      onAnimationEnd={finish}
    >
      <Acorn style={{ width: 54 }} />
    </span>
  )
}
