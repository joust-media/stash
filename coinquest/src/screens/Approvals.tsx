import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ApprovalItem } from '../../shared/types'
import { api } from '../lib/api'
import { useSession } from '../lib/session'
import { MINUS, money } from '../lib/format'
import { Hero } from '../components/Hero'
import { HERO_POSE } from '../components/Mascot'
import { Money, RewardBadge } from '../components/Money'
import {
  Avatar,
  Button,
  Card,
  Chip,
  PARENT_TABS,
  Screen,
  ScreenMessage,
  SmallButton,
  Spinner,
  TabBar,
} from '../components/ui'

/**
 * 09 — The approval queue. Nothing enters a stash without an achievement
 * approval, and nothing leaves one without a withdrawal approval; both land
 * here so a parent has a single place to look.
 */
export function Approvals() {
  const queryClient = useQueryClient()
  const { parent } = useSession()

  const { data, isPending, isError, error } = useQuery({ queryKey: ['approvals'], queryFn: api.approvals })

  const refresh = () => {
    for (const key of [['approvals'], ['family'], ['kidHome'], ['ledger']]) {
      queryClient.invalidateQueries({ queryKey: key })
    }
  }

  const review = useMutation({
    mutationFn: async ({ item, approve }: { item: ApprovalItem; approve: boolean }) => {
      await (approve
        ? api.approve(item.kind, item.id, parent!.id)
        : api.reject(item.kind, item.id, parent!.id))
    },
    onSettled: refresh,
  })

  const approveAll = useMutation({
    mutationFn: () => api.approveAll(parent!.id),
    onSettled: refresh,
  })

  const count = data?.items.length ?? 0
  const achievements = data?.items.filter((i) => i.kind === 'achievement') ?? []

  const summary =
    count === 0
      ? 'All caught up.'
      : [
          data!.payoutCents > 0 && `${money(data!.payoutCents)} to pay out`,
          data!.withdrawalCents > 0 && `${money(data!.withdrawalCents)} to hand over`,
        ]
          .filter(Boolean)
          .join(' · ')

  return (
    <Screen
      hero={
        <Hero
          eyebrow="Parent mode"
          title="Approvals"
          subtitle={count === 0 ? summary : `${count} waiting · ${summary}`}
          pose={HERO_POSE.approvals}
        />
      }
    >
      {isPending && <Spinner />}
      {isError && <ScreenMessage>{(error as Error).message}</ScreenMessage>}

      {data && count === 0 && (
        <ScreenMessage>Approved achievements show up in each kid&rsquo;s history.</ScreenMessage>
      )}

      {data && count > 0 && (
        <div className="scroll-y animate-fade -mx-1 flex flex-1 flex-col gap-3 px-6 pt-4 pb-4 [&>*]:shrink-0">
          {data.items.map((item) => {
            const isWithdrawal = item.kind === 'withdrawal'
            return (
              <Card key={`${item.kind}-${item.id}`} className="flex flex-col gap-3.5 p-4">
                <div className="flex items-center gap-3">
                  <Avatar initial={item.kid.initial} color={item.kid.avatarColor} size={42} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="display text-chestnut truncate text-[18px] leading-tight font-bold">
                      {item.title}
                    </span>
                    <span className="text-mustache/70 truncate text-[13px] leading-tight">
                      {item.kid.name} · {item.timeLabel}
                    </span>
                  </div>
                  {isWithdrawal ? (
                    <Money cents={item.amountCents} size={24} tone="spend" sign={MINUS} />
                  ) : (
                    <RewardBadge cents={item.amountCents} size={21} />
                  )}
                </div>

                {isWithdrawal && (
                  <div className="flex items-center gap-2">
                    <Chip tone="caution">Money leaving</Chip>
                    {item.note && <span className="text-mustache/70 text-[13px]">{item.note}</span>}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <SmallButton
                    disabled={review.isPending}
                    onClick={() => review.mutate({ item, approve: true })}
                  >
                    {isWithdrawal ? 'Handed over' : 'Approve'}
                  </SmallButton>
                  <SmallButton
                    variant="quiet"
                    disabled={review.isPending}
                    onClick={() => review.mutate({ item, approve: false })}
                  >
                    {isWithdrawal ? 'Not now' : 'Send back'}
                  </SmallButton>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {data && achievements.length > 0 && (
        <div className="shrink-0 px-6 pb-3">
          {/*
            Bulk approve covers achievements only — handing over cash is a
            physical act per request, so withdrawals are never cleared in bulk.
          */}
          <Button variant="reward" disabled={approveAll.isPending} onClick={() => approveAll.mutate()}>
            Approve {achievements.length} · pay {money(data.payoutCents)}
          </Button>
        </div>
      )}

      <TabBar tabs={PARENT_TABS} />
    </Screen>
  )
}
