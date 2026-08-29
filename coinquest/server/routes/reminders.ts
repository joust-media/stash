import { Hono } from 'hono'
import { one, run } from '../db.ts'
import { HttpError, requireKid } from '../lib.ts'

export const reminderRoutes = new Hono()

/*
 * Stash carries the message. When something is waiting on a parent, the kid can
 * send him to go remind them — twice a day, no more. The cap is the feature:
 * a reminder that can be spammed stops being a reminder and starts being
 * pestering, which teaches exactly the wrong lesson about asking for money.
 */

export const REMINDERS_PER_DAY = 2

function todayStart(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export async function remindersUsedToday(kidId: number): Promise<number> {
  const row = await one<{ n: number }>(
    'SELECT COUNT(*) AS n FROM reminders WHERE kid_id = ? AND created_at >= ?',
    [kidId, todayStart()],
  )
  return Number(row?.n ?? 0)
}

/** POST /api/reminders — send Stash off to nudge whoever approves things. */
reminderRoutes.post('/', async (c) => {
  const { kidId } = await c.req.json<{ kidId: number }>()
  const kid = await requireKid(Number(kidId))

  // No pending anything means there is nothing to remind anyone about.
  const waiting = await one<{ n: number }>(
    `SELECT (SELECT COUNT(*) FROM task_completions   WHERE kid_id = ? AND status = 'pending')
          + (SELECT COUNT(*) FROM withdrawal_requests WHERE kid_id = ? AND status = 'pending') AS n`,
    [kid.id, kid.id],
  )
  if (Number(waiting?.n ?? 0) === 0) {
    throw new HttpError(400, 'Nothing is waiting right now — Stash has nowhere to go')
  }

  const used = await remindersUsedToday(kid.id)
  if (used >= REMINDERS_PER_DAY) {
    throw new HttpError(429, 'Stash has already gone twice today. He heads out again tomorrow.')
  }

  await run('INSERT INTO reminders (kid_id) VALUES (?)', [kid.id])
  return c.json({ remainingToday: REMINDERS_PER_DAY - used - 1 })
})
