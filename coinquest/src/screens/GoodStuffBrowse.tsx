import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import type { SuggestedItem } from '../../shared/types'
import { api } from '../lib/api'
import { useSession } from '../lib/session'
import { AdoptPanel, GoodStuffCard } from '../components/GoodStuff'
import { Hero } from '../components/Hero'
import { KID_TABS, Screen, ScreenMessage, Spinner, TabBar } from '../components/ui'

/*
 * The Good Stuff, full screen — everything the parents have put up, browsable.
 * Deliberately not called a shop, because it is not one: no merchants, no
 * catalogue, no prices to haggle. A parent typed a list of things they would be
 * glad to go halves on, and this is the kid reading it.
 */
export function GoodStuffBrowse() {
  const kidId = Number(useParams().kidId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { parent } = useSession()
  const [picking, setPicking] = useState<SuggestedItem | null>(null)

  const actorId = parent?.id ?? kidId
  const home = useQuery({ queryKey: ['kidHome', kidId], queryFn: () => api.kidHome(kidId) })
  const active = home.data?.goals.find((g) => g.active) ?? null

  const adopt = useMutation({
    mutationFn: (item: SuggestedItem) =>
      api.adoptSuggestion(item.id, { actorId, kidId, makeActive: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kidHome', kidId] })
      navigate(`/kid/${kidId}/goals`)
    },
  })

  const items = home.data?.suggestions ?? []

  return (
    <Screen
      hero={
        <Hero
          eyebrow="From your parents"
          title="The Good Stuff"
          subtitle="Things they'd go halves on. Pick one and it becomes your goal."
          pose={HERO}
          back={`/kid/${kidId}/goals`}
        />
      }
    >
      {home.isPending && <Spinner />}
      {home.isError && <ScreenMessage>{(home.error as Error).message}</ScreenMessage>}

      {home.data && (
        <div className="scroll-y animate-fade -mx-1 flex flex-1 flex-col gap-4 px-6 pt-5 pb-4 [&>*]:shrink-0">
          {picking ? (
            <AdoptPanel
              item={picking}
              hasActiveGoal={active !== null}
              activeTitle={active?.title ?? null}
              busy={adopt.isPending}
              error={adopt.error ? (adopt.error as Error).message : null}
              onConfirm={() => adopt.mutate(picking)}
              onCancel={() => setPicking(null)}
            />
          ) : items.length === 0 ? (
            <ScreenMessage>
              Nothing here yet — ask a parent what they&rsquo;d go halves on.
            </ScreenMessage>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {items.map((item) => (
                <GoodStuffCard key={item.id} item={item} onPick={setPicking} wide />
              ))}
            </div>
          )}
        </div>
      )}

      <TabBar tabs={KID_TABS(kidId)} />
    </Screen>
  )
}

const HERO = 'acorn-hug' as const
