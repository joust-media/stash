import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useEndTask } from '../components/TaskList'
import { Mascot } from '../components/Mascot'
import { PhotoInput, type UploadedPhoto } from '../components/PhotoInput'
import { Button, Chip, Screen, SmallButton, Spinner } from '../components/ui'

/*
 * The photo step inside End. The rule that matters: End is the moment the
 * parent is alerted, and this screen sits before that moment — nothing reaches
 * the queue until the kid confirms here.
 *
 * `required` blocks completion without a photo, enforced again on the server.
 * `optional` offers it once, with a plainly-worded skip that is a link, not a
 * second pill — one primary CTA. Backing out is "Never mind", with nothing
 * logged and no scolding, exactly like cancelling anywhere else.
 */
export function FinishTask() {
  const kidId = Number(useParams().kidId)
  const choreId = Number(useParams().choreId)
  const navigate = useNavigate()
  const [photo, setPhoto] = useState<UploadedPhoto | null>(null)

  const { data, isPending } = useQuery({
    queryKey: ['kidHome', kidId],
    queryFn: () => api.kidHome(kidId),
  })
  const end = useEndTask(kidId)

  const task = data?.tasks.find((t) => t.choreId === choreId)

  // Only an in-progress task with a photo step belongs here.
  if (data && (!task || task.status !== 'in_progress' || task.photoProof === 'off')) {
    return <Navigate to={`/kid/${kidId}`} replace />
  }

  const required = task?.photoProof === 'required'

  return (
    <Screen tone="green" tint={data?.kid.avatarColor}>
      {isPending && <Spinner onGreen />}

      {data && task && (
        <div className="animate-fade flex flex-1 flex-col items-center justify-center gap-4 px-8 pb-8 text-center">
          <Mascot pose="coin-toss" height={140} />

          <div className="flex flex-col items-center gap-2">
            <Chip onGreen>{task.title}</Chip>
            <h1 className="display text-[28px] leading-tight font-extrabold text-white">
              {required ? 'Show your work' : 'Add a photo?'}
            </h1>
            <p className="max-w-[300px] text-[15px] leading-relaxed text-white/90">
              {required
                ? 'Snap a photo to finish this one.'
                : `A photo shows ${data.approverName} exactly what you did.`}
            </p>
          </div>

          <div className="flex w-full justify-center py-1">
            <PhotoInput actorId={kidId} value={photo} onChange={setPhoto} onGreen />
          </div>

          <div className="flex w-full flex-col gap-2 pt-1">
            <Button
              variant="onGreen"
              disabled={end.isPending || (required && !photo)}
              onClick={() => end.mutate({ task, proofMediaId: photo?.id ?? null })}
            >
              {required && !photo ? 'Take a photo to finish' : "Done — send it to a parent"}
            </Button>

            {!required && !photo && (
              <button
                type="button"
                disabled={end.isPending}
                onClick={() => end.mutate({ task, proofMediaId: null })}
                className="text-[14px] font-bold text-white/85 underline underline-offset-2"
              >
                Finish without a photo
              </button>
            )}

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
