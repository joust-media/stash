import type { SuggestedItem } from '../../shared/types'
import { matchLabel } from '../../shared/money'
import { money } from '../lib/format'
import { ChoreIconBadge } from './ChoreIcon'
import { Money } from './Money'
import { Eyebrow, SmallButton, cx } from './ui'

/*
 * The Good Stuff — things a parent would like the kid to have, each with a
 * share the parent covers.
 *
 * Two rules run through every pixel here:
 *
 * 1. It says "match", never "discount". A $40 microscope at 50% is not $20 off;
 *    it is $20 the kid pays and $20 the parent pays. There is no strikethrough
 *    price anywhere in this file — that is retail grammar, and it teaches that
 *    prices are soft. A match teaches how matching actually works.
 *
 * 2. It is not a store. No merchants, no feeds, no brands, no scarcity, no
 *    countdowns, and the word "shop" appears nowhere.
 */

/**
 * The one defensible use of gold outside a win: this badge marks money the kid
 * did not have to earn, which genuinely is one. Gold as a fill with Mustache
 * Brown text — gold type fails contrast on both cream and green.
 */
export function MatchBadge({ payer, matchPercent }: { payer: string; matchPercent: number }) {
  if (matchPercent <= 0) return null
  return (
    <span className="bg-gold text-mustache inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-[0.04em] uppercase">
      {matchLabel(payer, matchPercent)}
    </span>
  )
}

/** "Dad pays the other $20." The whole feature, said once, in plain words. */
export function MatchLine({
  payer,
  matchAmountCents,
  className,
}: {
  payer: string
  matchAmountCents: number
  className?: string
}) {
  if (matchAmountCents <= 0) return null
  return (
    <span className={cx('text-mustache/65 text-[13px] leading-tight', className)}>
      {payer} pays the other {money(matchAmountCents)}.
    </span>
  )
}

export function GoodStuffCard({
  item,
  onPick,
  busy,
}: {
  item: SuggestedItem
  onPick: (item: SuggestedItem) => void
  busy?: boolean
}) {
  const adopted = item.adoptedGoalId !== null

  return (
    <div
      className={cx(
        'rounded-card bg-surface flex w-[188px] shrink-0 flex-col gap-2.5 p-4 shadow-[var(--shadow-card)]',
        busy && 'opacity-50',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <ChoreIconBadge icon={item.icon} tone={adopted ? 'muted' : 'leaf'} size={42} />
        <MatchBadge payer={item.addedByName} matchPercent={item.matchPercent} />
      </div>

      <span className="display text-chestnut line-clamp-2 text-[17px] leading-tight font-bold">
        {item.name}
      </span>

      {/*
        The kid's share is the headline number, because it is the number they
        act on. The full price is never shown struck through.
      */}
      <Money cents={item.kidShareCents} size={26} tone="leaf" />
      <MatchLine payer={item.addedByName} matchAmountCents={item.matchAmountCents} />

      <div className="mt-auto pt-1">
        {adopted ? (
          <span className="text-leaf-deep text-[13px] font-bold">You&rsquo;re saving for this</span>
        ) : (
          <SmallButton disabled={busy} onClick={() => onPick(item)}>
            Make this my goal
          </SmallButton>
        )}
      </div>
    </div>
  )
}

/**
 * The row itself, under the kid's own goals — never above them. The kid decides
 * what they are saving for; this sits beneath as an offer, not a directive.
 */
export function GoodStuffRow({
  items,
  onPick,
  busyId,
}: {
  items: SuggestedItem[]
  onPick: (item: SuggestedItem) => void
  busyId?: number | null
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <Eyebrow>The good stuff</Eyebrow>

      {items.length === 0 ? (
        <p className="border-line-cream text-mustache/70 rounded-card border-2 border-dashed px-4 py-6 text-center text-[14px]">
          Nothing here yet — ask a parent what they&rsquo;d go halves on.
        </p>
      ) : (
        <div className="scroll-y -mx-6 flex gap-3 overflow-x-auto px-6 pb-1 [&>*]:shrink-0">
          {items.map((item) => (
            <GoodStuffCard key={item.id} item={item} onPick={onPick} busy={busyId === item.id} />
          ))}
        </div>
      )}
    </section>
  )
}
