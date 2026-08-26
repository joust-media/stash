import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import type { KidHome, TaskRow } from '../../shared/types'
import { api } from '../lib/api'
import { MINUS, money } from '../lib/format'
import { useStartTask } from '../components/TaskList'
import { Hero } from '../components/Hero'
import { HERO_POSE } from '../components/Mascot'
import { Money } from '../components/Money'
import { OutstandingRequests, TaskGrid, TaskTile } from '../components/TaskTile'
import {
  Button,
  ChoiceChip,
  Eyebrow,
  KID_TABS,
  Screen,
  ScreenMessage,
  SmallButton,
  Spinner,
  TabBar,
  WarningBanner,
} from '../components/ui'

const CATEGORIES = ['Going out', 'Food', 'Gift', 'Other']

type Mode = 'idle' | 'earn' | 'spend'

/**
 * The Piggy Bank. Money in and money out both start here, and both need a
 * parent: "Add funds" picks something to do and requests it, "Take money out"
 * asks for cash. Neither moves a cent on its own.
 */
export function PiggyBank() {
  const kidId = Number(useParams().kidId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<Mode>('idle')

  const home = useQuery({ queryKey: ['kidHome', kidId], queryFn: () => api.kidHome(kidId) })
  const data = home.data

  const availableCents = (data?.balanceCents ?? 0) - (data?.heldCents ?? 0)

  return (
    <Screen
      hero={
        <Hero
          eyebrow="Piggy bank"
          title="Piggy bank"
          amountCents={data?.balanceCents ?? 0}
          subtitle={
            data && data.heldCents > 0
              ? `${money(availableCents)} ready · ${money(data.heldCents)} waiting on a parent`
              : `${money(availableCents)} ready to spend`
          }
          pose={HERO_POSE.piggyBank}
          milestone={data?.savings}
        />
      }
    >
      {home.isPending && <Spinner />}
      {home.isError && <ScreenMessage>{(home.error as Error).message}</ScreenMessage>}

      {data && mode === 'idle' && (
        <IdleView
          home={data}
          availableCents={availableCents}
          onMode={setMode}
          onHistory={() => navigate(`/kid/${kidId}/history`)}
        />
      )}
      {data && mode === 'earn' && (
        <EarnView
          kidId={kidId}
          tasks={data.tasks.filter((t) => t.status === null)}
          onCancel={() => setMode('idle')}
        />
      )}
      {data && mode === 'spend' && (
        <SpendView
          kidId={kidId}
          availableCents={availableCents}
          balanceCents={data.balanceCents}
          goal={data.goal}
          onDone={() => {
            setMode('idle')
            queryClient.invalidateQueries({ queryKey: ['kidHome', kidId] })
          }}
          onCancel={() => setMode('idle')}
        />
      )}

      <TabBar tabs={KID_TABS(kidId)} />
    </Screen>
  )
}

/* ---------------------------------------------------------------- idle --- */

function IdleView({
  home,
  availableCents,
  onMode,
  onHistory,
}: {
  home: KidHome
  availableCents: number
  onMode: (m: Mode) => void
  onHistory: () => void
}) {
  const open = home.tasks.filter((t) => t.status === null)

  return (
    <div className="scroll-y animate-fade -mx-1 flex flex-1 flex-col gap-5 px-6 pt-5 pb-4 [&>*]:shrink-0">
      {home.savings.nudge && (
        <div className="bg-gold/20 rounded-card text-chestnut px-4 py-3 text-center text-[15px] font-bold">
          {home.savings.nudge}
        </div>
      )}

      {/*
        Money in and money out are the same size: taking money out is the point
        of saving, so it gets equal footprint. Only one is the filled primary.
      */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onMode('earn')}
          className="pressable bg-leaf rounded-card hover:bg-leaf-deep flex min-h-[132px] flex-col items-start gap-2 p-4 text-left shadow-[var(--shadow-button)]"
        >
          <span className="text-leaf display flex h-11 w-11 items-center justify-center rounded-full bg-white text-[24px] font-extrabold">
            ＋
          </span>
          <span className="display text-[20px] leading-tight font-extrabold text-white">Add funds</span>
          <span className="text-[12px] leading-tight text-white/85">
            {open.length > 0 ? `${open.length} to do · ${money(home.remainingCents)}` : 'Nothing to do yet'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onMode('spend')}
          disabled={availableCents <= 0}
          className="pressable bg-surface rounded-card border-line-cream hover:border-coral/50 flex min-h-[132px] flex-col items-start gap-2 border-2 p-4 text-left shadow-[var(--shadow-card)] disabled:opacity-45"
        >
          <span className="bg-coral/15 text-coral display flex h-11 w-11 items-center justify-center rounded-full text-[24px] font-extrabold">
            ↑
          </span>
          <span className="display text-chestnut text-[20px] leading-tight font-extrabold">Take out</span>
          <span className="text-mustache/65 text-[12px] leading-tight">
            {availableCents > 0 ? `${money(availableCents)} ready` : 'Nothing to spend yet'}
          </span>
        </button>
      </div>

      <OutstandingRequests requests={home.requests} />

      <SmallButton variant="quiet" onClick={() => onHistory()}>
        See every dollar
      </SmallButton>
    </div>
  )
}

/* ---------------------------------------------------------------- earn --- */

/** Pick one thing to do, then request it. Approval is what pays it out. */
function EarnView({
  kidId,
  tasks,
  onCancel,
}: {
  kidId: number
  tasks: TaskRow[]
  onCancel: () => void
}) {
  const [picked, setPicked] = useState<TaskRow | null>(null)
  const start = useStartTask(kidId)

  return (
    <>
      <div className="scroll-y animate-fade -mx-1 flex flex-1 flex-col gap-2.5 px-6 pt-5 pb-3 [&>*]:shrink-0">
        <Eyebrow>Pick one thing to do</Eyebrow>

        {tasks.length === 0 && (
          <ScreenMessage>Nothing left on your list — come back tomorrow.</ScreenMessage>
        )}

        <TaskGrid>
          {tasks.map((task) => (
            <TaskTile
              key={task.choreId}
              task={task}
              selected={picked?.choreId === task.choreId}
              onClick={setPicked}
            />
          ))}
        </TaskGrid>
      </div>

      <div className="flex shrink-0 flex-col gap-2 px-6 pb-3">
        <Button disabled={!picked || start.isPending} onClick={() => picked && start.mutate(picked)}>
          {picked ? `Start · earn ${money(picked.rewardCents)}` : 'Pick one to start'}
        </Button>
        <SmallButton variant="quiet" onClick={onCancel}>
          Cancel
        </SmallButton>
      </div>
    </>
  )
}

/* --------------------------------------------------------------- spend --- */

function SpendView({
  kidId,
  availableCents,
  balanceCents,
  goal,
  onDone,
  onCancel,
}: {
  kidId: number
  availableCents: number
  balanceCents: number
  goal: { title: string; targetCents: number } | null
  onDone: () => void
  onCancel: () => void
}) {
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [error, setError] = useState<string | null>(null)

  const cents = Math.round(Number(amount || 0) * 100)
  const valid = cents > 0 && cents <= availableCents

  const goalAfterPct =
    goal && cents > 0 ? Math.max(0, Math.round(((balanceCents - cents) / goal.targetCents) * 100)) : null

  const request = useMutation({
    mutationFn: () => api.requestWithdrawal({ kidId, amountCents: cents, category }),
    onError: (err: Error) => setError(err.message),
    onSuccess: onDone,
  })

  return (
    <>
      <div className="scroll-y animate-fade -mx-1 flex flex-1 flex-col gap-5 px-6 pt-5 pb-3 [&>*]:shrink-0">
        <div className="flex flex-col items-center gap-3">
          <Eyebrow>How much?</Eyebrow>
          <label className="relative block cursor-text">
            <Money cents={cents} size={58} tone="spend" sign={MINUS} />
            <input
              inputMode="decimal"
              aria-label="Amount to take out"
              value={amount}
              onChange={(e) => {
                setError(null)
                setAmount(e.target.value.replace(/[^0-9.]/g, ''))
              }}
              className="absolute inset-0 h-full w-full cursor-text opacity-0 outline-none"
            />
          </label>

          <div className="flex gap-2">
            <ChoiceChip selected={cents === 500} onClick={() => setAmount('5')}>
              $5
            </ChoiceChip>
            <ChoiceChip selected={cents === 1000} onClick={() => setAmount('10')}>
              $10
            </ChoiceChip>
            <ChoiceChip
              selected={cents > 0 && cents === availableCents}
              onClick={() => setAmount((availableCents / 100).toFixed(2))}
            >
              All of it
            </ChoiceChip>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <Eyebrow>What&rsquo;s it for?</Eyebrow>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <ChoiceChip key={c} selected={category === c} onClick={() => setCategory(c)}>
                {c}
              </ChoiceChip>
            ))}
          </div>
        </div>

        {goalAfterPct !== null && goal && (
          <WarningBanner>
            Heads up — spending this moves your {goal.title} goal back to{' '}
            <span className="font-extrabold">{goalAfterPct}%</span>.
          </WarningBanner>
        )}

        {error && <p className="text-coral text-[14px] font-bold">{error}</p>}
      </div>

      <div className="flex shrink-0 flex-col gap-2 px-6 pb-3">
        <Button disabled={!valid || request.isPending} onClick={() => request.mutate()}>
          {cents > availableCents && cents > 0 ? `You have ${money(availableCents)}` : `Ask for ${money(cents)}`}
        </Button>
        <p className="text-mustache/70 text-center text-[12px]">
          A parent hands over the cash and confirms.
        </p>
        <SmallButton variant="quiet" onClick={onCancel}>
          Cancel
        </SmallButton>
      </div>
    </>
  )
}
