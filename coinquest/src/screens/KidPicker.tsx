import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { Mascot } from '../components/Mascot'
import { Money } from '../components/Money'
import { Avatar, Button, Screen, ScreenMessage, Spinner, TextLink, Wordmark } from '../components/ui'

/** 01 — Welcome. The canonical Leaf Green layout: wordmark, tagline, Stash, cards. */
export function KidPicker() {
  const navigate = useNavigate()
  const { data, isPending, isError, error } = useQuery({ queryKey: ['family'], queryFn: api.family })

  return (
    <Screen tone="green">
      <div className="relative flex flex-1 flex-col items-center gap-4 px-6 pt-6 pb-4">
        <div className="flex flex-col items-center gap-1.5">
          <Wordmark size={46} />
          <p className="text-[17px] font-bold text-white/90">Earn it. Save it. Stash it.</p>
        </div>

        <Mascot pose="coin-toss" height={168} />

        {isPending && <Spinner onGreen />}
        {isError && <ScreenMessage onGreen>{(error as Error).message}</ScreenMessage>}

        {data && (
          <div className="scroll-y flex w-full flex-col gap-3">
            {data.kids.map((kid) => (
              <button
                key={kid.id}
                type="button"
                onClick={() => navigate(`/kid/${kid.id}`)}
                className="liftable rounded-card flex w-full items-center gap-4 bg-white px-5 py-4 text-left shadow-[var(--shadow-button)]"
              >
                <Avatar initial={kid.initial} color={kid.avatarColor} size={48} />
                <span className="flex flex-1 flex-col gap-0.5">
                  <span className="display text-chestnut text-[21px] leading-tight font-bold">{kid.name}</span>
                  <span className="text-mustache/70 text-[14px] leading-tight">
                    {kid.openCount > 0
                      ? `${kid.openCount} to go today`
                      : 'All done — nice work'}
                  </span>
                </span>
                <Money cents={kid.balanceCents} size={27} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative flex shrink-0 flex-col gap-2 px-6 pb-6">
        <Button variant="onGreen" onClick={() => navigate('/parent/pin')}>
          Parent &amp; admin
        </Button>
        <TextLink onGreen onClick={() => navigate('/parent/pin?to=admin')}>
          Manage achievements
        </TextLink>
      </div>
    </Screen>
  )
}
