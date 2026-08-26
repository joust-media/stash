import { Hono } from 'hono'
import { all, one, run } from '../db.ts'
import { HttpError, elapsedLabel, periodKeyFor, requireKid, type UserRow } from '../lib.ts'

export const taskRoutes = new Hono()

interface ChoreRow {
  id: number
  title: string
  reward_cents: number
  schedule: 'daily' | 'weekly' | 'once'
  schedule_detail: string | null
  active: number
}

/*
 * A task runs Start → End. Start reserves the slot and stamps `started_at`;
 * End is what puts it in front of a parent. Nothing reaches the approval queue
 * until End, so a task a kid is midway through is not pestering anyone.
 */

async function loadChore(choreId: number, kid: UserRow): Promise<ChoreRow> {
  const chore = await one<ChoreRow>('SELECT * FROM chores WHERE id = ?', [Number(choreId)])
  if (!chore) throw new HttpError(404, 'That achievement does not exist')
  if (!chore.active) throw new HttpError(400, 'That achievement is paused')

  const assigned = await one('SELECT 1 AS ok FROM chore_assignments WHERE chore_id = ? AND kid_id = ?', [
    chore.id,
    kid.id,
  ])
  if (!assigned) throw new HttpError(403, 'That one is not on your list')
  return chore
}

/** POST /api/completions/start — the kid begins a task. No parent involved yet. */
taskRoutes.post('/completions/start', async (c) => {
  const { choreId, kidId } = await c.req.json<{ choreId: number; kidId: number }>()
  const kid = await requireKid(Number(kidId))
  const chore = await loadChore(choreId, kid)

  const periodKey = periodKeyFor(chore.schedule, new Date())
  const existing = await one<{ id: number; status: string }>(
    `SELECT id, status FROM task_completions
      WHERE chore_id = ? AND kid_id = ? AND period_key = ? AND status <> 'rejected'`,
    [chore.id, kid.id, periodKey],
  )
  if (existing) {
    throw new HttpError(409, existing.status === 'in_progress' ? 'Already started' : 'Already done')
  }

  const result = await run(
    `INSERT INTO task_completions (chore_id, kid_id, started_at, status, period_key)
     VALUES (?, ?, ?, 'in_progress', ?)`,
    [chore.id, kid.id, new Date(), periodKey],
  )

  return c.json({
    completionId: result.insertId,
    choreTitle: chore.title,
    rewardCents: Number(chore.reward_cents),
  })
})

/**
 * POST /api/completions/:id/end — the kid is finished. This is the moment the
 * parent is alerted: the completion moves to `pending` and joins the queue.
 */
taskRoutes.post('/completions/:id/end', async (c) => {
  const { kidId } = await c.req.json<{ kidId: number }>()
  const kid = await requireKid(Number(kidId))
  const id = Number(c.req.param('id'))

  const row = await one<{ id: number; kid_id: number; status: string; started_at: Date | null }>(
    'SELECT id, kid_id, status, started_at FROM task_completions WHERE id = ?',
    [id],
  )
  if (!row) throw new HttpError(404, 'That is not on your list')
  if (Number(row.kid_id) !== kid.id) throw new HttpError(403, 'That is not yours to finish')
  if (row.status !== 'in_progress') throw new HttpError(409, 'That one is not in progress')

  await run(`UPDATE task_completions SET status = 'pending', completed_at = ? WHERE id = ?`, [
    new Date(),
    id,
  ])

  const chore = await one<{ title: string; reward_cents: number }>(
    `SELECT ch.title, ch.reward_cents FROM task_completions tc
       JOIN chores ch ON ch.id = tc.chore_id WHERE tc.id = ?`,
    [id],
  )

  const parents = await all<UserRow>(
    `SELECT * FROM users WHERE family_id = ? AND role = 'parent' ORDER BY id`,
    [kid.family_id],
  )

  const now = new Date()
  const next = await one<{ id: number; title: string }>(
    `SELECT c.id, c.title
       FROM chores c
       JOIN chore_assignments ca ON ca.chore_id = c.id AND ca.kid_id = ?
       LEFT JOIN task_completions tc
              ON tc.chore_id = c.id AND tc.kid_id = ca.kid_id AND tc.status <> 'rejected'
             AND tc.period_key = CASE c.schedule WHEN 'daily' THEN ? WHEN 'weekly' THEN ? ELSE 'once' END
      WHERE c.active = 1 AND tc.id IS NULL
      ORDER BY c.id LIMIT 1`,
    [kid.id, periodKeyFor('daily', now), periodKeyFor('weekly', now)],
  )

  return c.json({
    completionId: id,
    kidName: kid.nickname || kid.name,
    choreTitle: chore?.title ?? 'Achievement',
    rewardCents: Number(chore?.reward_cents ?? 0),
    approverName: parents[0]?.name ?? 'a parent',
    tookLabel: row.started_at ? elapsedLabel(row.started_at) : null,
    nextTask: next ? { choreId: Number(next.id), title: next.title } : null,
  })
})

/** POST /api/completions/:id/cancel — started by mistake; frees the slot. */
taskRoutes.post('/completions/:id/cancel', async (c) => {
  const { kidId } = await c.req.json<{ kidId: number }>()
  const kid = await requireKid(Number(kidId))
  const id = Number(c.req.param('id'))

  const result = await run(
    `DELETE FROM task_completions WHERE id = ? AND kid_id = ? AND status = 'in_progress'`,
    [id, kid.id],
  )
  if (result.affectedRows === 0) throw new HttpError(409, 'That one is not in progress')
  return c.json({ ok: true })
})
