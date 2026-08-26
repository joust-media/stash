import {
  ArrowsClockwise,
  Baseball,
  Bathtub,
  Bed,
  BookOpen,
  Broom,
  Car,
  Confetti,
  CookingPot,
  Dog,
  Drop,
  ForkKnife,
  GraduationCap,
  Leaf,
  MusicNotes,
  PawPrint,
  PencilSimple,
  Plant,
  Recycle,
  ShoppingCart,
  Sparkle,
  Sunglasses,
  TShirt,
  Trash,
  Wind,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react'
import { cx } from './ui'

/*
 * The brand guide defines no icon set and says to prefer text labels; where
 * icons are unavoidable it names a rounded, filled, friendly set — Phosphor
 * Fill — tinted with brand colours, and asks that the substitution be flagged.
 * This is that substitution, and it is used only on task tiles.
 */

export const CHORE_ICONS = {
  book: { Comp: BookOpen, label: 'Reading' },
  broom: { Comp: Broom, label: 'Sweeping' },
  dust: { Comp: Wind, label: 'Dusting' },
  sparkle: { Comp: Sparkle, label: 'Tidying' },
  trash: { Comp: Trash, label: 'Rubbish' },
  recycle: { Comp: Recycle, label: 'Recycling' },
  dishes: { Comp: ForkKnife, label: 'Dishes' },
  cook: { Comp: CookingPot, label: 'Kitchen' },
  laundry: { Comp: TShirt, label: 'Laundry' },
  bed: { Comp: Bed, label: 'Bedroom' },
  bath: { Comp: Bathtub, label: 'Bathroom' },
  plant: { Comp: Plant, label: 'Plants' },
  leaf: { Comp: Leaf, label: 'Yard' },
  drop: { Comp: Drop, label: 'Watering' },
  dog: { Comp: Dog, label: 'The dog' },
  paw: { Comp: PawPrint, label: 'Pets' },
  car: { Comp: Car, label: 'The car' },
  cart: { Comp: ShoppingCart, label: 'Shopping' },
  homework: { Comp: GraduationCap, label: 'Homework' },
  pencil: { Comp: PencilSimple, label: 'Practice' },
  music: { Comp: MusicNotes, label: 'Music' },
  sport: { Comp: Baseball, label: 'Sport' },
  chore: { Comp: ArrowsClockwise, label: 'Routine' },
  bonus: { Comp: Confetti, label: 'Bonus' },
  stash: { Comp: Sunglasses, label: 'Anything' },
} satisfies Record<string, { Comp: PhosphorIcon; label: string }>

export type ChoreIconKey = keyof typeof CHORE_ICONS

export const CHORE_ICON_KEYS = Object.keys(CHORE_ICONS) as ChoreIconKey[]

export function isChoreIconKey(value: unknown): value is ChoreIconKey {
  return typeof value === 'string' && value in CHORE_ICONS
}

export function ChoreIcon({
  icon,
  size = 24,
  className,
}: {
  icon: string | null
  size?: number
  className?: string
}) {
  const { Comp } = CHORE_ICONS[isChoreIconKey(icon) ? icon : 'chore']
  return <Comp size={size} weight="fill" className={className} />
}

/** The tinted circle a task tile leads with. */
export function ChoreIconBadge({
  icon,
  tone = 'leaf',
  size = 44,
}: {
  icon: string | null
  tone?: 'leaf' | 'gold' | 'muted'
  size?: number
}) {
  const skin = {
    leaf: 'bg-leaf/15 text-leaf-deep',
    gold: 'bg-gold/25 text-chestnut',
    muted: 'bg-cream text-mustache/60',
  }[tone]

  return (
    <span
      className={cx('flex shrink-0 items-center justify-center rounded-full', skin)}
      style={{ width: size, height: size }}
    >
      <ChoreIcon icon={icon} size={Math.round(size * 0.52)} />
    </span>
  )
}
