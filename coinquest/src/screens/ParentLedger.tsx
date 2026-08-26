import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { LedgerFilters, LedgerView, type LedgerFilter } from '../components/LedgerView'
import { ChoiceChip, PARENT_TABS, Screen, ScreenMessage, Spinner, TabBar } from '../components/ui'
import { Hero } from '../components/Hero'
import { HERO_POSE } from '../components/Mascot'

/**
 * The parent Ledger tab. The board draws only the kid's version (screen 06),
 * so this puts a kid selector above the same ledger.
 */
export function ParentLedger() {
  const [kidId, setKidId] = useState<number | null>(null)
  const [filter, setFilter] = useState<LedgerFilter>('all')

  const family = useQuery({ queryKey: ['family'], queryFn: api.family })
  const activeKidId = kidId ?? family.data?.kids[0]?.id ?? null

  const ledger = useQuery({
    queryKey: ['ledger', activeKidId, filter],
    queryFn: () => api.ledger(activeKidId!, filter),
    enabled: activeKidId !== null,
  })

  return (
    <Screen
      hero={
        <Hero
          eyebrow="Parent mode"
          title="Ledger"
          subtitle="Every movement, per kid."
          pose={HERO_POSE.ledger}
        />
      }
    >
      <div className="flex shrink-0 flex-col gap-3 px-6 pt-4">
        <div className="flex gap-2 overflow-x-auto">
          {family.data?.kids.map((kid) => (
            <ChoiceChip key={kid.id} selected={activeKidId === kid.id} onClick={() => setKidId(kid.id)}>
              {kid.name}
            </ChoiceChip>
          ))}
        </div>
        <LedgerFilters value={filter} onChange={setFilter} />
      </div>

      {ledger.isPending && <Spinner />}
      {ledger.isError && <ScreenMessage>{(ledger.error as Error).message}</ScreenMessage>}
      {ledger.data && <LedgerView ledger={ledger.data} />}

      <TabBar tabs={PARENT_TABS} />
    </Screen>
  )
}
