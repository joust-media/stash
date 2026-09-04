import { useRef, useState } from 'react'
import { api } from '../lib/api'
import { SmallButton, cx } from './ui'

/*
 * The one photo control, used for goal photos, achievement art, avatars,
 * cash-out snaps, and proof photos.
 *
 * `capture="environment"` gets the rear camera on a phone and a plain file
 * picker on desktop — one control, no branching. The preview comes straight
 * from the File object so it appears instantly; the upload happens behind it,
 * downscaled through a canvas first so a 12MP phone photo doesn't crawl up on
 * home wifi. A failed upload keeps the preview and offers retry — losing the
 * kid's photo silently is the one unforgivable failure mode here.
 */

async function downscale(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85),
    )
    return blob ?? file
  } catch {
    // HEIC the browser will not decode locally — send the original and let
    // the server's pipeline have a go at it.
    return file
  }
}

export interface UploadedPhoto {
  id: number
  url: string
  thumbUrl: string
}

export function PhotoInput({
  actorId,
  value,
  onChange,
  label = 'Take a photo',
  changeLabel = 'Retake',
  onGreen,
  previewClassName,
}: {
  actorId: number
  /** The current photo, when one is already attached. */
  value: UploadedPhoto | null
  onChange: (photo: UploadedPhoto | null) => void
  label?: string
  changeLabel?: string
  onGreen?: boolean
  previewClassName?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  const upload = async (file: File) => {
    setBusy(true)
    setError(null)
    setFailed(null)
    // Instant local preview — never wait on the round trip to show the photo.
    const local = URL.createObjectURL(file)
    setPreview(local)
    try {
      const stored = await api.uploadMedia(await downscale(file), actorId)
      onChange({ id: stored.id, url: stored.url, thumbUrl: stored.thumbUrl })
    } catch (err) {
      // Keep the preview and the file: the retry re-sends what they took.
      setFailed(file)
      setError((err as Error).message)
      onChange(null)
    } finally {
      setBusy(false)
    }
  }

  const shown = preview ?? value?.url ?? null

  return (
    <div className="flex items-center gap-3">
      {shown ? (
        <img
          src={shown}
          alt="Your photo"
          className={cx(
            'h-20 w-20 shrink-0 rounded-2xl object-cover shadow-[var(--shadow-card)]',
            busy && 'opacity-60',
            previewClassName,
          )}
        />
      ) : (
        <span
          className={cx(
            'flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-2 border-dashed text-[11px] font-bold',
            onGreen ? 'border-white/40 text-white/70' : 'border-line-cream text-mustache/50',
          )}
        >
          Photo
        </span>
      )}

      <div className="flex min-w-0 flex-col items-start gap-1.5">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void upload(file)
            e.target.value = ''
          }}
        />
        {failed ? (
          <SmallButton disabled={busy} onClick={() => failed && void upload(failed)}>
            Try sending it again
          </SmallButton>
        ) : (
          <SmallButton
            disabled={busy}
            variant={onGreen ? 'quiet' : 'leaf'}
            className={onGreen ? 'border-white/40 bg-white/10 text-white' : undefined}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? 'Sending…' : shown ? changeLabel : label}
          </SmallButton>
        )}
        {shown && !busy && !failed && (
          <button
            type="button"
            onClick={() => {
              setPreview(null)
              setFailed(null)
              onChange(null)
            }}
            className={cx(
              'text-[12px] font-bold underline underline-offset-2',
              onGreen ? 'text-white/75' : 'text-mustache/55',
            )}
          >
            Remove
          </button>
        )}
        {error && (
          <span className={cx('text-[12px] font-bold', onGreen ? 'text-white' : 'text-coral')}>
            {error} — your photo is still here.
          </span>
        )}
      </div>
    </div>
  )
}
