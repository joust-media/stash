import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Milestone } from '../../shared/types'
import { ForestBackdrop } from './ForestBackdrop'
import { POSES, type Pose } from './Mascot'
import { Money } from './Money'
import { Eyebrow, ProgressBar, StatusBar, cx } from './ui'

/*
 * The header every screen opens with, and it is the same height on every screen
 * so the app does not jump as you move between tabs.
 *
 * Stash owns the right at full band height; the screen's words sit left on the
 * same row. He is sized to the exact width of his column so he is never trimmed
 * at the sides — the band crops him from the waist down and `.mascot-bust`
 * feathers that cut.
 */

/**
 * One height for every screen. The band is this plus the status bar.
 * Stash is sized to the width of his column, so this and MASCOT_COLUMN move
 * together — a taller band on its own would just add empty green under him.
 */
const BAND_HEIGHT = 206

/** How much of the width Stash owns. The words take the rest. */
const MASCOT_COLUMN = '52%'
const TEXT_INSET = '50%'

export function Hero({
  eyebrow,
  title,
  amountCents,
  subtitle,
  pose,
  milestone,
  children,
  back,
  action,
  onMilestoneClick,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  /** Leads with the amount instead of the title — the balance is the headline. */
  amountCents?: number
  subtitle?: ReactNode
  pose: Pose
  /** Renders the one thing being worked towards, as a labelled bar. */
  milestone?: Milestone
  /** Extra content under the title — a balance, chips. */
  children?: ReactNode
  /** Renders a back arrow that navigates here. */
  back?: string
  /** A control pinned to the top-right of the band. */
  action?: ReactNode
  /** Makes the progress row tappable — used to reach the goals screen. */
  onMilestoneClick?: () => void
}) {
  const navigate = useNavigate()
  const spec = POSES[pose] ?? POSES['coin-toss']
  // A screen titled after its milestone should not print the label twice.
  const showMilestoneLabel = milestone ? milestone.label !== title : false

  return (
    <ForestBackdrop className="shrink-0 rounded-b-[32px] shadow-[var(--shadow-card)]">
      <div className="relative z-20">
        <StatusBar onGreen />
      </div>

      <div
        className="mascot-bust pointer-events-none absolute inset-y-0 right-0 overflow-hidden"
        style={{ width: MASCOT_COLUMN }}
      >
        <img
          src={spec.file}
          alt={spec.alt}
          draggable={false}
          className="absolute top-1.5 right-0 w-full max-w-none select-none"
          style={{ filter: 'drop-shadow(0 8px 14px rgba(92,51,25,0.20))' }}
        />
      </div>

      {/* Controls float so they never change the band's height. */}
      {(back || action) && (
        <div className="pointer-events-none relative z-20 -mb-11 flex items-start justify-between px-5 pt-1">
          {back ? (
            <button
              type="button"
              aria-label="Go back"
              onClick={() => navigate(back)}
              className="pressable pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-[18px] text-white"
            >
              ←
            </button>
          ) : (
            <span />
          )}
          <span className="pointer-events-auto">{action}</span>
        </div>
      )}

      <div
        className="relative z-10 flex flex-col justify-end overflow-hidden pb-5 pl-6"
        style={{ height: BAND_HEIGHT }}
      >
        {/* Everything here is width-bounded so nothing can spill onto Stash. */}
        <div
          className="flex w-full min-w-0 flex-col items-start gap-1 text-left"
          style={{ paddingRight: TEXT_INSET }}
        >
          {eyebrow && (
            <Eyebrow onGreen className="w-full truncate">
              {eyebrow}
            </Eyebrow>
          )}
          {amountCents === undefined ? (
            <h1 className="line-clamp-2 w-full text-[28px] leading-tight font-extrabold text-white">
              {title}
            </h1>
          ) : (
            <Money cents={amountCents} size={52} tone="onGreen" className="-my-0.5" />
          )}
          {subtitle && (
            <p className="line-clamp-2 w-full text-[13px] leading-snug text-white/85">{subtitle}</p>
          )}
          {children}
        </div>

        {/*
          The bar runs the full width under Stash — it is the one element that
          crosses into his half, which keeps him from looking boxed in.
        */}
        {milestone && (
          <div
            className={cx('mt-2.5 flex flex-col gap-1 pr-6', onMilestoneClick && 'cursor-pointer')}
            onClick={onMilestoneClick}
            role={onMilestoneClick ? 'button' : undefined}
          >
            {/* Labels stay clear of Stash; only the bar itself crosses into his half. */}
            {/*
              The milestone row sits low in the band, where the mask has already
              faded Stash out — so it can run the full width without crowding him.
            */}
            <div className="flex items-baseline justify-between gap-2 text-[12px] text-white">
              {showMilestoneLabel ? (
                <>
                  <span className="truncate font-bold">{milestone.label}</span>
                  <span className="shrink-0 text-white/85">{milestone.detail}</span>
                </>
              ) : (
                <span className="font-bold">{milestone.detail}</span>
              )}
            </div>
            <ProgressBar pct={milestone.pct} onGreen />
          </div>
        )}
      </div>
    </ForestBackdrop>
  )
}
