import type { KidRequest, TaskRow } from '../../shared/types'
import { MINUS, money } from '../lib/format'
import { ChoreIconBadge } from './ChoreIcon'
import { Money } from './Money'
import { Chip, Eyebrow, SmallButton, cx } from './ui'

/*
 * Tasks, achievements and things-to-do all render as the same tile in a
 * two-column grid: icon, name, when, and what it pays.
 */

export function TaskGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>
}

export function TaskTile({
  task,
  onClick,
  onEnd,
  onCancel,
  selected,
  busy,
}: {
  task: TaskRow
  /** Tapping an untouched tile starts it. */
  onClick?: (task: TaskRow) => void
  /** Finishing is what alerts the parent, so it is its own explicit button. */
  onEnd?: (task: TaskRow) => void
  onCancel?: (task: TaskRow) => void
  /** Draws the picked state used by the Add funds flow. */
  selected?: boolean
  busy?: boolean
}) {
  const running = task.status === 'in_progress'
  const pending = task.status === 'pending'
  const approved = task.status === 'approved'
  const done = pending || approved

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <ChoreIconBadge
          icon={task.icon}
          tone={approved ? 'gold' : done ? 'muted' : 'leaf'}
          size={42}
        />
        {selected && (
          <span className="bg-leaf flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white">
            ✓
          </span>
        )}
      </div>

      <span
        className={cx(
          'display text-chestnut line-clamp-2 text-left text-[17px] leading-tight font-bold',
          done && 'line-through decoration-2',
        )}
      >
        {task.title}
      </span>

      <span className="text-mustache/60 line-clamp-1 text-left text-[12px] leading-tight">
        {running
          ? `Started ${task.startedLabel ?? 'just now'}`
          : pending
            ? 'Waiting on a parent'
            : approved
              ? 'Approved'
              : task.scheduleLabel}
      </span>

      <div className="mt-auto flex flex-col gap-2 pt-1">
        {pending ? (
          <Chip>Waiting</Chip>
        ) : (
          <Money cents={task.rewardCents} size={26} tone={approved ? 'reward' : 'leaf'} sign="+" />
        )}

        {running && onEnd && (
          <div className="flex flex-col gap-1">
            <SmallButton disabled={busy} onClick={() => onEnd(task)}>
              End
            </SmallButton>
            {onCancel && (
              <button
                type="button"
                onClick={() => onCancel(task)}
                className="text-mustache/55 hover:text-mustache text-[11px] font-bold underline underline-offset-2"
              >
                Never mind
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )

  const classes = cx(
    'rounded-card flex min-h-[150px] w-full flex-col gap-1.5 p-3.5 text-left transition-colors duration-150',
    selected
      ? 'border-leaf bg-leaf/10 border-2'
      : running
        ? 'border-leaf bg-surface border-2 shadow-[var(--shadow-card)]'
        : done
          ? 'bg-surface border-2 border-transparent opacity-65 shadow-[var(--shadow-card)]'
          : 'bg-surface hover:border-leaf/40 border-2 border-transparent shadow-[var(--shadow-card)]',
    busy && 'opacity-40',
  )

  // A running tile holds its own buttons, so the tile itself stops being one.
  if (!onClick || done || running) return <div className={classes}>{body}</div>

  return (
    <button
      type="button"
      disabled={busy}
      aria-pressed={selected}
      onClick={() => onClick(task)}
      className={cx(classes, 'pressable')}
    >
      {body}
    </button>
  )
}

/**
 * Everything the kid is waiting on a parent for — money in and money out in the
 * same list, because a withdrawal matters as much as an earning.
 */
export function OutstandingRequests({ requests, onGreen }: { requests: KidRequest[]; onGreen?: boolean }) {
  if (requests.length === 0) return null

  const incoming = requests.filter((r) => r.amountCents > 0).reduce((s, r) => s + r.amountCents, 0)
  const outgoing = requests.filter((r) => r.amountCents < 0).reduce((s, r) => s + Math.abs(r.amountCents), 0)

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between">
        <Eyebrow onGreen={onGreen}>Waiting on a parent</Eyebrow>
        <span className={cx('text-[12px] font-bold', onGreen ? 'text-white/80' : 'text-mustache/70')}>
          {[incoming > 0 && `${money(incoming)} in`, outgoing > 0 && `${money(outgoing)} out`]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </div>

      {[...requests]
        // Real cash already handed over outranks everything else here.
        .sort((a, b) => Number(b.kind === 'deposit') - Number(a.kind === 'deposit'))
        .map((r) => (
          <div
            key={`${r.kind}-${r.id}`}
            className={cx(
              'bg-surface rounded-card flex items-center gap-3 px-4 py-3.5 shadow-[var(--shadow-card)]',
              r.kind === 'deposit' && 'border-leaf border-2',
            )}
          >
            <ChoreIconBadge
              icon={r.kind === 'withdrawal' ? 'cart' : r.kind === 'deposit' ? 'stash' : r.icon}
              tone={r.kind === 'deposit' ? 'leaf' : 'muted'}
              size={38}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="display text-chestnut truncate text-[16px] leading-tight font-bold">
                {r.title}
              </span>
              <span
                className={cx(
                  'truncate text-[12px] leading-tight',
                  r.kind === 'deposit' ? 'text-leaf-deep font-bold' : 'text-mustache/60',
                )}
              >
                {r.kind === 'withdrawal'
                  ? `Cash out · ${r.timeLabel}`
                  : r.kind === 'deposit'
                    ? `Your cash, handed over · ${r.timeLabel}`
                    : `Achievement · ${r.timeLabel}`}
              </span>
            </div>
            <Money
              cents={r.amountCents}
              size={21}
              tone={r.amountCents < 0 ? 'spend' : 'leaf'}
              sign={r.amountCents < 0 ? MINUS : '+'}
            />
          </div>
        ))}
    </section>
  )
}
