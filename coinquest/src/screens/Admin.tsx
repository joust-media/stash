import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { ChoreCard, GoalRow, KidSummary, Schedule } from '../../shared/types'
import { api, type ChoreInput } from '../lib/api'
import { useSession } from '../lib/session'
import { money } from '../lib/format'
import { Hero } from '../components/Hero'
import { HERO_POSE } from '../components/Mascot'
import { CHORE_ICONS, CHORE_ICON_KEYS, ChoreIcon, ChoreIconBadge } from '../components/ChoreIcon'
import {
  Avatar,
  Button,
  Card,
  ChoiceChip,
  DangerLink,
  Eyebrow,
  FIELD_CLASS,
  Field,
  PARENT_TABS,
  Screen,
  ScreenMessage,
  Segmented,
  SmallButton,
  Spinner,
  TabBar,
  TextField,
  Toggle,
  cx,
} from '../components/ui'

type Section = 'achievements' | 'goals' | 'people'

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'achievements', label: 'Achievements' },
  { key: 'goals', label: 'Goals' },
  { key: 'people', label: 'People' },
]

const SCHEDULES: { key: Schedule; label: string }[] = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'once', label: 'One-time' },
]

/** The parent admin: everything that can be created, edited, or retired. */
export function Admin() {
  const [params, setParams] = useSearchParams()
  const [section, setSection] = useState<Section>('achievements')

  // "New achievement" on the family overview deep-links straight in.
  useEffect(() => {
    if (params.get('new')) setSection('achievements')
  }, [params])

  return (
    <Screen
      hero={
        <Hero
          eyebrow="Parent mode"
          title="Manage"
          subtitle="Achievements, goals, and who's in the family."
          pose={HERO_POSE.admin}
        />
      }
    >
      <div className="shrink-0 px-6 pt-4">
        <Segmented options={SECTIONS} value={section} onChange={setSection} />
      </div>

      {section === 'achievements' && (
        <AchievementsSection openNew={params.get('new') !== null} onConsumeNew={() => setParams({}, { replace: true })} />
      )}
      {section === 'goals' && <GoalsSection />}
      {section === 'people' && <PeopleSection />}

      <TabBar tabs={PARENT_TABS} />
    </Screen>
  )
}

/* ------------------------------------------------------- achievements ---- */

function AchievementsSection({ openNew, onConsumeNew }: { openNew: boolean; onConsumeNew: () => void }) {
  const queryClient = useQueryClient()
  const { parent } = useSession()
  const [kidFilter, setKidFilter] = useState<number | null>(null)
  const [editing, setEditing] = useState<ChoreCard | 'new' | null>(null)

  useEffect(() => {
    if (openNew) {
      setEditing('new')
      onConsumeNew()
    }
  }, [openNew, onConsumeNew])

  const family = useQuery({ queryKey: ['family'], queryFn: api.family })
  const chores = useQuery({
    queryKey: ['chores', kidFilter],
    queryFn: () => api.chores(kidFilter ?? undefined),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['chores'] })
    queryClient.invalidateQueries({ queryKey: ['family'] })
    queryClient.invalidateQueries({ queryKey: ['kidHome'] })
  }

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      api.setChoreActive(id, { parentId: parent!.id, active }),
    onMutate: async ({ id, active }) => {
      const key = ['chores', kidFilter]
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ChoreCard[]>(key)
      queryClient.setQueryData(key, (old: ChoreCard[] | undefined) =>
        old?.map((c) => (c.id === id ? { ...c, active } : c)),
      )
      return { previous, key }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(ctx.key, ctx.previous)
    },
    onSettled: invalidate,
  })

  return (
    <div className="scroll-y animate-fade -mx-1 flex flex-1 flex-col gap-3 px-6 pt-4 pb-4">
      <div className="flex shrink-0 items-center justify-between">
        <Eyebrow>Things to do</Eyebrow>
        {!editing && <SmallButton onClick={() => setEditing('new')}>New</SmallButton>}
      </div>

      <div className="scroll-y -mx-1 flex shrink-0 gap-2 overflow-x-auto px-1 pb-1">
        <ChoiceChip selected={kidFilter === null} onClick={() => setKidFilter(null)}>
          All kids
        </ChoiceChip>
        {family.data?.kids.map((kid) => (
          <ChoiceChip key={kid.id} selected={kidFilter === kid.id} onClick={() => setKidFilter(kid.id)}>
            {kid.nickname || kid.name}
          </ChoiceChip>
        ))}
      </div>

      {chores.isPending && <Spinner />}
      {chores.isError && <ScreenMessage>{(chores.error as Error).message}</ScreenMessage>}

      {editing && family.data && (
        <ChoreForm
          kids={family.data.kids}
          chore={editing === 'new' ? null : editing}
          onDone={() => {
            setEditing(null)
            invalidate()
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      {chores.data?.map((chore) => (
        <Card
          key={chore.id}
          className={cx('flex shrink-0 flex-col gap-3 p-4 transition-opacity', !chore.active && 'opacity-55')}
        >
          <div className="flex items-center gap-3">
            <ChoreIconBadge icon={chore.icon} tone={chore.active ? 'leaf' : 'muted'} size={40} />
            <span className="display text-chestnut flex-1 text-[19px] leading-tight font-bold">
              {chore.title}
            </span>
            <Toggle
              on={chore.active}
              label={`${chore.active ? 'Pause' : 'Resume'} ${chore.title}`}
              onChange={(next) => toggle.mutate({ id: chore.id, active: next })}
            />
          </div>

          <div className="flex items-center gap-2">
            <span
              className={cx(
                'display rounded-full px-3 py-1 text-[14px] font-extrabold',
                chore.active ? 'bg-leaf/15 text-leaf-deep' : 'bg-cream text-mustache/70',
              )}
            >
              {money(chore.rewardCents)}
            </span>
            <span className="bg-cream text-mustache/75 rounded-inset px-2.5 py-1 text-[13px] font-bold">
              {chore.scheduleLabel}
            </span>
            <span className="flex-1" />
            <div className="flex">
              {chore.assignees.map((kid, i) => (
                <div key={kid.id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                  <Avatar initial={kid.initial} color={kid.avatarColor} size={28} ring />
                </div>
              ))}
            </div>
          </div>

          <div className="border-line-cream flex items-center justify-between border-t pt-2">
            <SmallButton variant="quiet" onClick={() => setEditing(chore)}>
              Edit
            </SmallButton>
            <DeleteChore chore={chore} onDone={invalidate} />
          </div>
        </Card>
      ))}
    </div>
  )
}

function DeleteChore({ chore, onDone }: { chore: ChoreCard; onDone: () => void }) {
  const { parent } = useSession()
  const [error, setError] = useState<string | null>(null)
  const remove = useMutation({
    mutationFn: () => api.deleteChore(chore.id, parent!.id),
    onError: (err: Error) => setError(err.message),
    onSuccess: onDone,
  })

  // Anything with history keeps it; pausing is the way out.
  if (chore.completionCount > 0) {
    return <span className="text-mustache/55 text-[12px]">{chore.completionCount} logged</span>
  }
  return (
    <div className="flex flex-col items-end">
      <DangerLink disabled={remove.isPending} onClick={() => remove.mutate()}>
        Delete
      </DangerLink>
      {error && <span className="text-coral text-[12px]">{error}</span>}
    </div>
  )
}

function ChoreForm({
  kids,
  chore,
  onDone,
  onCancel,
}: {
  kids: KidSummary[]
  chore: ChoreCard | null
  onDone: () => void
  onCancel: () => void
}) {
  const { parent } = useSession()
  const [title, setTitle] = useState(chore?.title ?? '')
  const [reward, setReward] = useState(chore ? (chore.rewardCents / 100).toFixed(2) : '')
  const [schedule, setSchedule] = useState<Schedule>(chore?.schedule ?? 'daily')
  const [detail, setDetail] = useState(chore?.scheduleDetail ?? '')
  const [icon, setIcon] = useState<string>(chore?.icon ?? 'chore')
  const [kidIds, setKidIds] = useState<number[]>(chore?.assignees.map((a) => a.id) ?? [])
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: async () => {
      const input: ChoreInput = {
        parentId: parent!.id,
        title,
        rewardCents: Math.round(Number(reward) * 100),
        schedule,
        scheduleDetail: detail || null,
        icon,
        kidIds,
      }
      await (chore ? api.updateChore(chore.id, input) : api.createChore(input))
    },
    onError: (err: Error) => setError(err.message),
    onSuccess: onDone,
  })

  return (
    <Card className="animate-fade-up flex flex-col gap-4 p-5">
      <Eyebrow>{chore ? 'Edit achievement' : 'New achievement'}</Eyebrow>

      <Field label="What needs doing?">
        <TextField autoFocus value={title} onChange={setTitle} placeholder="Take out the trash" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Pays">
          <input
            value={reward}
            inputMode="decimal"
            onChange={(e) => setReward(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="2.00"
            className={FIELD_CLASS}
          />
        </Field>
        <Field label="When">
          <TextField value={detail} onChange={setDetail} placeholder="Saturday" />
        </Field>
      </div>

      <Field label="Repeats">
        <div className="flex gap-2">
          {SCHEDULES.map((s) => (
            <ChoiceChip key={s.key} selected={schedule === s.key} onClick={() => setSchedule(s.key)}>
              {s.label}
            </ChoiceChip>
          ))}
        </div>
      </Field>

      <Field label="Icon">
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

      <Field label="Who does it?">
        <div className="flex flex-wrap gap-2">
          {kids.map((kid) => (
            <ChoiceChip
              key={kid.id}
              selected={kidIds.includes(kid.id)}
              onClick={() =>
                setKidIds((ids) => (ids.includes(kid.id) ? ids.filter((i) => i !== kid.id) : [...ids, kid.id]))
              }
            >
              {kid.name}
            </ChoiceChip>
          ))}
        </div>
      </Field>

      {error && <p className="text-coral text-[14px] font-bold">{error}</p>}

      <Button disabled={save.isPending} onClick={() => save.mutate()}>
        {chore ? 'Save changes' : 'Add it'}
      </Button>
      <SmallButton variant="quiet" onClick={onCancel}>
        Cancel
      </SmallButton>
    </Card>
  )
}

/* --------------------------------------------------------------- goals --- */

function GoalsSection() {
  const queryClient = useQueryClient()
  const { parent } = useSession()
  const [editing, setEditing] = useState<GoalRow | 'new' | null>(null)

  const family = useQuery({ queryKey: ['family'], queryFn: api.family })
  const goals = useQuery({ queryKey: ['goals'], queryFn: api.goals })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['goals'] })
    queryClient.invalidateQueries({ queryKey: ['family'] })
    queryClient.invalidateQueries({ queryKey: ['kidHome'] })
  }

  const remove = useMutation({
    mutationFn: (id: number) => api.deleteGoal(id, parent!.id),
    onSettled: invalidate,
  })

  return (
    <div className="scroll-y animate-fade -mx-1 flex flex-1 flex-col gap-3 px-6 pt-4 pb-4">
      <div className="flex items-center justify-between">
        <Eyebrow>What they&rsquo;re saving for</Eyebrow>
        {!editing && <SmallButton onClick={() => setEditing('new')}>New</SmallButton>}
      </div>

      {goals.isPending && <Spinner />}

      {editing && family.data && (
        <GoalForm
          kids={family.data.kids}
          goal={editing === 'new' ? null : editing}
          onDone={() => {
            setEditing(null)
            invalidate()
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      {goals.data?.map((goal) => (
        <Card key={goal.id} className={cx('flex shrink-0 flex-col gap-2 p-4', !goal.active && 'opacity-55')}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="display text-chestnut text-[19px] leading-tight font-bold">{goal.title}</span>
            <span className="text-leaf-deep text-[14px] font-bold">{goal.progressPct}%</span>
          </div>
          <p className="text-mustache/70 text-[13px]">
            {goal.kidName} · target {money(goal.targetCents)}
            {!goal.active && ' · retired'}
          </p>
          <div className="border-line-cream flex items-center justify-between border-t pt-2">
            <SmallButton variant="quiet" onClick={() => setEditing(goal)}>
              Edit
            </SmallButton>
            <DangerLink disabled={remove.isPending} onClick={() => remove.mutate(goal.id)}>
              Delete
            </DangerLink>
          </div>
        </Card>
      ))}

      {goals.data?.length === 0 && !editing && (
        <ScreenMessage>No goals yet — a goal gives the stash somewhere to go.</ScreenMessage>
      )}
    </div>
  )
}

function GoalForm({
  kids,
  goal,
  onDone,
  onCancel,
}: {
  kids: KidSummary[]
  goal: GoalRow | null
  onDone: () => void
  onCancel: () => void
}) {
  const { parent } = useSession()
  const [kidId, setKidId] = useState<number | null>(goal?.kidId ?? kids[0]?.id ?? null)
  const [title, setTitle] = useState(goal?.title ?? '')
  const [target, setTarget] = useState(goal ? (goal.targetCents / 100).toFixed(2) : '')
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: async () => {
      const input = {
        actorId: parent!.id,
        kidId: kidId!,
        title,
        targetCents: Math.round(Number(target) * 100),
      }
      await (goal ? api.updateGoal(goal.id, input) : api.createGoal(input))
    },
    onError: (err: Error) => setError(err.message),
    onSuccess: onDone,
  })

  return (
    <Card className="animate-fade-up flex flex-col gap-4 p-5">
      <Eyebrow>{goal ? 'Edit goal' : 'New goal'}</Eyebrow>

      <Field label="Who's saving?">
        <div className="flex flex-wrap gap-2">
          {kids.map((kid) => (
            <ChoiceChip key={kid.id} selected={kidId === kid.id} onClick={() => setKidId(kid.id)}>
              {kid.name}
            </ChoiceChip>
          ))}
        </div>
      </Field>

      <Field label="Saving for">
        <TextField autoFocus value={title} onChange={setTitle} placeholder="Concert tickets" />
      </Field>

      <Field label="Target" hint="Setting a new goal retires the old one.">
        <input
          value={target}
          inputMode="decimal"
          onChange={(e) => setTarget(e.target.value.replace(/[^0-9.]/g, ''))}
          placeholder="40.00"
          className={FIELD_CLASS}
        />
      </Field>

      {error && <p className="text-coral text-[14px] font-bold">{error}</p>}

      <Button disabled={save.isPending || !kidId} onClick={() => save.mutate()}>
        {goal ? 'Save changes' : 'Add goal'}
      </Button>
      <SmallButton variant="quiet" onClick={onCancel}>
        Cancel
      </SmallButton>
    </Card>
  )
}

/* -------------------------------------------------------------- people --- */

function PeopleSection() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { parent } = useSession()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [role, setRole] = useState<'kid' | 'parent'>('kid')
  const [error, setError] = useState<string | null>(null)

  const people = useQuery({ queryKey: ['people'], queryFn: api.people })

  const add = useMutation({
    mutationFn: () => api.addPerson({ parentId: parent!.id, name, role }),
    onError: (err: Error) => setError(err.message),
    onSuccess: (person) => {
      setAdding(false)
      setName('')
      queryClient.invalidateQueries({ queryKey: ['people'] })
      queryClient.invalidateQueries({ queryKey: ['family'] })
      navigate(`/profile/${person.id}`)
    },
  })

  return (
    <div className="scroll-y animate-fade -mx-1 flex flex-1 flex-col gap-3 px-6 pt-4 pb-4">
      <div className="flex shrink-0 items-center justify-between">
        <Eyebrow>The family</Eyebrow>
        {!adding && <SmallButton onClick={() => setAdding(true)}>Add</SmallButton>}
      </div>

      {adding && (
        <Card className="animate-fade-up flex flex-col gap-4 p-5">
          <Field label="Name">
            <TextField autoFocus value={name} onChange={setName} placeholder="Sam" />
          </Field>
          <Field label="Joining as">
            <div className="flex gap-2">
              <ChoiceChip selected={role === 'kid'} onClick={() => setRole('kid')}>
                Kid
              </ChoiceChip>
              <ChoiceChip selected={role === 'parent'} onClick={() => setRole('parent')}>
                Parent
              </ChoiceChip>
            </div>
          </Field>
          {error && <p className="text-coral text-[14px] font-bold">{error}</p>}
          <Button disabled={add.isPending} onClick={() => add.mutate()}>
            Add to the family
          </Button>
          <SmallButton variant="quiet" onClick={() => setAdding(false)}>
            Cancel
          </SmallButton>
        </Card>
      )}

      {people.isPending && <Spinner />}

      {people.data?.map((person) => (
        <Card key={person.id} onClick={() => navigate(`/profile/${person.id}`)} className="shrink-0 p-4">
          <div className="flex items-center gap-3.5">
            <Avatar initial={person.initial} color={person.avatarColor} size={44} />
            <div className="flex flex-1 flex-col gap-0.5">
              <span className="display text-chestnut text-[19px] leading-tight font-bold">
                {person.nickname || person.name}
                {person.age !== null && ` · ${person.age}`}
              </span>
              <span className="text-mustache/70 text-[13px] leading-tight">
                {person.role === 'parent' ? (person.hasPin ? 'Parent · PIN set' : 'Parent · no PIN') : 'Kid'}
              </span>
            </div>
            <span className="text-leaf-deep text-[14px] font-bold">Edit →</span>
          </div>
        </Card>
      ))}
    </div>
  )
}
