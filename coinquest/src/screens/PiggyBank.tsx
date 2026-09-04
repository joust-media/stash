import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import type { KidHome, TaskRow } from '../../shared/types'
import { api } from '../lib/api'
import { MINUS, money } from '../lib/format'
import { Hero } from '../components/Hero'
import { LandedMoment } from '../components/LandedMoment'
import { HERO_POSE } from '../components/Mascot'
import { Money } from '../components/Money'
import { PhotoInput, type UploadedPhoto } from '../components/PhotoInput'
import { ReminderCard } from '../components/Reminder'
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

type Mode = 'idle' | 'add' | 'earn' | 'spend'

/**
 * My Stash. Money in and money out both start here, and both need a parent:
 * "Add funds" picks something to do and requests it, "Take out" asks for cash.
 * Neither moves a cent on its own.
 */
export function PiggyBank() {
  const kidId = Number(useParams().kidId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<Mode>('idle')

  const home = useQuery({ queryKey: ['kidHome', kidId], queryFn: () => api.kidHome(kidId) })
  const data = home.data

  const availableCents = (data?.balanceCents ?? 0) - (data?.heldCents ?? 0)
  // Money already earned but not yet approved — on its way in, not here yet.
  const pendingInCents = data?.requests.reduce((s, r) => s + Math.max(0, r.amountCents), 0) ?? 0

  return (
    <Screen
      tone="green"
      tint={data?.kid.avatarColor}
      hero={
        <Hero
          seamless
          eyebrow="Stash"
          title="Stash"
          amountCents={data?.balanceCents ?? 0}
          subtitle={
            data && data.heldCents > 0
              ? `${money(availableCents)} ready · ${money(data.heldCents)} waiting on a parent`
              : `${money(availableCents)} ready to spend`
          }
          pose={HERO_POSE.piggyBank}
          milestone={data?.savings}
        >
          {pendingInCents > 0 && (
            <span className="rounded-full bg-white/15 px-3 py-1 text-[12px] font-bold text-white">
              Pending · +{money(pendingInCents)} once {data?.approverName} approves
            </span>
          )}
        </Hero>
      }
    >
      {home.isPending && <Spinner onGreen />}
      {home.isError && <ScreenMessage onGreen>{(home.error as Error).message}</ScreenMessage>}

      {data && mode === 'idle' && (
        <IdleView
          home={data}
          availableCents={availableCents}
          onMode={setMode}
          onHistory={() => navigate(`/kid/${kidId}/history`)}
        />
      )}
      {data && mode === 'add' && (
        <AddChooser
          onEarn={() => setMode('earn')}
          onDeposit={() => navigate(`/kid/${kidId}/stash-it`)}
          onCancel={() => setMode('idle')}
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

      {/* A parent confirmed a hand-over since the kid last looked. */}
      {data && <LandedMoment home={data} />}
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
        <div className="bg-gold rounded-card text-mustache px-4 py-3 text-center text-[15px] font-bold">
          {home.savings.nudge}
        </div>
      )}

      {/*
        The page is one colour top to bottom, so these two sit inside the
        header rather than under it — the amount above, the ways it moves right
        below. Equal size on purpose: taking money out is the point of saving.
      */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onMode('add')}
          className="pressable bg-surface rounded-card flex min-h-[132px] flex-col items-start gap-2 p-4 text-left shadow-[var(--shadow-button)]"
        >
          <span className="bg-leaf display flex h-11 w-11 items-center justify-center rounded-full text-[24px] font-extrabold text-white">
            ＋
          </span>
          <span className="display text-chestnut text-[20px] leading-tight font-extrabold">Add funds</span>
          <span className="text-mustache/65 text-[12px] leading-tight">
            {open.length > 0 ? `${open.length} to do · ${money(home.remainingCents)}` : 'Nothing to do yet'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onMode('spend')}
          disabled={availableCents <= 0}
          className="pressable rounded-card flex min-h-[132px] flex-col items-start gap-2 border-2 border-white/30 bg-white/10 p-4 text-left disabled:opacity-45"
        >
          <span className="display flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-[24px] font-extrabold text-white">
            ↑
          </span>
          <span className="display text-[20px] leading-tight font-extrabold text-white">Take out</span>
          <span className="text-[12px] leading-tight text-white/80">
            {availableCents > 0 ? `${money(availableCents)} ready` : 'Nothing to spend yet'}
          </span>
        </button>
      </div>

      <OutstandingRequests requests={home.requests} onGreen />
      {home.requests.length > 0 && (
        <ReminderCard
          kidId={home.kid.id}
          approverName={home.approverName}
          remaining={home.remindersLeftToday}
          onGreen
        />
      )}

      <SmallButton variant="quiet" className="border-white/30 text-white" onClick={() => onHistory()}>
        See every dollar
      </SmallButton>
    </div>
  )
}

/* ----------------------------------------------------------------- add --- */

/** Two ways in: do something for it, or hand over cash you already have. */
function AddChooser({
  onEarn,
  onDeposit,
  onCancel,
}: {
  onEarn: () => void
  onDeposit: () => void
  onCancel: () => void
}) {
  return (
    <div className="scroll-y animate-fade -mx-1 flex flex-1 flex-col gap-3 px-6 pt-5 pb-3 [&>*]:shrink-0">
      <Eyebrow onGreen>Add to your stash</Eyebrow>

      <button
        type="button"
        onClick={onEarn}
        className="pressable bg-surface rounded-card flex flex-col items-start gap-1 p-4 text-left shadow-[var(--shadow-card)]"
      >
        <span className="display text-chestnut text-[18px] leading-tight font-extrabold">
          Do something to earn it
        </span>
        <span className="text-mustache/65 text-[13px] leading-snug">
          Pick from your list and get paid when it&rsquo;s approved.
        </span>
      </button>

      <button
        type="button"
        onClick={onDeposit}
        className="pressable bg-surface rounded-card flex flex-col items-start gap-1 p-4 text-left shadow-[var(--shadow-card)]"
      >
        <span className="display text-chestnut text-[18px] leading-tight font-extrabold">
          I handed cash to a parent
        </span>
        <span className="text-mustache/65 text-[13px] leading-snug">
          Birthday money, allowance, anything — they confirm and it lands here.
        </span>
      </button>

      <SmallButton variant="quiet" className="border-white/30 text-white" onClick={onCancel}>
        Cancel
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
  const navigate = useNavigate()

  return (
    <>
      <div className="scroll-y animate-fade -mx-1 flex flex-1 flex-col gap-2.5 px-6 pt-5 pb-3 [&>*]:shrink-0">
        <Eyebrow onGreen>Pick one thing to do</Eyebrow>

        {tasks.length === 0 && (
          <ScreenMessage onGreen>Nothing left on your list — come back tomorrow.</ScreenMessage>
        )}

        {/* Tapping opens the full-screen confirm — criteria first, then Start. */}
        <TaskGrid>
          {tasks.map((task) => (
            <TaskTile
              key={task.choreId}
              task={task}
              onClick={(t) => navigate(`/kid/${kidId}/task/${t.choreId}`)}
            />
          ))}
        </TaskGrid>
      </div>

      <div className="flex shrink-0 flex-col gap-2 px-6 pb-3">
        <SmallButton variant="quiet" className="border-white/30 text-white" onClick={onCancel}>
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
  const [photo, setPhoto] = useState<UploadedPhoto | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cents = Math.round(Number(amount || 0) * 100)
  const valid = cents > 0 && cents <= availableCents

  const goalAfterPct =
    goal && cents > 0 ? Math.max(0, Math.round(((balanceCents - cents) / goal.targetCents) * 100)) : null

  const request = useMutation({
    mutationFn: () =>
      api.requestWithdrawal({ kidId, amountCents: cents, category, imageMediaId: photo?.id ?? null }),
    onError: (err: Error) => setError(err.message),
    onSuccess: onDone,
  })

  return (
    <>
      <div className="scroll-y animate-fade -mx-1 flex flex-1 flex-col gap-5 px-6 pt-5 pb-3 [&>*]:shrink-0">
        <div className="flex flex-col items-center gap-3">
          <Eyebrow onGreen>How much?</Eyebrow>
          <label className="relative block cursor-text">
            <Money cents={cents} size={58} tone="onGreen" sign={MINUS} />
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
          <Eyebrow onGreen>What&rsquo;s it for?</Eyebrow>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <ChoiceChip key={c} selected={category === c} onClick={() => setCategory(c)}>
                {c}
              </ChoiceChip>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <Eyebrow onGreen>Show what it&rsquo;s for (optional)</Eyebrow>
          <PhotoInput actorId={kidId} value={photo} onChange={setPhoto} onGreen label="Add a photo" />
        </div>

        {goalAfterPct !== null && goal && (
          <WarningBanner>
            Heads up — spending this moves your {goal.title} goal back to{' '}
            <span className="font-extrabold">{goalAfterPct}%</span>.
          </WarningBanner>
        )}

        {error && <p className="text-[14px] font-bold text-white">{error}</p>}
      </div>

      <div className="flex shrink-0 flex-col gap-2 px-6 pb-3">
        <Button
          variant="onGreen"
          disabled={!valid || request.isPending}
          onClick={() => request.mutate()}
        >
          {cents > availableCents && cents > 0 ? `You have ${money(availableCents)}` : `Ask for ${money(cents)}`}
        </Button>
        <p className="text-center text-[12px] text-white/80">
          A parent hands over the cash and confirms.
        </p>
        <SmallButton variant="quiet" className="border-white/30 text-white" onClick={onCancel}>
          Cancel
        </SmallButton>
      </div>
    </>
  )
}
