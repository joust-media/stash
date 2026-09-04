import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ApprovalItem } from '../../shared/types'
import { api } from '../lib/api'
import { useSession } from '../lib/session'
import { MINUS, money } from '../lib/format'
import { Hero } from '../components/Hero'
import { HERO_POSE } from '../components/Mascot'
import { Mascot } from '../components/Mascot'
import { Money, RewardBadge } from '../components/Money'
import {
  Avatar,
  Button,
  Card,
  Chip,
  cx,
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
  const [viewing, setViewing] = useState<ApprovalItem | null>(null)
  // A just-confirmed hand-over: a short-lived "their number is right now" beat.
  const [confirmed, setConfirmed] = useState<{ kidName: string; cents: number } | null>(null)

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
    onSuccess: (_data, { item, approve }) => {
      if (approve && item.kind === 'deposit') {
        setConfirmed({ kidName: item.kid.name, cents: item.amountCents })
        setTimeout(() => setConfirmed(null), 3500)
      }
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

      {/* Outlives the card it came from, so it still shows as the queue clears. */}
      {confirmed && (
        <div className="animate-fade-up bg-leaf/12 rounded-inset mx-6 mt-4 shrink-0 px-4 py-3">
          <span className="text-leaf-deep text-[14px] leading-snug font-bold">
            Added to {confirmed.kidName}&rsquo;s stash &mdash; their number is right now.
          </span>
        </div>
      )}

      {data && count === 0 && (
        <ScreenMessage>Approved achievements show up in each kid&rsquo;s history.</ScreenMessage>
      )}

      {data && count > 0 && (
        <div className="scroll-y animate-fade -mx-1 flex flex-1 flex-col gap-3 px-6 pt-4 pb-4 [&>*]:shrink-0">
          {/* Stash has been by: the kids sent him to nudge. Twice a day, max. */}
          {data.reminders.length > 0 && (
            <div className="bg-gold/20 rounded-card flex items-center gap-3 px-4 py-3">
              <Mascot pose="coin-toss-alt" height={64} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="display text-chestnut text-[15px] leading-tight font-bold">
                  Stash stopped by
                </span>
                {data.reminders.slice(0, 3).map((r, i) => (
                  <span key={i} className="text-mustache text-[13px] leading-snug">
                    {r.kidName}&rsquo;s waiting on you · {r.timeLabel}
                  </span>
                ))}
              </div>
            </div>
          )}

          {data.items.map((item) => {
            const isWithdrawal = item.kind === 'withdrawal'
            const isDeposit = item.kind === 'deposit'
            return (
              <Card
                key={`${item.kind}-${item.id}`}
                className={cx('flex flex-col gap-3.5 p-4', isDeposit && 'border-leaf border-2')}
              >
                {/*
                  A kid handed over physical money and is trusting it to appear
                  here. That is not a whenever item — it is pinned on top and
                  it says so.
                */}
                {isDeposit && (
                  <div className="bg-leaf/12 rounded-inset flex flex-col gap-0.5 px-4 py-3">
                    <span className="display text-leaf-deep text-[15px] leading-snug font-extrabold">
                      {item.kid.name} handed you {money(item.amountCents)} in cash
                    </span>
                    <span className="text-mustache text-[13px] leading-snug">
                      {item.note ? `"${item.note}" — it` : 'It'}&rsquo;s in your hand, not their stash
                      yet. Confirm it now so their number is right.
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  {/* Proof photo, when the achievement asked for one. */}
                  {item.proofThumbUrl ? (
                    <button
                      type="button"
                      aria-label="See the photo"
                      onClick={() => setViewing(item)}
                      className="pressable shrink-0"
                    >
                      <img
                        src={item.proofThumbUrl}
                        alt=""
                        className="h-14 w-14 rounded-xl object-cover shadow-[var(--shadow-card)]"
                      />
                    </button>
                  ) : (
                    <Avatar initial={item.kid.initial} color={item.kid.avatarColor} size={42} />
                  )}
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
                  ) : isDeposit ? (
                    <Money cents={item.amountCents} size={24} tone="leaf" sign="+" />
                  ) : (
                    <RewardBadge cents={item.amountCents} size={21} />
                  )}
                </div>

                {/*
                  A Good Stuff claim says what each side is putting in, because
                  the parent is agreeing to their share as well as to the payout.
                */}
                {isWithdrawal && item.matchAmountCents ? (
                  <div className="bg-gold/15 rounded-inset flex flex-col gap-1 px-4 py-3">
                    <span className="display text-chestnut text-[15px] leading-snug font-bold">
                      {item.kid.name}&rsquo;s ready for the {item.title.toLowerCase()}.
                    </span>
                    <span className="text-mustache text-[13px] leading-snug">
                      {item.kid.name} saved {money(Math.abs(item.amountCents))}. Your share is{' '}
                      {money(item.matchAmountCents)}. Confirm once you&rsquo;ve sorted it out together.
                    </span>
                  </div>
                ) : (
                  isWithdrawal && (
                    <div className="flex items-center gap-2">
                      <Chip tone="caution">Money leaving</Chip>
                      {item.note && <span className="text-mustache/70 text-[13px]">{item.note}</span>}
                    </div>
                  )
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <SmallButton
                    disabled={review.isPending}
                    onClick={() => review.mutate({ item, approve: true })}
                  >
                    {isWithdrawal ? 'Handed over' : isDeposit ? 'Got it — add it' : 'Approve'}
                  </SmallButton>
                  <SmallButton
                    variant="quiet"
                    disabled={review.isPending}
                    onClick={() => review.mutate({ item, approve: false })}
                  >
                    {isWithdrawal || isDeposit ? 'Not now' : 'Send back'}
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

      {/* Full-screen proof viewer: the photo, who, what, how much, when. */}
      {viewing && (
        <div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/85 px-6 py-10"
          role="dialog"
          aria-modal
          onClick={() => setViewing(null)}
        >
          <img
            src={viewing.proofUrl ?? undefined}
            alt={`Photo for ${viewing.title}`}
            className="max-h-[60%] w-full rounded-2xl object-contain"
          />
          <div className="flex flex-col items-center gap-1 text-center">
            <span className="display text-[20px] font-extrabold text-white">{viewing.title}</span>
            <span className="text-[14px] text-white/80">
              {viewing.kid.name} · {money(viewing.amountCents)} · {viewing.timeLabel}
            </span>
          </div>
          <SmallButton variant="quiet" className="border-white/40 text-white" onClick={() => setViewing(null)}>
            Close
          </SmallButton>
        </div>
      )}

      <TabBar tabs={PARENT_TABS} />
    </Screen>
  )
}
