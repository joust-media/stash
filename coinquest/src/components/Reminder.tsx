import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Mascot } from './Mascot'
import { cx } from './ui'

/*
 * These used to live on Home. The redesign made Home an overview — "how am I
 * doing?" — and both of these answer "what should I do next?", so they moved
 * to where the doing happens: the daily rhythm to Earn, the nudge to Stash.
 */

/**
 * Three a day keeps the stash growing. A rhythm, not a rule — the dots fill
 * gold as tasks land, and nothing is withheld for missing it.
 */
export function DailyThree({
  done,
  target,
  onGreen,
}: {
  done: number
  target: number
  onGreen?: boolean
}) {
  const hit = done >= target
  return (
    <div
      className={cx(
        'rounded-card flex items-center gap-3 px-4 py-3',
        onGreen ? 'bg-white/12' : 'bg-surface shadow-[var(--shadow-card)]',
      )}
    >
      <div className="flex gap-1.5">
        {Array.from({ length: target }, (_, i) => (
          <span
            key={i}
            className={cx(
              'h-3.5 w-3.5 rounded-full transition-colors',
              i < done ? 'bg-gold' : onGreen ? 'bg-white/25' : 'bg-line-cream',
            )}
          />
        ))}
      </div>
      <span
        className={cx(
          'text-[14px] leading-tight font-bold',
          hit ? 'text-gold' : onGreen ? 'text-white' : 'text-mustache',
        )}
      >
        {hit
          ? `That's today's ${target}. Anything now is extra.`
          : `${done} of ${target} today — ${target - done} more to hit your rhythm.`}
      </span>
    </div>
  )
}

/** Stash carries the message: twice a day, the kid can send him to nudge. */
export function ReminderCard({
  kidId,
  approverName,
  remaining,
  onGreen,
}: {
  kidId: number
  approverName: string
  remaining: number
  onGreen?: boolean
}) {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = useMutation({
    mutationFn: () => api.sendReminder(kidId),
    onSuccess: () => setSent(true),
    onError: (err: Error) => setError(err.message),
  })

  const out = remaining <= 0 && !sent
  const strong = onGreen ? 'text-white' : 'text-chestnut'
  const soft = onGreen ? 'text-white/85' : 'text-mustache/70'

  return (
    <div
      className={cx(
        'rounded-card flex items-center gap-3 px-4 py-3.5',
        onGreen ? 'bg-white/12' : 'bg-surface shadow-[var(--shadow-card)]',
      )}
    >
      <Mascot pose="coin-toss-alt" height={64} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {sent ? (
          <span className={cx('text-[14px] leading-snug font-bold', strong)}>
            Stash is on his way to {approverName}.
          </span>
        ) : out ? (
          <span className={cx('text-[14px] leading-snug', soft)}>
            Stash already went twice today — he heads out again tomorrow.
          </span>
        ) : (
          <>
            <span className={cx('text-[14px] leading-snug font-bold', strong)}>
              {approverName} hasn&rsquo;t looked yet.
            </span>
            <button
              type="button"
              disabled={send.isPending}
              onClick={() => send.mutate()}
              className={cx(
                'pressable display inline-flex w-fit items-center rounded-full px-4 py-2 text-[14px] font-bold disabled:opacity-45',
                onGreen ? 'text-leaf-deep bg-white' : 'bg-leaf text-white',
              )}
            >
              Send Stash to remind {approverName}
            </button>
            <span className={cx('text-[11px]', onGreen ? 'text-white/70' : 'text-mustache/55')}>
              {remaining} nudge{remaining === 1 ? '' : 's'} left today
            </span>
          </>
        )}
        {error && <span className={cx('text-[12px] font-bold', onGreen ? 'text-white' : 'text-coral')}>{error}</span>}
      </div>
    </div>
  )
}
