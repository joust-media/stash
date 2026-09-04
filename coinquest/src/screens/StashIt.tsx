import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { money } from '../lib/format'
import { Keypad, pushDigit } from '../components/Keypad'
import { Mascot } from '../components/Mascot'
import { Money } from '../components/Money'
import { PhotoInput, type UploadedPhoto } from '../components/PhotoInput'
import { ReminderCard } from '../components/Reminder'
import { AcornDrop, BurrowScene } from '../components/StashScenery'
import {
  Button,
  Chip,
  ChoiceChip,
  Eyebrow,
  Screen,
  ScreenMessage,
  SmallButton,
  Spinner,
} from '../components/ui'

/** The server caps a single hand-over; say so before it has to. */
const CAP_CENTS = 100_000

type Beat = 'amount' | 'note' | 'drop' | 'sent'

/*
 * Stash it — the hand-over, as a walk into the burrow. Real cash is about to
 * change hands (or just did); this flow files the record of it and makes the
 * filing feel like what it is: tucking something away somewhere safe.
 *
 * Four beats on one screen: the amount, where it's from, the drop (an acorn
 * into the burrow), and the wait. The money itself only moves when a parent
 * confirms — that beat happens later, as the "it landed" moment on Home.
 */
export function StashIt() {
  const kidId = Number(useParams().kidId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [beat, setBeat] = useState<Beat>('amount')
  const [raw, setRaw] = useState('')
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState<UploadedPhoto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dropDone, setDropDone] = useState(false)

  const home = useQuery({ queryKey: ['kidHome', kidId], queryFn: () => api.kidHome(kidId) })
  const data = home.data
  const approver = data?.approverName ?? 'a parent'

  const cents = Math.round(Number(raw || 0) * 100)
  const overCap = cents > CAP_CENTS

  const request = useMutation({
    mutationFn: () =>
      api.requestDeposit({
        kidId,
        amountCents: cents,
        note: note.trim() || undefined,
        imageMediaId: photo?.id ?? null,
      }),
    onError: (err: Error) => {
      // The acorn comes back out: return to the form with the server's words.
      setDropDone(false)
      setBeat('note')
      setError(err.message)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kidHome', kidId] }),
  })

  // The drop finishes when both the animation and the request have landed.
  useEffect(() => {
    if (beat === 'drop' && dropDone && request.isSuccess) setBeat('sent')
  }, [beat, dropDone, request.isSuccess])

  const commit = () => {
    setError(null)
    request.mutate()
    setBeat('drop')
  }

  return (
    <Screen tone="green" tint={data?.kid.avatarColor}>
      {/* The environment persists across beats; the gulp holds its end state
          so the acorn the kid just added stays on the pile. */}
      <BurrowScene gulp={beat === 'drop' || beat === 'sent'} />

      {home.isPending && <Spinner onGreen />}
      {home.isError && <ScreenMessage onGreen>{(home.error as Error).message}</ScreenMessage>}

      {data && beat === 'amount' && (
        <div className="animate-fade relative flex flex-1 flex-col px-6 pb-5 [&>*]:shrink-0">
          <div className="flex items-center py-2">
            <button
              type="button"
              aria-label="Back to my stash"
              onClick={() => navigate(`/kid/${kidId}/bank`)}
              className="pressable flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-[18px] text-white"
            >
              ←
            </button>
          </div>

          <div className="flex flex-col items-center gap-2.5 pt-1 text-center">
            <Eyebrow onGreen>Stash it</Eyebrow>
            <h1 className="display text-[26px] leading-tight font-extrabold text-white">
              How much are you handing over?
            </h1>
            <Money cents={cents} size={58} tone="onGreen" sign="+" />
            <div className="flex gap-2">
              {[5, 10, 20].map((d) => (
                <ChoiceChip key={d} selected={cents === d * 100} onClick={() => setRaw(String(d))}>
                  ${d}
                </ChoiceChip>
              ))}
            </div>
          </div>

          <div className="mt-auto flex flex-col gap-3 pt-4">
            <Keypad
              onGreen
              onDigit={(d) => setRaw((v) => pushDigit(v, d))}
              onDot={() => setRaw((v) => (v.includes('.') ? v : (v || '0') + '.'))}
              onBackspace={() => setRaw((v) => v.slice(0, -1))}
            />
            <Button variant="onGreen" disabled={cents <= 0 || overCap} onClick={() => setBeat('note')}>
              {overCap ? `Keep it under ${money(CAP_CENTS)} at a time` : "That's the amount"}
            </Button>
          </div>
        </div>
      )}

      {data && beat === 'note' && (
        <div className="animate-fade relative flex flex-1 flex-col px-6 pb-5 [&>*]:shrink-0">
          <div className="flex flex-col items-center gap-2 pt-3 text-center">
            <Mascot pose="acorn-hug" height={104} />
            <Money cents={cents} size={44} tone="onGreen" sign="+" />
          </div>

          <div className="flex flex-col gap-2.5 pt-6">
            <Eyebrow onGreen>Where&rsquo;s it from? (optional)</Eyebrow>
            <input
              value={note}
              maxLength={240}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Birthday money from Grandma"
              className="rounded-inset border-line-cream bg-surface text-chestnut w-full border-2 px-4 py-3 text-[15px] font-bold outline-none"
            />
          </div>

          <div className="flex flex-col gap-2.5 pt-5">
            <Eyebrow onGreen>Snap the cash (optional)</Eyebrow>
            <PhotoInput actorId={kidId} value={photo} onChange={setPhoto} onGreen label="Take a photo" />
          </div>

          {error && <p className="pt-4 text-[14px] font-bold text-white">{error}</p>}

          <div className="mt-auto flex flex-col gap-2 pt-4">
            <Button variant="onGreen" disabled={request.isPending} onClick={commit}>
              {approver} has my {money(cents)}
            </Button>
            <p className="text-center text-[12px] text-white/80">
              {approver} confirms it and it lands in your stash.
            </p>
            <SmallButton
              variant="quiet"
              className="self-center border-white/30 text-white"
              onClick={() => setBeat('amount')}
            >
              Back
            </SmallButton>
          </div>
        </div>
      )}

      {beat === 'drop' && (
        <div className="relative flex flex-1 flex-col items-center pt-[26vh]">
          <div className="animate-shrink-away">
            <Money cents={cents} size={58} tone="onGreen" sign="+" />
          </div>
          <div className="pt-2">
            <AcornDrop onDone={() => setDropDone(true)} />
          </div>
          {/* A slow request keeps us here past the drop; say something soft. */}
          {dropDone && !request.isSuccess && !request.isError && (
            <span className="animate-fade pt-10 text-[14px] text-white/80">Tucking it away…</span>
          )}
        </div>
      )}

      {data && beat === 'sent' && (
        <div className="animate-fade-up relative flex flex-1 flex-col px-6 pb-5 [&>*]:shrink-0">
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <Mascot pose="acorn-hug" height={148} />
            <h1 className="display text-[28px] leading-tight font-extrabold text-white">
              Tucked away &mdash; almost.
            </h1>
            <Money cents={cents} size={42} tone="onGreen" sign="+" />
            <Chip onGreen>Waiting on {approver}</Chip>
            <p className="max-w-[280px] text-[14px] leading-[1.5] text-white/85">
              Your cash is in {approver}&rsquo;s hands. The second they say &ldquo;got it&rdquo;, it
              lands in your stash.
            </p>
          </div>

          <div className="flex flex-col gap-3 pb-2">
            <ReminderCard
              kidId={kidId}
              approverName={approver}
              remaining={data.remindersLeftToday}
              onGreen
            />
            <Button variant="onGreen" onClick={() => navigate(`/kid/${kidId}/bank`)}>
              Back to my stash
            </Button>
          </div>
        </div>
      )}
    </Screen>
  )
}
