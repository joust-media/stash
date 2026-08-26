import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useSession } from '../lib/session'
import { money } from '../lib/format'
import { Keypad } from '../components/Keypad'
import { Money } from '../components/Money'
import {
  Avatar,
  Button,
  ChoiceChip,
  Eyebrow,
  FIELD_CLASS,
  Screen,
  ScreenMessage,
  Spinner,
} from '../components/ui'
import { Hero } from '../components/Hero'
import { HERO_POSE } from '../components/Mascot'

const QUICK = [500, 1000, 2000, 5000]

/** Appends a keypad digit while keeping the value a valid money string. */
function pushDigit(value: string, digit: string): string {
  if (value.includes('.') && value.split('.')[1].length >= 2) return value
  if (value === '0') return digit
  return value + digit
}

/** 04 — Deposit cash: parent-only, writes a deposit transaction. */
export function Deposit() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { parent } = useSession()
  const [params] = useSearchParams()

  const [raw, setRaw] = useState('')
  const [note, setNote] = useState('')
  const [pickingKid, setPickingKid] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(
    params.get('kidId') ? Number(params.get('kidId')) : null,
  )
  const [error, setError] = useState<string | null>(null)

  const family = useQuery({ queryKey: ['family'], queryFn: api.family })
  const kids = family.data?.kids ?? []
  const kid = kids.find((k) => k.id === selectedId) ?? kids[0]

  const cents = Math.round(Number(raw || 0) * 100)

  const deposit = useMutation({
    mutationFn: () =>
      api.deposit({ kidId: kid!.id, amountCents: cents, note: note.trim(), parentId: parent!.id }),
    onError: (err: Error) => setError(err.message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family'] })
      queryClient.invalidateQueries({ queryKey: ['kidHome', kid!.id] })
      queryClient.invalidateQueries({ queryKey: ['ledger'] })
      navigate('/parent')
    },
  })

  return (
    <Screen
      hero={
        <Hero
          eyebrow="Parent mode"
          title="Add cash"
          subtitle="Goes straight into their stash."
          pose={HERO_POSE.parentFamily}
          back="/parent"
        />
      }
    >

      {family.isPending && <Spinner />}
      {family.isError && <ScreenMessage>{(family.error as Error).message}</ScreenMessage>}

      {kid && (
        <div className="flex flex-1 flex-col gap-5 overflow-hidden px-7 pt-1">
          <div className="flex shrink-0 flex-col gap-2">
            <button
              type="button"
              onClick={() => setPickingKid((open) => !open)}
              className="liftable bg-surface rounded-card flex w-full items-center gap-3 px-4 py-3.5 shadow-[var(--shadow-card)]"
            >
              <Avatar initial={kid.initial} color={kid.avatarColor} size={40} />
              <span className="display text-chestnut flex-1 text-left text-[19px] font-bold">{kid.name}</span>
              <Money cents={kid.balanceCents} size={24} />
              <span className="text-mustache/50 text-[12px]">{pickingKid ? '▲' : '▼'}</span>
            </button>

            {pickingKid && (
              <div className="animate-fade-up flex flex-col gap-2">
                {kids
                  .filter((k) => k.id !== kid.id)
                  .map((k) => (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(k.id)
                        setPickingKid(false)
                      }}
                      className="liftable bg-surface rounded-card flex items-center gap-3 px-4 py-3.5 shadow-[var(--shadow-card)]"
                    >
                      <Avatar initial={k.initial} color={k.avatarColor} size={40} />
                      <span className="display text-chestnut flex-1 text-left text-[19px] font-bold">
                        {k.name}
                      </span>
                      <Money cents={k.balanceCents} size={24} />
                    </button>
                  ))}
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-center gap-3">
            <Eyebrow>How much?</Eyebrow>
            <Money cents={cents} size={58} />
            <div className="flex gap-2">
              {QUICK.map((q) => (
                <ChoiceChip
                  key={q}
                  selected={cents === q}
                  onClick={() => {
                    setError(null)
                    setRaw(String(q / 100))
                  }}
                >
                  ${q / 100}
                </ChoiceChip>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2">
            <Eyebrow>Note</Eyebrow>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Birthday money from Grandma"
              className={FIELD_CLASS}
            />
          </div>

          {error && <p className="text-coral shrink-0 text-[14px] font-bold">{error}</p>}

          <div className="mt-auto shrink-0 pb-2">
            <Keypad
              onDigit={(d) => {
                setError(null)
                setRaw((v) => pushDigit(v, d))
              }}
              onDot={() => setRaw((v) => (v.includes('.') ? v : (v || '0') + '.'))}
              onBackspace={() => setRaw((v) => v.slice(0, -1))}
            />
          </div>
        </div>
      )}

      {kid && (
        <div className="shrink-0 px-7 pt-3 pb-6">
          <Button disabled={cents <= 0 || deposit.isPending} onClick={() => deposit.mutate()}>
            {cents > 0 ? `Add ${money(cents)} to ${kid.name}'s stash` : 'Enter an amount'}
          </Button>
        </div>
      )}
    </Screen>
  )
}
