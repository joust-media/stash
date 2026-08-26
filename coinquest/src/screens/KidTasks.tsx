import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { money } from '../lib/format'
import { useCancelTask, useEndTask, useStartTask } from '../components/TaskList'
import { TaskGrid, TaskTile } from '../components/TaskTile'
import { Hero } from '../components/Hero'
import { HERO_POSE } from '../components/Mascot'
import { Eyebrow, KID_TABS, Screen, ScreenMessage, Spinner, TabBar } from '../components/ui'

/** Achievements — one rung at a time, with everything that counts towards it. */
export function KidTasks() {
  const kidId = Number(useParams().kidId)
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['kidHome', kidId],
    queryFn: () => api.kidHome(kidId),
  })
  const start = useStartTask(kidId)
  const end = useEndTask(kidId)
  const cancel = useCancelTask(kidId)

  // Anything running comes first — it is the one thing needing a decision.
  const running = data?.tasks.filter((t) => t.status === 'in_progress') ?? []
  const open = data?.tasks.filter((t) => t.status === null) ?? []
  const waiting = data?.tasks.filter((t) => t.status === 'pending' || t.status === 'approved') ?? []

  return (
    <Screen
      hero={
        <Hero
          eyebrow="Working towards"
          title={data?.achievement.label ?? 'Achievements'}
          subtitle={
            open.length > 0
              ? `${open.length} thing${open.length === 1 ? '' : 's'} you can do — ${money(data?.remainingCents ?? 0)}`
              : 'All done for now. Nice.'
          }
          pose={data?.kid.mascotPose ?? HERO_POSE.achievements}
          milestone={data?.achievement}
        />
      }
    >
      {isPending && <Spinner />}
      {isError && <ScreenMessage>{(error as Error).message}</ScreenMessage>}

      {data && (
        <div className="scroll-y animate-fade -mx-1 flex flex-1 flex-col gap-5 px-6 pt-5 pb-5 [&>*]:shrink-0">
          {data.achievement.nudge && (
            <div className="bg-gold/20 rounded-card text-chestnut px-4 py-3 text-center text-[15px] font-bold">
              {data.achievement.nudge}
            </div>
          )}

          {running.length > 0 && (
            <section className="flex flex-col gap-2.5">
              <Eyebrow>In progress</Eyebrow>
              <TaskGrid>
                {running.map((task) => (
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

          {open.length > 0 && (
            <section className="flex flex-col gap-2.5">
              <Eyebrow>To do</Eyebrow>
              <TaskGrid>
                {open.map((task) => (
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
            </section>
          )}

          {waiting.length > 0 && (
            <section className="flex flex-col gap-2.5">
              <Eyebrow>Done today</Eyebrow>
              <TaskGrid>
                {waiting.map((task) => (
                  <TaskTile key={task.choreId} task={task} />
                ))}
              </TaskGrid>
            </section>
          )}
        </div>
      )}

      <TabBar tabs={KID_TABS(kidId)} />
    </Screen>
  )
}
