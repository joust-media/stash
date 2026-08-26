import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useSession } from '../lib/session'
import { Keypad } from '../components/Keypad'
import { Eyebrow, Screen, cx } from '../components/ui'
import { Hero } from '../components/Hero'
import { HERO_POSE } from '../components/Mascot'

const PIN_LENGTH = 4

/**
 * The PIN gate. Parent copy is calm and plain — no gimmicks, per the voice
 * pillar. The board does not draw this screen; it is built from the primitives.
 */
export function ParentPin() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // `?to=admin` sends a parent straight to Manage after unlocking.
  const destination = params.get('to') === 'admin' ? '/parent/admin' : '/parent'
  const { unlock } = useSession()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = useMutation({
    mutationFn: (value: string) => api.unlockParent(value),
    onSuccess: ({ parent }) => {
      unlock(parent)
      navigate(destination, { replace: true })
    },
    onError: (err: Error) => {
      setError(err.message)
      setPin('')
    },
  })

  const push = (digit: string) => {
    if (submit.isPending) return
    const next = (pin + digit).slice(0, PIN_LENGTH)
    setError(null)
    setPin(next)
    if (next.length === PIN_LENGTH) submit.mutate(next)
  }

  return (
    <Screen
      hero={
        <Hero
          eyebrow="Grown-ups only"
          title="Parent mode"
          subtitle="You approve every achievement before money moves."
          pose={HERO_POSE.pin}
          back="/"
        />
      }
    >

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
        <Eyebrow>Enter your PIN</Eyebrow>

        <div className="flex gap-4">
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <span
              key={i}
              className={cx(
                'h-4 w-4 rounded-full border-[3px] transition-colors duration-150',
                i < pin.length ? 'bg-leaf border-leaf' : 'border-line-cream',
              )}
            />
          ))}
        </div>

        <p className={cx('text-[15px] leading-[1.5]', error ? 'text-coral font-bold' : 'text-mustache/70')}>
          {error ?? 'You approve every achievement before money moves.'}
        </p>
      </div>

      <div className="shrink-0 px-8 pb-8">
        <Keypad showDot={false} onDigit={push} onBackspace={() => setPin((p) => p.slice(0, -1))} />
      </div>
    </Screen>
  )
}
