import { cx } from './ui'

/**
 * Numeric keypad. Keys are white surfaces (radius 12) with Baloo 2 numerals —
 * cream tiles would vanish against the cream app background. The dot and delete
 * keys sit on the background rather than a tile.
 */
export function Keypad({
  onDigit,
  onDot,
  onBackspace,
  showDot = true,
}: {
  onDigit: (digit: string) => void
  onDot?: () => void
  onBackspace: () => void
  showDot?: boolean
}) {
  const key = (content: string, onClick: () => void, tile: boolean, label?: string) => (
    <button
      key={content || label}
      type="button"
      aria-label={label ?? content}
      onClick={onClick}
      className={cx(
        'display rounded-inset py-3.5 text-center text-[24px] font-bold transition-colors duration-150',
        tile
          ? 'bg-surface text-chestnut shadow-[var(--shadow-card)] hover:bg-cream'
          : 'text-mustache/60 hover:text-mustache',
      )}
    >
      {content}
    </button>
  )

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => key(d, () => onDigit(d), true))}
      {showDot && onDot ? key('.', onDot, false, 'Decimal point') : <span />}
      {key('0', () => onDigit('0'), true)}
      {key('⌫', onBackspace, false, 'Delete')}
    </div>
  )
}
