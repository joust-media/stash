import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { money } from '../lib/format'
import { Hero } from '../components/Hero'
import { HERO_POSE } from '../components/Mascot'
import { Money } from '../components/Money'
import {
  Avatar,
  Button,
  Eyebrow,
  KID_TABS,
  ProgressBar,
  Screen,
  ScreenMessage,
  SmallButton,
  Spinner,
  TabBar,
  cx,
} from '../components/ui'
import type { EarningsWindow, LedgerEntry } from '../../shared/types'

/*
 * 02 — Home, the overview. It answers "how am I doing?" — who you are, what
 * you have, what you've been earning, what's waiting. It never answers "what
 * should I do next?": that question belongs to EARN, which is why there are no
 * task tiles, no Start/End, and exactly one CTA on this screen, and it leaves.
 */
export function KidHome() {
  const kidId = Number(useParams().kidId)
  const navigate = useNavigate()
  const [window_, setWindow] = useState<'seven' | 'thirty'>('thirty')

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['kidHome', kidId],
    queryFn: () => api.kidHome(kidId),
  })
  const earnings = useQuery({ queryKey: ['earnings', kidId], queryFn: () => api.earnings(kidId) })
  const ledger = useQuery({ queryKey: ['ledger', kidId, 'all'], queryFn: () => api.ledger(kidId, 'all') })

  const doing = data?.tasks.filter((t) => t.status === 'in_progress') ?? []
  const pendingIn = data?.requests.filter((r) => r.amountCents > 0) ?? []
  const recent: LedgerEntry[] = ledger.data?.groups.flatMap((g) => g.entries).slice(0, 5) ?? []
  const win = earnings.data?.[window_]

  return (
    <Screen
      tint={data?.kid.avatarColor}
      hero={
        <Hero
          eyebrow={greeting(data?.dailyGoal.done ?? 0, data?.kid.nickname || data?.kid.name)}
          title=""
          amountCents={data?.balanceCents ?? 0}
          amountLabel="Your stash"
          amountSize={56}
          subtitle={
            doing.length > 0
              ? `In progress: ${doing.map((t) => t.title).join(' · ')}`
              : undefined
          }
          pose={data?.kid.mascotPose ?? HERO_POSE.kidHome}
          action={
            data && (
              <button
                type="button"
                aria-label="Edit profile"
                onClick={() => navigate(`/profile/${kidId}`)}
                className="pressable rounded-full"
              >
                <Avatar
                  initial={data.kid.initial}
                  color={data.kid.avatarColor}
                  image={data.kid.avatarUrl}
                  size={40}
                />
              </button>
            )
          }
        />
      }
    >
      {isPending && <Spinner />}
      {isError && <ScreenMessage>{(error as Error).message}</ScreenMessage>}

      {data && (
        <div className="scroll-y animate-fade -mx-1 flex flex-1 flex-col gap-5 px-6 pt-5 pb-4 [&>*]:shrink-0">
          {/*
            Only when something is pending — and deliberately not a button.
            Chasing approvals is not this screen's job.
          */}
          {pendingIn.length > 0 && (
            <div className="bg-surface rounded-inset flex items-center justify-between px-4 py-3 shadow-[var(--shadow-card)]">
              <span className="text-mustache text-[14px] font-bold">Waiting on a parent</span>
              <span className="text-mustache/70 text-[13px]">
                {pendingIn.length} achievement{pendingIn.length === 1 ? '' : 's'} ·{' '}
                {money(pendingIn.reduce((s, r) => s + r.amountCents, 0))}
              </span>
            </div>
          )}

          <EarningsBlock
            win={win}
            window={window_}
            onWindow={setWindow}
            loading={earnings.isPending}
          />

          {data.goal && (
            <button
              type="button"
              onClick={() => navigate(`/kid/${kidId}/goals`)}
              className="pressable bg-surface rounded-card flex items-center gap-3 p-4 text-left shadow-[var(--shadow-card)]"
            >
              {data.goal.image ? (
                <img
                  src={data.goal.image}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-xl object-cover"
                />
              ) : null}
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="display text-chestnut truncate text-[16px] leading-tight font-bold">
                    {data.goal.title}
                  </span>
                  <span className="text-mustache/70 shrink-0 text-[12px] font-bold">
                    {money(data.goal.remainingCents)} to go
                  </span>
                </span>
                <ProgressBar pct={data.goal.progressPct} />
                {/* The "only" voice is earned at 80%; below that the bar speaks alone. */}
                {data.goal.progressPct >= 80 && data.goal.progressPct < 100 && (
                  <span className="text-leaf-deep text-[12px] font-bold">
                    Only {money(data.goal.remainingCents)} to go!
                  </span>
                )}
              </span>
            </button>
          )}

          {recent.length > 0 && (
            <section className="flex flex-col gap-2.5">
              <Eyebrow>Recent activity</Eyebrow>
              <div className="bg-surface rounded-card flex flex-col shadow-[var(--shadow-card)]">
                {recent.map((entry, i) => (
                  <div
                    key={entry.id}
                    className={cx(
                      'flex items-center gap-3 px-4 py-3',
                      i > 0 && 'border-line-cream border-t',
                    )}
                  >
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-chestnut truncate text-[14px] leading-tight font-bold">
                        {entry.title}
                      </span>
                      <span className="text-mustache/60 text-[11px] leading-tight">
                        {money(entry.balanceAfterCents)} after
                      </span>
                    </div>
                    <Money
                      cents={entry.amountCents}
                      size={17}
                      tone={entry.amountCents < 0 ? 'spend' : 'leaf'}
                      sign={entry.amountCents < 0 ? '−' : '+'}
                    />
                  </div>
                ))}
              </div>
              <SmallButton variant="quiet" onClick={() => navigate(`/kid/${kidId}/history`)}>
                See every dollar
              </SmallButton>
            </section>
          )}

          {/* The screen's one pill, and it points at the doing. */}
          <Button onClick={() => navigate(`/kid/${kidId}/tasks`)}>Find something to do</Button>
        </div>
      )}

      <TabBar tabs={KID_TABS(kidId)} />
    </Screen>
  )
}

/* ------------------------------------------------------------- earnings --- */

function EarningsBlock({
  win,
  window,
  onWindow,
  loading,
}: {
  win: EarningsWindow | undefined
  window: 'seven' | 'thirty'
  onWindow: (w: 'seven' | 'thirty') => void
  loading: boolean
}) {
  const label = window === 'seven' ? 'Earned in the last 7 days' : 'Earned in the last 30 days'
  const max = Math.max(1, ...(win?.buckets.map((b) => b.cents) ?? [1]))
  const gain = win && win.prevTotalCents !== null && win.totalCents > win.prevTotalCents
    ? win.totalCents - win.prevTotalCents
    : null

  return (
    <section className="bg-surface rounded-card flex flex-col gap-3 p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between">
        <Eyebrow>{label}</Eyebrow>
        <div className="bg-cream flex rounded-full p-0.5">
          {(['seven', 'thirty'] as const).map((w) => (
            <button
              key={w}
              type="button"
              aria-pressed={window === w}
              onClick={() => onWindow(w)}
              className={cx(
                'rounded-full px-3 py-1 text-[11px] font-bold tracking-[0.08em] uppercase transition-colors',
                window === w ? 'bg-leaf text-white' : 'text-mustache/60',
              )}
            >
              {w === 'seven' ? '7 days' : '30 days'}
            </button>
          ))}
        </div>
      </div>

      {loading && <Spinner />}

      {win && win.totalCents === 0 && (
        <p className="text-mustache/70 py-3 text-center text-[14px]">
          Nothing yet this {window === 'seven' ? 'week' : 'month'} — your stash is waiting.
        </p>
      )}

      {win && win.totalCents > 0 && (
        <>
          <Money cents={win.totalCents} size={34} tone="leaf" sign="+" />

          {/* Read-only decoration that happens to be true: no axes, no tooltips. */}
          <div className="flex items-end gap-1.5" aria-hidden>
            {win.buckets.map((b, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-16 w-full items-end">
                  <div
                    className="bg-leaf w-full rounded-t-md"
                    style={{ height: `${Math.max(b.cents > 0 ? 10 : 3, (b.cents / max) * 100)}%` }}
                  />
                </div>
                <span className="text-mustache/45 text-[9px] font-bold">{b.label}</span>
              </div>
            ))}
          </div>

          {/* Comparison only when it's genuinely good news. Never "+0%". */}
          {gain !== null && gain > 0 && (
            <p className="text-mustache/70 text-[13px]">
              {money(gain)} more than the {window === 'seven' ? 'week' : 'month'} before.
            </p>
          )}
        </>
      )}
    </section>
  )
}

function greeting(doneToday: number, name?: string): string {
  if (!name) return 'Hi'
  return doneToday > 0 ? `Nice work, ${name}!` : `Hi, ${name}`
}
