import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { LedgerFilters, LedgerView, type LedgerFilter } from '../components/LedgerView'
import { KID_TABS, Screen, ScreenMessage, Spinner, TabBar } from '../components/ui'
import { Hero } from '../components/Hero'
import { HERO_POSE } from '../components/Mascot'

/** 06 — History: every dollar in and out, with the running stash. */
export function History() {
  const kidId = Number(useParams().kidId)
  const [filter, setFilter] = useState<LedgerFilter>('all')

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['ledger', kidId, filter],
    queryFn: () => api.ledger(kidId, filter),
  })
  // Only for the band colour — usually already cached from Home.
  const home = useQuery({ queryKey: ['kidHome', kidId], queryFn: () => api.kidHome(kidId) })

  return (
    <Screen
      tint={home.data?.kid.avatarColor}
      hero={
        <Hero
          eyebrow="Every dollar"
          title="History"
          subtitle="In, out, and what's left."
          pose={HERO_POSE.history}
        />
      }
    >
      <div className="flex shrink-0 px-6 pt-4 pb-1">
        <LedgerFilters value={filter} onChange={setFilter} />
      </div>

      {isPending && <Spinner />}
      {isError && <ScreenMessage>{(error as Error).message}</ScreenMessage>}
      {data && <LedgerView ledger={data} />}

      <TabBar tabs={KID_TABS(kidId)} />
    </Screen>
  )
}
