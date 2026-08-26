import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { money } from '../lib/format'
import { useCancelTask, useEndTask, useStartTask } from '../components/TaskList'
import { OutstandingRequests, TaskGrid, TaskTile } from '../components/TaskTile'
import { Hero } from '../components/Hero'
import { HERO_POSE } from '../components/Mascot'
import { Money } from '../components/Money'
import { Avatar, Eyebrow, KID_TABS, Screen, ScreenMessage, Spinner, TabBar } from '../components/ui'
import type { Milestone } from '../../shared/types'

/** 02 — Kid home: the stash, the goal, and what's still to do. */
export function KidHome() {
  const kidId = Number(useParams().kidId)
  const navigate = useNavigate()
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['kidHome', kidId],
    queryFn: () => api.kidHome(kidId),
  })
  const start = useStartTask(kidId)
  const end = useEndTask(kidId)
  const cancel = useCancelTask(kidId)

  const toGo = data ? data.totalCount - data.doneCount : 0

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

  return (
    <Screen
      hero={
        <Hero
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
      {isPending && <Spinner />}
      {isError && <ScreenMessage>{(error as Error).message}</ScreenMessage>}

      {data && (
        <div className="scroll-y animate-fade -mx-1 flex flex-1 flex-col gap-5 px-6 pt-4 pb-5 [&>*]:shrink-0">
          {milestone?.nudge && (
            <div className="bg-gold/20 rounded-card text-chestnut px-4 py-3 text-center text-[15px] font-bold">
              {milestone.nudge}
            </div>
          )}

          <OutstandingRequests requests={data.requests} />

          {data.tasks.some((t) => t.status === 'in_progress') && (
            <section className="flex flex-col gap-2.5">
              <Eyebrow>In progress</Eyebrow>
              <TaskGrid>
                {data.tasks
                  .filter((t) => t.status === 'in_progress')
                  .map((task) => (
                    <TaskTile
                      key={task.choreId}
                      task={task}
                      onEnd={end.mutate}
                      onCancel={cancel.mutate}
                      busy={end.isPending && end.variables?.choreId === task.choreId}
                    />
                  ))}
              </TaskGrid>
            </section>
          )}

          <section className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
              <Eyebrow>Things to do</Eyebrow>
              <span className="text-mustache/70 text-[13px] font-bold">
                {toGo > 0 ? `${toGo} to go · ${money(data.remainingCents)}` : 'All done!'}
              </span>
            </div>

            <TaskGrid>
              {data.tasks
                .filter((t) => t.status !== 'in_progress')
                .map((task) => (
                <TaskTile
                  key={task.choreId}
                  task={task}
                  onClick={start.mutate}
                  onEnd={end.mutate}
                  onCancel={cancel.mutate}
                  busy={end.isPending && end.variables?.choreId === task.choreId}
                />
              ))}
            </TaskGrid>

            {data.tasks.length === 0 && (
              <div className="border-line-cream text-mustache/70 rounded-card border-2 border-dashed px-4 py-8 text-center text-[15px]">
                Nothing on the list right now.
              </div>
            )}
          </section>
        </div>
      )}

      <TabBar tabs={KID_TABS(kidId)} />
    </Screen>
  )
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
