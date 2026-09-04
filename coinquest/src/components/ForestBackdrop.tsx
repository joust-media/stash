import type { CSSProperties, ReactNode } from 'react'

/*
 * The locked "Faint Forest Layer": acorns and oak leaves, tone-on-tone, white
 * at 6–8%, 80–160px, cropped at the edges, 3–6 per screen. Legal over Leaf
 * Green ONLY — never on cream, never behind text. "Felt, not seen."
 *
 * These are background silhouettes, not the mascot: the guide's rule against
 * hand-drawn SVG applies to Stash himself, and names acorns/leaves/nuts as the
 * backdrop recipe.
 */

export function Acorn({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 100 120" className={className} style={style} aria-hidden focusable="false">
      <path d="M48 2h4a4 4 0 0 1 0 8h-4a4 4 0 0 1 0-8Z" fill="currentColor" />
      <path d="M18 40C18 22 32 10 50 10s32 12 32 30c0 5-3 7-8 7H26c-5 0-8-2-8-7Z" fill="currentColor" />
      <path d="M24 49h52c0 38-9 62-26 69-17-7-26-31-26-69Z" fill="currentColor" />
    </svg>
  )
}

export function Leaf({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 100 120" className={className} style={style} aria-hidden focusable="false">
      <path
        d="M50 4c8 14 20 14 24 26 12 0 14 12 6 18 12 6 8 20-4 20 8 10 0 22-12 18-2 14-12 20-14 30-2-10-12-16-14-30-12 4-20-8-12-18-12 0-16-14-4-20-8-6-6-18 6-18C30 18 42 18 50 4Z"
        fill="currentColor"
      />
    </svg>
  )
}

interface Shape {
  Comp: typeof Acorn
  style: CSSProperties
  opacity: number
}

const SHAPES: Shape[] = [
  { Comp: Acorn, style: { left: '-9%', top: '-14%', width: 148, transform: 'rotate(-14deg)' }, opacity: 0.07 },
  { Comp: Leaf, style: { right: '-8%', top: '10%', width: 132, transform: 'rotate(22deg)' }, opacity: 0.06 },
  { Comp: Leaf, style: { left: '6%', bottom: '-18%', width: 156, transform: 'rotate(-8deg)' }, opacity: 0.07 },
  { Comp: Acorn, style: { right: '16%', bottom: '-12%', width: 96, transform: 'rotate(16deg)' }, opacity: 0.06 },
  { Comp: Acorn, style: { left: '46%', top: '-20%', width: 88, transform: 'rotate(8deg)' }, opacity: 0.05 },
]

/** Just the layer, for surfaces that already paint themselves Leaf Green. */
export function ForestShapes() {
  return (
    <div className="forest-layer text-white">
      {SHAPES.map(({ Comp, style: s, opacity }, i) => (
        <Comp key={i} style={{ position: 'absolute', opacity, ...s }} />
      ))}
    </div>
  )
}

/** Leaf Green surface carrying the locked forest layer. */
export function ForestBackdrop({
  children,
  className = '',
  style,
}: {
  children?: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: 'var(--screen-tint, var(--leaf-green))', ...style }}
    >
      <ForestShapes />
      <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
