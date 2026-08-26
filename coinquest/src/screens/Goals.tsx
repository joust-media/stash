import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import type { Goal } from '../../shared/types'
import { api } from '../lib/api'
import { useSession } from '../lib/session'
import { money } from '../lib/format'
import { CHORE_ICONS, CHORE_ICON_KEYS, ChoreIcon, ChoreIconBadge } from '../components/ChoreIcon'
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
  const queryClient = useQueryClient()
  const { parent } = useSession()
  const [editing, setEditing] = useState<Goal | 'new' | null>(null)

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
            {!editing && <SmallButton onClick={() => setEditing('new')}>New goal</SmallButton>}
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
              className={cx('flex flex-col gap-3 p-4', goal.active && 'border-leaf border-2')}
            >
              <div className="flex items-center gap-3">
                <ChoreIconBadge icon={goal.icon} tone={goal.active ? 'leaf' : 'muted'} size={42} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="display text-chestnut truncate text-[19px] leading-tight font-bold">
                    {goal.title}
                  </span>
                  <span className="text-mustache/65 text-[13px] leading-tight">
                    {goal.progressPct >= 100
                      ? 'Reached it!'
                      : `${money(goal.remainingCents)} to go · ${goal.progressPct}%`}
                  </span>
                </div>
                <Money cents={goal.targetCents} size={22} />
              </div>

              <ProgressBar pct={goal.progressPct} />

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
        </div>
      )}

      <TabBar tabs={KID_TABS(kidId)} />
    </Screen>
  )
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

      <Field label="Pick a picture">
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
