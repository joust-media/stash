import { useMemo } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { CompletionResult } from '../lib/api'
import { HERO_POSE, Mascot } from '../components/Mascot'
import { RewardBadge } from '../components/Money'
import { Button, Chip, Screen, TextLink } from '../components/ui'

/* Confetti in brand colours only: gold, cream, white, chestnut. */
const CONFETTI = ['#F2B93B', '#FAF3E3', '#FFFFFF', '#8B4A2B']

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        left: (i * 37 + ((i * i * 13) % 41)) % 96,
        delay: (i % 7) * 60,
        duration: 1300 + ((i * 97) % 500),
        color: CONFETTI[i % CONFETTI.length],
        round: i % 3 === 0,
        tilt: ((i * 53) % 70) - 35,
      })),
    [],
  )

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            top: 40,
            width: p.round ? 9 : 10,
            height: p.round ? 9 : 18,
            background: p.color,
            borderRadius: p.round ? 999 : 3,
            transform: `rotate(${p.tilt}deg)`,
            animationDelay: `${p.delay}ms`,
            animationDuration: `${p.duration}ms`,
          }}
        />
      ))}
    </div>
  )
}

/** 03 — The win moment. Full-bleed Leaf Green, Stash cheering, gold payout. */
export function Celebration() {
  const kidId = Number(useParams().kidId)
  const navigate = useNavigate()
  const result = useLocation().state as CompletionResult | null

  if (!result) return <Navigate to={`/kid/${kidId}`} replace />

  return (
    <Screen tone="green">
      <Confetti />

      <div className="relative flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <Mascot pose={HERO_POSE.celebration} height={196} />

        <h1 className="animate-fade-up text-[32px] font-extrabold text-white">
          Nice work, {result.kidName}!
        </h1>
        <p className="-mt-2 text-[16px] text-white/90">{result.choreTitle} — done.</p>

        <RewardBadge cents={result.rewardCents} size={42} bounce />

        <Chip onGreen>Waiting for {result.approverName}</Chip>

        <p className="max-w-[280px] text-[14px] leading-[1.5] text-white/85">
          That&rsquo;s the good stuff. It lands in your stash as soon as {result.approverName} says yes.
        </p>
      </div>

      <div className="relative flex shrink-0 flex-col gap-2 px-6 pb-6">
        {result.nextTask ? (
          <Button variant="onGreen" onClick={() => navigate(`/kid/${kidId}/tasks`)}>
            Next: {result.nextTask.title}
          </Button>
        ) : (
          <Button variant="onGreen" onClick={() => navigate(`/kid/${kidId}`)}>
            Back to my stash
          </Button>
        )}
        {result.nextTask && (
          <TextLink onGreen onClick={() => navigate(`/kid/${kidId}`)}>
            Back to my stash
          </TextLink>
        )}
      </div>
    </Screen>
  )
}
