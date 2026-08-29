import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { money } from '../lib/format'
import { ChoreIconBadge } from '../components/ChoreIcon'
import { useCancelTask, useEndTask } from '../components/TaskList'
import { OutstandingRequests, TaskGrid, TaskTile } from '../components/TaskTile'
import { Hero } from '../components/Hero'
import { HERO_POSE, Mascot } from '../components/Mascot'
import { Money } from '../components/Money'
import { Avatar, Eyebrow, KID_TABS, Screen, ScreenMessage, Spinner, TabBar, cx } from '../components/ui'
import type { Milestone, TaskRow } from '../../shared/types'

/*
 * 02 — Kid home, the immersive one. The whole page is Leaf Green: the hero
 * melts into it, the work floats on white tiles, and the page reads as one
 * place rather than a header with a list under it. Every other screen stays
 * cream and list-like on purpose — home is where Stash lives.
 */

type Filter = 'all' | 'todo' | 'doing' | 'waiting'

export function KidHome() {
  const kidId = Number(useParams().kidId)
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('all')
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['kidHome', kidId],
    queryFn: () => api.kidHome(kidId),
  })
  const end = useEndTask(kidId)
  const cancel = useCancelTask(kidId)

  const open = data?.tasks.filter((t) => t.status === null) ?? []
  const doing = data?.tasks.filter((t) => t.status === 'in_progress') ?? []
  const waiting = data?.tasks.filter((t) => t.status === 'pending' || t.status === 'approved') ?? []

  // A named goal is what the kid actually cares about; fall back to the ladder.
  const milestone: Milestone | undefined = data
    ? data.goal
      ? {
          label: data.goal.title,
          detail: `${money(data.balanceCents)} of ${money(data.goal.targetCents)}`,
          current: data.balanceCents,
          target: data.goal.targetCents,
          pct: data.goal.progressPct,
          unit: 'cents',
          complete: data.goal.progressPct >= 100,
          nudge:
            data.goal.progressPct >= 80 && data.goal.progressPct < 100
              ? `Only ${money(data.goal.targetCents - data.balanceCents)} to go!`
              : null,
        }
      : data.savings
    : undefined

  const tile = (task: TaskRow) => (
    <TaskTile
      key={task.choreId}
      task={task}
      onClick={(t) => navigate(`/kid/${kidId}/task/${t.choreId}`)}
      onEnd={end.mutate}
      onCancel={cancel.mutate}
      busy={end.isPending && end.variables?.choreId === task.choreId}
    />
  )

  return (
    <Screen
      tone="green"
      tint={data?.kid.avatarColor}
      hero={
        <Hero
          seamless
          eyebrow={greeting()}
          title={data ? `Hi, ${data.kid.nickname || data.kid.name}` : 'Hi'}
          pose={data?.kid.mascotPose ?? HERO_POSE.kidHome}
          milestone={milestone}
          onMilestoneClick={() => navigate(`/kid/${kidId}/goals`)}
          action={
            data && (
              <button
                type="button"
                aria-label="Edit profile"
                onClick={() => navigate(`/profile/${kidId}`)}
                className="pressable rounded-full"
              >
                <Avatar initial={data.kid.initial} color={data.kid.avatarColor} size={40} />
              </button>
            )
          }
        >
          {data && <Money cents={data.balanceCents} size={40} tone="onGreen" className="pt-0.5" />}
        </Hero>
      }
    >
      {isPending && <Spinner onGreen />}
      {isError && <ScreenMessage onGreen>{(error as Error).message}</ScreenMessage>}

      {data && (
        <div className="scroll-y animate-fade -mx-1 flex flex-1 flex-col gap-5 px-6 pt-4 pb-5 [&>*]:shrink-0">
          {/* In progress · To do · Waiting, right under the header. */}
          <div className="flex gap-2">
            <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
              All
            </FilterChip>
            <FilterChip active={filter === 'todo'} onClick={() => setFilter('todo')}>
              To do{open.length > 0 && ` · ${open.length}`}
            </FilterChip>
            <FilterChip active={filter === 'doing'} onClick={() => setFilter('doing')}>
              In progress{doing.length > 0 && ` · ${doing.length}`}
            </FilterChip>
            <FilterChip active={filter === 'waiting'} onClick={() => setFilter('waiting')}>
              Waiting
            </FilterChip>
          </div>

          <DailyThree done={data.dailyGoal.done} target={data.dailyGoal.target} />

          {milestone?.nudge && (
            <div className="bg-gold rounded-card text-mustache px-4 py-3 text-center text-[15px] font-bold">
              {milestone.nudge}
            </div>
          )}

          {/*
            Nothing to save for, but a parent has put something up — point at it
            rather than showing the generic "no goals yet" line.
          */}
          {!data.goal && data.suggestions.some((s) => s.adoptedGoalId === null) && (
            <button
              type="button"
              onClick={() => navigate(`/kid/${kidId}/stuff`)}
              className="pressable bg-surface rounded-card flex items-center gap-3 px-4 py-3.5 text-left shadow-[var(--shadow-card)]"
            >
              <ChoreIconBadge icon="sparkle" tone="gold" size={38} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="display text-chestnut text-[16px] leading-tight font-bold">
                  {data.approverName} put something up
                </span>
                <span className="text-mustache/65 text-[13px] leading-tight">
                  Things they&rsquo;d go halves on — pick one to save for.
                </span>
              </span>
            </button>
          )}

          {doing.length > 0 && (filter === 'all' || filter === 'doing') && (
            <section className="flex flex-col gap-2.5">
              <Eyebrow onGreen>In progress</Eyebrow>
              <TaskGrid>{doing.map(tile)}</TaskGrid>
            </section>
          )}

          {(filter === 'all' || filter === 'todo') && (
            <section className="flex flex-col gap-2.5">
              <div className="flex items-baseline justify-between">
                <Eyebrow onGreen>Things to do</Eyebrow>
                <span className="text-[13px] font-bold text-white/85">
                  {open.length > 0 ? `${open.length} to go · ${money(data.remainingCents)}` : 'All done!'}
                </span>
              </div>
              <TaskGrid>{(filter === 'todo' ? open : [...open, ...waiting]).map(tile)}</TaskGrid>
              {open.length === 0 && waiting.length === 0 && (
                <div className="rounded-card border-2 border-dashed border-white/40 px-4 py-8 text-center text-[15px] text-white/85">
                  Nothing on the list right now.
                </div>
              )}
            </section>
          )}

          {filter === 'waiting' && (
            <section className="flex flex-col gap-2.5">
              <Eyebrow onGreen>Finished, waiting on a parent</Eyebrow>
              {waiting.length > 0 ? (
                <TaskGrid>{waiting.map(tile)}</TaskGrid>
              ) : (
                <div className="rounded-card border-2 border-dashed border-white/40 px-4 py-8 text-center text-[15px] text-white/85">
                  Nothing waiting — everything&rsquo;s been looked at.
                </div>
              )}
            </section>
          )}

          {/* Money waiting on a parent lives at the bottom, with the nudge. */}
          <OutstandingRequests requests={data.requests} onGreen />
          {data.requests.length > 0 && (
            <ReminderCard
              kidId={kidId}
              approverName={data.approverName}
              remaining={data.remindersLeftToday}
            />
          )}
        </div>
      )}

      <TabBar tabs={KID_TABS(kidId)} />
    </Screen>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'pressable rounded-full px-3.5 py-2 text-[13px] font-bold whitespace-nowrap transition-colors',
        active ? 'text-leaf-deep bg-white' : 'bg-white/15 text-white hover:bg-white/25',
      )}
    >
      {children}
    </button>
  )
}

/**
 * Three a day keeps the stash growing. A rhythm, not a rule — the dots fill
 * gold as tasks land, and nothing is withheld for missing it.
 */
function DailyThree({ done, target }: { done: number; target: number }) {
  const hit = done >= target
  return (
    <div className="rounded-card flex items-center gap-3 bg-white/12 px-4 py-3">
      <div className="flex gap-1.5">
        {Array.from({ length: target }, (_, i) => (
          <span
            key={i}
            className={cx(
              'h-3.5 w-3.5 rounded-full transition-colors',
              i < done ? 'bg-gold' : 'bg-white/25',
            )}
          />
        ))}
      </div>
      <span className={cx('text-[14px] leading-tight font-bold', hit ? 'text-gold' : 'text-white')}>
        {hit
          ? `That's today's ${target}. Anything now is extra.`
          : `${done} of ${target} today — ${target - done} more to hit your rhythm.`}
      </span>
    </div>
  )
}

/** Stash carries the message: twice a day, the kid can send him to nudge. */
function ReminderCard({
  kidId,
  approverName,
  remaining,
}: {
  kidId: number
  approverName: string
  remaining: number
}) {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = useMutation({
    mutationFn: () => api.sendReminder(kidId),
    onSuccess: () => setSent(true),
    onError: (err: Error) => setError(err.message),
  })

  const out = remaining <= 0 && !sent

  return (
    <div className="rounded-card flex items-center gap-3 bg-white/12 px-4 py-3.5">
      <Mascot pose="coin-toss-alt" height={64} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {sent ? (
          <span className="text-[14px] leading-snug font-bold text-white">
            Stash is on his way to {approverName}.
          </span>
        ) : out ? (
          <span className="text-[14px] leading-snug text-white/85">
            Stash already went twice today — he heads out again tomorrow.
          </span>
        ) : (
          <>
            <span className="text-[14px] leading-snug font-bold text-white">
              {approverName} hasn&rsquo;t looked yet.
            </span>
            <button
              type="button"
              disabled={send.isPending}
              onClick={() => send.mutate()}
              className="pressable display text-leaf-deep inline-flex w-fit items-center rounded-full bg-white px-4 py-2 text-[14px] font-bold disabled:opacity-45"
            >
              Send Stash to remind {approverName}
            </button>
            <span className="text-[11px] text-white/70">
              {remaining} nudge{remaining === 1 ? '' : 's'} left today
            </span>
          </>
        )}
        {error && <span className="text-[12px] font-bold text-white">{error}</span>}
      </div>
    </div>
  )
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
