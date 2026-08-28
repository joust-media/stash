import { Hono } from 'hono'
import { all, one } from '../db.ts'
import { achievementMilestone, savingsMilestone } from '../milestones.ts'
import { suggestionsFor } from './goodStuff.ts'
import type {
  KidHome,
  KidRequest,
  Ledger,
  LedgerEntry,
  LedgerGroup,
  TaskRow,
  TxType,
} from '../../shared/types.ts'
import {
  balanceOf,
  dayLabel,
  elapsedLabel,
  goalFor,
  goalsFor,
  iso,
  periodKeyFor,
  requireKid,
  scheduleLabel,
  timeLabel,
  toPerson,
  windowStart,
  type UserRow,
} from '../lib.ts'

export const kidRoutes = new Hono()

/** GET /api/kids/:id/home — the stash, the goal, and today's list. */
kidRoutes.get('/:id/home', async (c) => {
  const kid = await requireKid(Number(c.req.param('id')))
  const now = new Date()

  const rows = await all(
    `SELECT c.id, c.title, c.reward_cents, c.schedule, c.schedule_detail, c.icon,
            tc.id AS completion_id, tc.status, tc.started_at
       FROM chores c
       JOIN chore_assignments ca ON ca.chore_id = c.id AND ca.kid_id = ?
       LEFT JOIN task_completions tc
              ON tc.chore_id = c.id AND tc.kid_id = ca.kid_id AND tc.status <> 'rejected'
             AND tc.period_key = CASE c.schedule WHEN 'daily' THEN ? WHEN 'weekly' THEN ? ELSE 'once' END
      WHERE c.active = 1
      ORDER BY (tc.id IS NOT NULL), c.id`,
    [kid.id, periodKeyFor('daily', now), periodKeyFor('weekly', now)],
  )

  const tasks: TaskRow[] = rows
    // A finished one-time task drops off entirely; recurring ones stay visible
    // for the rest of their period so the kid sees what they have done.
    .filter((r) => !(r.schedule === 'once' && r.status === 'approved'))
    .map((r) => ({
      choreId: Number(r.id),
      title: r.title,
      rewardCents: Number(r.reward_cents),
      scheduleLabel: scheduleLabel(r.schedule, r.schedule_detail),
      icon: r.icon ?? null,
      completionId: r.completion_id === null ? null : Number(r.completion_id),
      status: r.status ?? null,
      startedAt: r.started_at ? iso(r.started_at) : null,
      startedLabel: r.status === 'in_progress' && r.started_at ? elapsedLabel(r.started_at) : null,
    }))

  const balanceCents = await balanceOf(kid.id)

  const [parents, finished, held, waitingTasks, waitingCash] = await Promise.all([
    all<UserRow>(`SELECT * FROM users WHERE family_id = ? AND role = 'parent' ORDER BY id`, [
      kid.family_id,
    ]),
    one<{ n: number }>(
      `SELECT COUNT(*) AS n FROM task_completions WHERE kid_id = ? AND status = 'approved'`,
      [kid.id],
    ),
    one<{ n: number }>(
      `SELECT COALESCE(SUM(amount_cents), 0) AS n
         FROM withdrawal_requests WHERE kid_id = ? AND status = 'pending'`,
      [kid.id],
    ),
    all(
      `SELECT tc.id, tc.completed_at, ch.title, ch.reward_cents, ch.icon
         FROM task_completions tc JOIN chores ch ON ch.id = tc.chore_id
        WHERE tc.kid_id = ? AND tc.status = 'pending'
        ORDER BY tc.completed_at DESC`,
      [kid.id],
    ),
    all(
      `SELECT id, amount_cents, category, requested_at
         FROM withdrawal_requests WHERE kid_id = ? AND status = 'pending'
        ORDER BY requested_at DESC`,
      [kid.id],
    ),
  ])

  // Everything the kid is waiting on, both directions, newest first.
  const requests: KidRequest[] = [
    ...waitingTasks.map((r) => ({
      kind: 'achievement' as const,
      id: Number(r.id),
      title: r.title as string,
      amountCents: Number(r.reward_cents),
      icon: (r.icon as string | null) ?? null,
      at: iso(r.completed_at),
      timeLabel: timeLabel(r.completed_at),
    })),
    ...waitingCash.map((r) => ({
      kind: 'withdrawal' as const,
      id: Number(r.id),
      title: r.category as string,
      amountCents: -Number(r.amount_cents),
      icon: null,
      at: iso(r.requested_at),
      timeLabel: timeLabel(r.requested_at),
    })),
  ].sort((a, b) => b.at.localeCompare(a.at))

  const payload: KidHome = {
    kid: toPerson(kid),
    balanceCents,
    goal: await goalFor(kid.id, balanceCents),
    goals: await goalsFor(kid.id, balanceCents),
    tasks,
    doneCount: tasks.filter((t) => t.status !== null).length,
    totalCount: tasks.length,
    remainingCents: tasks.filter((t) => t.status === null).reduce((s, t) => s + t.rewardCents, 0),
    approverName: parents[0]?.name ?? 'a parent',
    achievement: achievementMilestone(Number(finished?.n ?? 0)),
    savings: savingsMilestone(balanceCents),
    heldCents: Number(held?.n ?? 0),
    requests,
    // Filtered in SQL — a sibling's suggestions never reach this client.
    suggestions: await suggestionsFor(kid.id, Number(kid.family_id)),
  }
  return c.json(payload)
})

const FILTERS: Record<string, TxType | null> = {
  all: null,
  earned: 'earn',
  deposits: 'deposit',
  withdrawn: 'withdraw',
}

/** GET /api/kids/:id/ledger?filter=all|earned|deposits|withdrawn */
kidRoutes.get('/:id/ledger', async (c) => {
  const kid = await requireKid(Number(c.req.param('id')))
  const filter = c.req.query('filter') ?? 'all'
  if (!(filter in FILTERS)) return c.json({ error: 'Unknown filter' }, 400)
  const type = FILTERS[filter]

  const rows = await all(
    `SELECT t.*, ch.title AS chore_title,
            reviewer.name AS reviewer_name,
            creator.name  AS creator_name,
            g.title AS goal_title, g.match_amount_cents
       FROM transactions t
       LEFT JOIN task_completions tc ON tc.id = t.related_completion_id
       LEFT JOIN chores ch          ON ch.id = tc.chore_id
       LEFT JOIN users reviewer     ON reviewer.id = tc.reviewed_by
       LEFT JOIN users creator      ON creator.id = t.created_by
       LEFT JOIN goals g            ON g.id = t.goal_id
      WHERE t.kid_id = ? AND (? IS NULL OR t.type = ?)
      ORDER BY t.id DESC`,
    [kid.id, type, type],
  )

  const groups: LedgerGroup[] = []
  for (const r of rows) {
    const entry: LedgerEntry = {
      id: Number(r.id),
      type: r.type,
      title:
        r.type === 'earn'
          ? (r.chore_title ?? 'Achievement')
          : r.type === 'deposit'
            ? 'Cash added'
            : (r.goal_title ?? r.category ?? 'Taken out'),
      meta:
        r.type === 'earn'
          ? `Achievement · approved by ${r.reviewer_name ?? 'a parent'}`
          : r.type === 'deposit'
            ? (r.note ?? `Added by ${r.creator_name ?? 'a parent'}`)
            : // A matched claim says so, because the kid only paid their share.
              r.goal_title && Number(r.match_amount_cents) > 0
              ? `Your half · handed over by ${r.creator_name ?? 'a parent'}`
              : `Taken out · handed over by ${r.creator_name ?? 'a parent'}`,
      amountCents: Number(r.amount_cents),
      balanceAfterCents: Number(r.balance_after_cents),
      createdAt: iso(r.created_at),
    }
    const label = dayLabel(r.created_at)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.entries.push(entry)
    else groups.push({ label, entries: [entry] })
  }

  // The summary strip always reflects the full rolling week, not the filter.
  const sums = await all<{ type: TxType; n: number }>(
    `SELECT type, COALESCE(SUM(amount_cents), 0) AS n
       FROM transactions WHERE kid_id = ? AND created_at >= ? GROUP BY type`,
    [kid.id, windowStart()],
  )

  const by = (t: TxType) => Number(sums.find((s) => s.type === t)?.n ?? 0)
  const earned = by('earn')
  const spent = Math.abs(by('withdraw'))
  const inflow = earned + by('deposit')

  const payload: Ledger = {
    groups,
    weekly: {
      earnedCents: earned,
      spentCents: spent,
      savedPct: inflow > 0 ? Math.round((1 - spent / inflow) * 100) : null,
    },
  }
  return c.json(payload)
})
