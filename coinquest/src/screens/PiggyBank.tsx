import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import type { TaskRow } from '../../shared/types'
import { api } from '../lib/api'
import { MINUS, money } from '../lib/format'
import { ForestBackdrop } from '../components/ForestBackdrop'
import { Hero } from '../components/Hero'
import { Keypad, pushDigit } from '../components/Keypad'
import { LandedMoment } from '../components/LandedMoment'
import { HERO_POSE, Mascot } from '../components/Mascot'
import { Money } from '../components/Money'
import { PhotoInput, type UploadedPhoto } from '../components/PhotoInput'
import { ReminderCard } from '../components/Reminder'
import { OutstandingRequests, TaskGrid, TaskTile } from '../components/TaskTile'
import {
  Button,
  ChoiceChip,
  Eyebrow,
  KID_TABS,
  ProgressBar,
  Screen,
  ScreenMessage,
  SmallButton,
  Spinner,
  StatusBar,
  TabBar,
  WarningBanner,
} from '../components/ui'

const CATEGORIES = ['Going out', 'Food', 'Gift', 'Other']

type Mode = 'idle' | 'add' | 'earn' | 'spend'

/**
 * My Stash. Money in and money out both start here, and both need a parent:
 * "Add funds" picks something to do and requests it, "Take out" asks for cash.
 * Neither moves a cent on its own.
 *
 * The landing page wears the Home header — the same towering band, scrolling
 * with the page, with the balance, the savings rung, and both doors inside it.
 * The flows underneath (add / earn / spend) keep the compact band.
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

  if (mode !== 'idle') {
    return (
      <Screen
        tone="green"
        tint={data?.kid.avatarColor}
        hero={
          <Hero
            seamless
            eyebrow="My Stash"
            title="Stash"
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
        {data && <LandedMoment home={data} />}
      </Screen>
    )
  }

  return (
    <Screen tint={data?.kid.avatarColor} hero={<></>}>
      {home.isPending && <Spinner />}
      {home.isError && <ScreenMessage>{(home.error as Error).message}</ScreenMessage>}

      {data && (
        <div className="scroll-y animate-fade flex flex-1 flex-col pb-4 [&>*]:shrink-0">
          {/* The Home-sized header. Nothing here is sticky — it scrolls. */}
          <ForestBackdrop className="relative flex h-[76%] shrink-0 flex-col rounded-b-[32px] shadow-[var(--shadow-card)]">
            <StatusBar onGreen />
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 pb-4 text-center">
              <Mascot pose={HERO_POSE.piggyBank} height={190} />
              <span className="text-[12px] font-bold tracking-[0.16em] text-white/80 uppercase">
                My stash
              </span>
              <Money cents={data.balanceCents} size={76} tone="onGreen" className="-mt-1" />
              <span className="text-[13px] text-white/85">
                {data.heldCents > 0
                  ? `${money(availableCents)} ready · ${money(data.heldCents)} waiting on a parent`
                  : `${money(availableCents)} ready to spend`}
              </span>
              {pendingInCents > 0 && (
                <span className="rounded-full bg-white/15 px-3 py-1 text-[12px] font-bold text-white">
                  Pending · +{money(pendingInCents)} once {data.approverName} approves
                </span>
              )}

              {/* The amount to go: the savings rung, riding inside the header. */}
              <div className="flex w-full flex-col gap-1 pt-2">
                <div className="flex items-baseline justify-between gap-2 text-[12px] text-white">
                  <span className="truncate font-bold">{data.savings.label}</span>
                  <span className="shrink-0 text-white/85">{data.savings.detail}</span>
                </div>
                <ProgressBar pct={data.savings.pct} onGreen />
              </div>

              {/* The two doors, right under the number — same as Home's. */}
              <div className="grid w-full grid-cols-2 gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setMode('add')}
                  className="pressable display text-leaf-deep flex min-h-14 items-center justify-center rounded-full bg-white text-[18px] font-bold shadow-[var(--shadow-button)]"
                >
                  Add funds
                </button>
                <button
                  type="button"
                  onClick={() => setMode('spend')}
                  disabled={availableCents <= 0}
                  className="pressable display flex min-h-14 items-center justify-center rounded-full border-2 border-white/40 bg-white/10 text-[18px] font-bold text-white disabled:opacity-45"
                >
                  Take out
                </button>
              </div>
            </div>
          </ForestBackdrop>

          <div className="flex flex-col gap-5 px-6 pt-4 [&>*]:shrink-0">
            {data.savings.nudge && (
              <div className="bg-gold rounded-card text-mustache px-4 py-3 text-center text-[15px] font-bold">
                {data.savings.nudge}
              </div>
            )}

            <OutstandingRequests requests={data.requests} />
            {data.requests.length > 0 && (
              <ReminderCard
                kidId={data.kid.id}
                approverName={data.approverName}
                remaining={data.remindersLeftToday}
              />
            )}

            <SmallButton variant="quiet" onClick={() => navigate(`/kid/${kidId}/history`)}>
              See every dollar
            </SmallButton>
          </div>
        </div>
      )}

      <TabBar tabs={KID_TABS(kidId)} />

      {/* A parent confirmed a hand-over since the kid last looked. */}
      {data && <LandedMoment home={data} />}
    </Screen>
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
          <Money cents={cents} size={58} tone="onGreen" sign={MINUS} />

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

          {/* The same keypad as everywhere money is typed — the OS keyboard
              would eat half the screen and it never matched the tiles. */}
          <div className="w-full pt-1">
            <Keypad
              onGreen
              onDigit={(d) => {
                setError(null)
                setAmount((v) => pushDigit(v, d))
              }}
              onDot={() => setAmount((v) => (v.includes('.') ? v : (v || '0') + '.'))}
              onBackspace={() => setAmount((v) => v.slice(0, -1))}
            />
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
