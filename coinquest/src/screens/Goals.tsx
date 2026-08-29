import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import type { Goal, SuggestedItem } from '../../shared/types'
import { api } from '../lib/api'
import { useSession } from '../lib/session'
import { money } from '../lib/format'
import { CHORE_ICONS, CHORE_ICON_KEYS, ChoreIcon, ChoreIconBadge } from '../components/ChoreIcon'
import { AdoptPanel, GoodStuffRow, MatchBadge, MatchLine } from '../components/GoodStuff'
import { Hero } from '../components/Hero'
import { HERO_POSE } from '../components/Mascot'
import { Money } from '../components/Money'
import {
  Button,
  Card,
  DangerLink,
  Eyebrow,
  FIELD_CLASS,
  Field,
  KID_TABS,
  ProgressBar,
  Screen,
  ScreenMessage,
  SmallButton,
  Spinner,
  TabBar,
  TextField,
  cx,
} from '../components/ui'

/*
 * The kid's own goals. They decide what they are saving for and how much it
 * costs — that is what the trackers follow. Keep as many as you like; the one
 * marked active is the one the bars across the app measure against.
 */
export function Goals() {
  const kidId = Number(useParams().kidId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { parent } = useSession()
  const [editing, setEditing] = useState<Goal | 'new' | null>(null)
  // The Good Stuff item the kid is looking at before committing to it.
  const [picking, setPicking] = useState<SuggestedItem | null>(null)
  const [claiming, setClaiming] = useState<Goal | null>(null)

  // A kid on their own device acts as themselves; a parent acts as the parent.
  const actorId = parent?.id ?? kidId

  const home = useQuery({ queryKey: ['kidHome', kidId], queryFn: () => api.kidHome(kidId) })
  const goals = home.data?.goals ?? []
  const active = goals.find((g) => g.active) ?? null

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['kidHome', kidId] })
    queryClient.invalidateQueries({ queryKey: ['family'] })
    queryClient.invalidateQueries({ queryKey: ['goals'] })
  }

  const choose = useMutation({
    mutationFn: (goal: Goal) => api.setGoalActive(goal.id, actorId),
    onSettled: invalidate,
  })

  const remove = useMutation({
    mutationFn: (goal: Goal) => api.deleteGoal(goal.id, actorId),
    onSettled: invalidate,
  })

  const adopt = useMutation({
    mutationFn: (item: SuggestedItem) =>
      api.adoptSuggestion(item.id, { actorId, kidId, makeActive: true }),
    onSuccess: () => setPicking(null),
    onSettled: invalidate,
  })

  // A claim is an ordinary cash-out for the kid's share, carrying the goal.
  // Same endpoint, same approvals queue, same everything.
  const claim = useMutation({
    mutationFn: (goal: Goal) =>
      api.requestWithdrawal({
        kidId,
        amountCents: goal.targetCents,
        category: goal.title,
        goalId: goal.id,
      }),
    onSuccess: () => setClaiming(null),
    onSettled: invalidate,
  })

  return (
    <Screen
      hero={
        <Hero
          eyebrow="Saving for"
          title={active ? active.title : 'Set a goal'}
          subtitle={
            active
              ? `${money(active.remainingCents)} to go`
              : 'Pick something you want and Stash will track it.'
          }
          pose={home.data?.kid.mascotPose ?? HERO_POSE.piggyBank}
          milestone={
            active
              ? {
                  label: active.title,
                  detail: `${money(home.data?.balanceCents ?? 0)} of ${money(active.targetCents)}`,
                  current: home.data?.balanceCents ?? 0,
                  target: active.targetCents,
                  pct: active.progressPct,
                  unit: 'cents',
                  complete: active.progressPct >= 100,
                  nudge: null,
                }
              : undefined
          }
        />
      }
    >
      {home.isPending && <Spinner />}
      {home.isError && <ScreenMessage>{(home.error as Error).message}</ScreenMessage>}

      {home.data && (
        <div className="scroll-y animate-fade -mx-1 flex flex-1 flex-col gap-4 px-6 pt-5 pb-4 [&>*]:shrink-0">
          <div className="flex items-center justify-between">
            <Eyebrow>My goals</Eyebrow>
            {!editing && <SmallButton onClick={() => setEditing('new')}>+ New Goal</SmallButton>}
          </div>

          {editing && (
            <GoalForm
              kidId={kidId}
              actorId={actorId}
              goal={editing === 'new' ? null : editing}
              hasGoals={goals.length > 0}
              onDone={() => {
                setEditing(null)
                invalidate()
              }}
              onCancel={() => setEditing(null)}
            />
          )}

          {goals.length === 0 && !editing && (
            <ScreenMessage>
              No goals yet. A goal gives your stash somewhere to go — a game, a bike, anything.
            </ScreenMessage>
          )}

          {goals.map((goal) => (
            <Card
              key={goal.id}
              className={cx(
                'flex flex-col gap-3 p-4',
                goal.active && 'border-leaf border-2',
                goal.claimed && 'opacity-70',
              )}
            >
              <div className="flex items-center gap-3">
                {goal.image ? (
                  <img
                    src={goal.image}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-2xl object-cover shadow-[var(--shadow-card)]"
                  />
                ) : (
                  <ChoreIconBadge icon={goal.icon} tone={goal.active ? 'leaf' : 'muted'} size={42} />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="display text-chestnut truncate text-[19px] leading-tight font-bold">
                    {goal.title}
                  </span>
                  <span className="text-mustache/65 text-[13px] leading-tight">
                    {goal.claimed
                      ? 'Got it!'
                      : goal.claimPending
                        ? 'Waiting on a parent'
                        : goal.progressPct >= 100
                          ? 'Reached it!'
                          : `${money(goal.remainingCents)} to go · ${goal.progressPct}%`}
                  </span>
                  {/* The badge stays for the life of the goal so the deal stays visible. */}
                  {goal.matchAmountCents ? (
                    <MatchLine
                      payer={goal.matchPayerName ?? home.data.approverName}
                      matchAmountCents={goal.matchAmountCents}
                      className="pt-0.5"
                    />
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Money cents={goal.targetCents} size={22} />
                  {goal.matchPercent ? (
                    <MatchBadge payer={goal.matchPayerName ?? home.data.approverName} matchPercent={goal.matchPercent} />
                  ) : null}
                </div>
              </div>

              <ProgressBar pct={goal.progressPct} />

              {!goal.claimed && goal.claimable &&
                (claiming?.id === goal.id ? (
                  <div className="bg-leaf/10 rounded-inset flex flex-col gap-2 p-3">
                    <p className="text-mustache text-[14px] leading-snug font-bold">
                      Ask {goal.matchPayerName ?? home.data.approverName} for {goal.title}?
                      {goal.matchAmountCents
                        ? ` You saved ${money(goal.targetCents)}, ${goal.matchPayerName ?? home.data.approverName} adds ${money(goal.matchAmountCents)}.`
                        : ` That's ${money(goal.targetCents)} from your stash.`}
                    </p>
                    <Button disabled={claim.isPending} onClick={() => claim.mutate(goal)}>
                      Ask for it
                    </Button>
                    <SmallButton variant="quiet" onClick={() => setClaiming(null)}>
                      Never mind
                    </SmallButton>
                  </div>
                ) : (
                  <Button onClick={() => setClaiming(goal)}>I&rsquo;m ready for this</Button>
                ))}

              <div className="border-line-cream flex items-center justify-between gap-2 border-t pt-2">
                {goal.active ? (
                  <span className="text-leaf-deep text-[13px] font-bold">Tracking this one</span>
                ) : (
                  <SmallButton
                    variant="quiet"
                    disabled={choose.isPending}
                    onClick={() => choose.mutate(goal)}
                  >
                    Track this
                  </SmallButton>
                )}
                <div className="flex items-center gap-3">
                  <SmallButton variant="quiet" onClick={() => setEditing(goal)}>
                    Edit
                  </SmallButton>
                  <DangerLink disabled={remove.isPending} onClick={() => remove.mutate(goal)}>
                    Delete
                  </DangerLink>
                </div>
              </div>
            </Card>
          ))}

          {/*
            Always under the kid's own goals. The kid decides what they are
            saving for; a parent's suggestions are an offer, not a directive.
          */}
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
          ) : (
            <GoodStuffRow
              items={home.data.suggestions}
              onPick={setPicking}
              busyId={null}
              onSeeAll={() => navigate(`/kid/${kidId}/stuff`)}
            />
          )}
        </div>
      )}

      <TabBar tabs={KID_TABS(kidId)} />
    </Screen>
  )
}

/**
 * Shrink a photo before it ever leaves the device: longest edge 640px, JPEG.
 * The server caps the stored string, so oversized uploads fail loudly there —
 * this keeps honest photos under the cap in the first place.
 */
async function fileToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  let out = canvas.toDataURL('image/jpeg', 0.82)
  if (out.length > 380_000) out = canvas.toDataURL('image/jpeg', 0.55)
  return out
}

function GoalForm({
  kidId,
  actorId,
  goal,
  hasGoals,
  onDone,
  onCancel,
}: {
  kidId: number
  actorId: number
  goal: Goal | null
  hasGoals: boolean
  onDone: () => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(goal?.title ?? '')
  const [target, setTarget] = useState(goal ? (goal.targetCents / 100).toFixed(2) : '')
  const [icon, setIcon] = useState<string>(goal?.icon ?? 'stash')
  const [image, setImage] = useState<string | null>(goal?.image ?? null)
  // The first goal is always the tracked one; after that it is a choice.
  const [makeActive, setMakeActive] = useState(goal ? goal.active : !hasGoals)
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: async () => {
      const input = {
        actorId,
        kidId,
        title,
        targetCents: Math.round(Number(target) * 100),
        icon,
        image,
        active: makeActive,
      }
      await (goal ? api.updateGoal(goal.id, input) : api.createGoal(input))
    },
    onError: (err: Error) => setError(err.message),
    onSuccess: onDone,
  })

  return (
    <Card className="animate-fade-up flex flex-col gap-4 p-5">
      <Eyebrow>{goal ? 'Edit goal' : 'New goal'}</Eyebrow>

      <Field label="What do you want?">
        <TextField autoFocus value={title} onChange={setTitle} placeholder="A new skateboard" />
      </Field>

      <Field label="How much does it cost?">
        <input
          value={target}
          inputMode="decimal"
          onChange={(e) => setTarget(e.target.value.replace(/[^0-9.]/g, ''))}
          placeholder="45.00"
          className={FIELD_CLASS}
        />
      </Field>

      <Field label="Add a photo of it">
        <div className="flex items-center gap-3">
          {image ? (
            <img
              src={image}
              alt="Your goal"
              className="h-16 w-16 shrink-0 rounded-2xl object-cover shadow-[var(--shadow-card)]"
            />
          ) : (
            <span className="border-line-cream text-mustache/50 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-dashed text-[11px] font-bold">
              Photo
            </span>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="pressable display border-leaf text-leaf-deep inline-flex w-fit cursor-pointer items-center rounded-full border-2 bg-white px-4 py-2 text-[14px] font-bold">
              {image ? 'Change photo' : 'Choose photo'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (file) setImage(await fileToDataUrl(file))
                  e.target.value = ''
                }}
              />
            </label>
            {image && (
              <button
                type="button"
                onClick={() => setImage(null)}
                className="text-mustache/55 w-fit text-[12px] font-bold underline underline-offset-2"
              >
                Remove
              </button>
            )}
            <span className="text-mustache/55 text-[11px]">
              Seeing the real thing beats any icon.
            </span>
          </div>
        </div>
      </Field>

      <Field label="Or pick a picture">
        <div className="scroll-y flex gap-2 overflow-x-auto pb-1">
          {CHORE_ICON_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              title={CHORE_ICONS[key].label}
              aria-label={CHORE_ICONS[key].label}
              aria-pressed={icon === key}
              onClick={() => setIcon(key)}
              className={cx(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                icon === key
                  ? 'border-leaf bg-leaf/15 text-leaf-deep'
                  : 'border-line-cream text-mustache/60 bg-white',
              )}
            >
              <ChoreIcon icon={key} size={20} />
            </button>
          ))}
        </div>
      </Field>

      {hasGoals && (
        <button
          type="button"
          onClick={() => setMakeActive((v) => !v)}
          aria-pressed={makeActive}
          className={cx(
            'rounded-inset flex items-center gap-3 border-2 px-4 py-3 text-left transition-colors',
            makeActive ? 'border-leaf bg-leaf/10' : 'border-line-cream bg-white',
          )}
        >
          <span
            className={cx(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[3px] text-[13px] font-bold',
              makeActive ? 'border-leaf bg-leaf text-white' : 'border-line-cream',
            )}
          >
            {makeActive ? '✓' : ''}
          </span>
          <span className="text-mustache text-[14px] font-bold">Track this one</span>
        </button>
      )}

      {error && <p className="text-coral text-[14px] font-bold">{error}</p>}

      <Button disabled={save.isPending} onClick={() => save.mutate()}>
        {goal ? 'Save goal' : 'Add goal'}
      </Button>
      <SmallButton variant="quiet" onClick={onCancel}>
        Cancel
      </SmallButton>
    </Card>
  )
}
