import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useSession } from '../lib/session'
import { money } from '../lib/format'
import { Hero } from '../components/Hero'
import { HERO_POSE } from '../components/Mascot'
import { Money } from '../components/Money'
import {
  Avatar,
  Card,
  Chip,
  Eyebrow,
  PARENT_TABS,
  Screen,
  ScreenMessage,
  SmallButton,
  Spinner,
  TabBar,
} from '../components/ui'

/** 07 — Parent family overview. Calm and plain, per the parent voice pillar. */
export function ParentOverview() {
  const navigate = useNavigate()
  const { parent, lock } = useSession()

  const { data, isPending, isError, error } = useQuery({ queryKey: ['family'], queryFn: api.family })

  const waiting = (data?.pendingTotal ?? 0) + (data?.pendingWithdrawals.length ?? 0)

  return (
    <Screen
      hero={
        <Hero
          eyebrow="Parent mode"
          title={data?.family.name ?? 'Family'}
          pose={parent?.mascotPose ?? HERO_POSE.parentFamily}
          action={
            <button
              type="button"
              onClick={() => {
                lock()
                navigate('/')
              }}
              title="Leave parent mode"
              className="transition-opacity hover:opacity-75"
            >
              <Chip onGreen>Sign out</Chip>
            </button>
          }
        >
          {data && (
            <div className="flex w-full flex-col items-center gap-1 pt-1">
              <Money cents={data.totalHeldCents} size={44} tone="onGreen" />
              <p className="text-[13px] text-white/85">
                {data.kids.length} kids · {money(data.weekDeltaCents)} earned this week
              </p>
            </div>
          )}
        </Hero>
      }
    >
      {isPending && <Spinner />}
      {isError && <ScreenMessage>{(error as Error).message}</ScreenMessage>}

      {data && (
        <div className="scroll-y animate-fade -mx-1 flex flex-1 flex-col gap-4 px-6 pt-4 pb-5 [&>*]:shrink-0">
          {waiting > 0 && (
            <button
              type="button"
              onClick={() => navigate('/parent/approvals')}
              className="liftable rounded-card bg-gold/18 border-gold/45 flex items-center gap-3.5 border-2 p-4 text-left"
            >
              <span className="bg-gold text-mustache display flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[19px] font-extrabold">
                {waiting}
              </span>
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="display text-chestnut text-[19px] leading-tight font-bold">
                  Waiting on you
                </span>
                <span className="text-mustache/70 text-[13px] leading-tight">
                  {[
                    data.pendingTotal > 0 && `${data.pendingTotal} achievement${data.pendingTotal === 1 ? '' : 's'}`,
                    data.pendingWithdrawals.length > 0 &&
                      `${data.pendingWithdrawals.length} cash request${data.pendingWithdrawals.length === 1 ? '' : 's'}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <span className="text-leaf-deep text-[14px] font-extrabold">Review →</span>
            </button>
          )}

          <section className="flex flex-col gap-2.5">
            <Eyebrow>Kids</Eyebrow>
            {data.kids.map((kid) => (
              <Card key={kid.id} onClick={() => navigate(`/kid/${kid.id}`)} className="p-4">
                <div className="flex items-center gap-3.5">
                  <Avatar initial={kid.initial} color={kid.avatarColor} size={46} />
                  <div className="flex flex-1 flex-col gap-0.5">
                    <span className="display text-chestnut text-[19px] leading-tight font-bold">
                      {kid.nickname || kid.name}
                      {kid.age !== null && ` · ${kid.age}`}
                    </span>
                    <span className="text-mustache/70 text-[13px] leading-tight">
                      {kid.openCount === 0 && kid.pendingCount === 0
                        ? 'All done this week'
                        : `${kid.choresThisWeek} done this week · ${kid.pendingCount} waiting`}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <Money cents={kid.balanceCents} size={24} />
                    <span
                      className={
                        kid.goal ? 'text-leaf-deep text-[12px] font-bold' : 'text-mustache/50 text-[12px]'
                      }
                    >
                      {kid.goal ? `Goal ${kid.goal.progressPct}%` : 'No goal yet'}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </section>

          <div className="grid grid-cols-2 gap-2.5">
            <SmallButton variant="quiet" onClick={() => navigate('/parent/deposit')}>
              Add cash
            </SmallButton>
            <SmallButton variant="quiet" onClick={() => navigate('/parent/admin?new=1')}>
              New achievement
            </SmallButton>
          </div>
        </div>
      )}

      <TabBar tabs={PARENT_TABS} />
    </Screen>
  )
}
