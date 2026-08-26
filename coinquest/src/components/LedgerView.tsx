import type { Ledger, TxType } from '../../shared/types'
import { MINUS, amountTone, money } from '../lib/format'
import { Money, RewardBadge } from './Money'
import { ChoiceChip, Eyebrow, IconCircle, InsetPanel, ScreenMessage } from './ui'

export const LEDGER_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'earned', label: 'Earned' },
  { key: 'deposits', label: 'Added' },
  { key: 'withdrawn', label: 'Spent' },
] as const

export type LedgerFilter = (typeof LEDGER_FILTERS)[number]['key']

const GLYPH: Record<TxType, { glyph: string; tone: 'reward' | 'leaf' | 'coral' }> = {
  earn: { glyph: '✓', tone: 'reward' },
  deposit: { glyph: '↓', tone: 'leaf' },
  withdraw: { glyph: '↑', tone: 'coral' },
}

export function LedgerFilters({
  value,
  onChange,
}: {
  value: LedgerFilter
  onChange: (next: LedgerFilter) => void
}) {
  return (
    <div className="scroll-y flex gap-2 overflow-x-auto">
      {LEDGER_FILTERS.map((f) => (
        <ChoiceChip key={f.key} selected={value === f.key} onClick={() => onChange(f.key)}>
          {f.label}
        </ChoiceChip>
      ))}
    </div>
  )
}

export function LedgerView({ ledger }: { ledger: Ledger }) {
  if (ledger.groups.length === 0) {
    return <ScreenMessage>Nothing here yet.</ScreenMessage>
  }

  return (
    <div className="scroll-y animate-fade -mx-1 flex flex-1 flex-col gap-5 px-6 pt-1 pb-5">
      {ledger.groups.map((group) => (
        <section key={group.label} className="flex shrink-0 flex-col gap-2.5">
          <Eyebrow>{group.label}</Eyebrow>
          {group.entries.map((entry) => (
            <div
              key={entry.id}
              className="bg-surface rounded-card flex shrink-0 items-center gap-3.5 px-4 py-3.5 shadow-[var(--shadow-card)]"
            >
              <IconCircle glyph={GLYPH[entry.type].glyph} tone={GLYPH[entry.type].tone} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="display text-chestnut truncate text-[18px] leading-tight font-bold">
                  {entry.title}
                </span>
                <span className="text-mustache/65 truncate text-[13px] leading-tight">{entry.meta}</span>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {entry.type === 'earn' ? (
                  <RewardBadge cents={entry.amountCents} size={20} />
                ) : (
                  <Money
                    cents={entry.amountCents}
                    size={23}
                    tone={amountTone(entry.type)}
                    sign={entry.amountCents < 0 ? MINUS : '+'}
                  />
                )}
                <span className="text-mustache/55 text-[12px] font-bold">
                  {money(entry.balanceAfterCents)}
                </span>
              </div>
            </div>
          ))}
        </section>
      ))}

      <section className="flex shrink-0 flex-col gap-2.5">
        <Eyebrow>This week</Eyebrow>
        <InsetPanel className="flex items-center justify-between px-4 py-3.5">
          <p className="text-mustache text-[14px]">
            Earned <span className="text-chestnut font-extrabold">{money(ledger.weekly.earnedCents)}</span> ·
            Spent <span className="text-coral font-extrabold">{money(ledger.weekly.spentCents)}</span>
          </p>
          {ledger.weekly.savedPct !== null && (
            <p className="text-leaf-deep text-[14px] font-extrabold">Saved {ledger.weekly.savedPct}%</p>
          )}
        </InsetPanel>
      </section>
    </div>
  )
}
