import { useQuery } from '@tanstack/react-query'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { money } from '../lib/format'
import { useStartTask } from '../components/TaskList'
import { Mascot } from '../components/Mascot'
import { Button, Chip, Screen, SmallButton, Spinner } from '../components/ui'

/*
 * The moment before a task begins. Full-screen, Stash presiding: the name, the
 * reward, and — when the parent has written one — exactly what finishing it
 * means. Hitting Start is agreeing to the criteria, which is why they are shown
 * here and not buried on a tile.
 */
export function TaskConfirm() {
  const kidId = Number(useParams().kidId)
  const choreId = Number(useParams().choreId)
  const navigate = useNavigate()

  const { data, isPending } = useQuery({
    queryKey: ['kidHome', kidId],
    queryFn: () => api.kidHome(kidId),
  })
  const start = useStartTask(kidId)

  const task = data?.tasks.find((t) => t.choreId === choreId)

  // Already started, already waiting, or gone — nothing to confirm.
  if (data && (!task || task.status !== null)) return <Navigate to={`/kid/${kidId}`} replace />

  return (
    <Screen tone="green" tint={data?.kid.avatarColor}>
      {isPending && <Spinner onGreen />}

      {data && task && (
        <div className="animate-fade flex flex-1 flex-col items-center justify-center gap-4 px-8 pb-8 text-center">
          <Mascot pose="coin-toss" height={170} />

          <div className="flex flex-col items-center gap-2">
            <Chip onGreen>{task.scheduleLabel}</Chip>
            {/* It reads as the question it is: "Load the dishwasher?" */}
            <h1 className="display text-[30px] leading-tight font-extrabold text-white">
              {task.title.replace(/[.?!]$/, '')}?
            </h1>
            <span className="display text-[26px] font-extrabold text-white">
              +{money(task.rewardCents)}
            </span>
          </div>

          <p className="max-w-[300px] text-[15px] leading-relaxed text-white/90">
            {task.description ??
              `Do it properly, then hit End — ${data.approverName} gets the nudge to check it.`}
          </p>

          <div className="flex w-full flex-col gap-2 pt-2">
            <Button
              variant="onGreen"
              disabled={start.isPending}
              onClick={() =>
                start.mutate(task, { onSuccess: () => navigate(`/kid/${kidId}`, { replace: true }) })
              }
            >
              Start · earn {money(task.rewardCents)}
            </Button>
            <SmallButton
              variant="quiet"
              className="border-white/30 text-white"
              onClick={() => navigate(-1)}
            >
              Never mind
            </SmallButton>
          </div>
        </div>
      )}
    </Screen>
  )
}
