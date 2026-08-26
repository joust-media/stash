import { Hono } from 'hono'
import { all, one, tx } from '../db.ts'
import type { Goal, GoalRow } from '../../shared/types.ts'
import { HttpError, balanceOf, getUser, requireKid, requireParent, toGoal } from '../lib.ts'

export const goalRoutes = new Hono()

/*
 * Goals belong to the kid. They can keep as many as they like — a bike, a game,
 * a trip — and exactly one is `active`, which is the one the trackers follow.
 *
 * A kid may create and edit their own; a parent may do it for anyone in the
 * family. The server decides, not the screen.
 */

async function requireGoalActor(actorId: unknown, kidId: number) {
  const actor = await getUser(Number(actorId))
  if (!actor) throw new HttpError(403, 'Who is making this change?')
  if (actor.role !== 'parent' && actor.id !== kidId) {
    throw new HttpError(403, 'You can only change your own goals')
  }
  return actor
}

function validate(body: { title?: string; targetCents?: number }) {
  const title = body.title?.trim()
  const target = Math.round(Number(body.targetCents))
  if (!title) throw new HttpError(400, 'What are you saving for?')
  if (title.length > 120) throw new HttpError(400, 'That name is a bit long')
  if (!Number.isFinite(target) || target <= 0) throw new HttpError(400, 'How much does it cost?')
  if (target > 100_000_00) throw new HttpError(400, 'That target is too big')
  return { title, target }
}

/** GET /api/kids/:kidId/goals — one kid's goals, the active one first. */
goalRoutes.get('/kids/:kidId', async (c) => {
  const kid = await requireKid(Number(c.req.param('kidId')))
  const balance = await balanceOf(kid.id)
  const rows = await all('SELECT * FROM goals WHERE kid_id = ? ORDER BY active DESC, id', [kid.id])
  return c.json(rows.map((r) => toGoal(r as never, balance)) satisfies Goal[])
})

/** GET /api/goals — every kid's goals, for the parent admin. */
goalRoutes.get('/', async (c) => {
  const rows = await all(
    `SELECT g.*, u.name AS kid_name FROM goals g
       JOIN users u ON u.id = g.kid_id
      ORDER BY u.id, g.active DESC, g.id`,
  )

  const out: GoalRow[] = []
  for (const r of rows) {
    const balance = await balanceOf(Number(r.kid_id))
    out.push({
      id: Number(r.id),
      kidId: Number(r.kid_id),
      kidName: r.kid_name,
      title: r.title,
      targetCents: Number(r.target_cents),
      active: Boolean(r.active),
      progressPct: Math.min(100, Math.round((balance / Number(r.target_cents)) * 100)),
    })
  }
  return c.json(out)
})

interface GoalBody {
  actorId: number
  kidId: number
  title: string
  targetCents: number
  icon?: string | null
  /** Make this the tracked goal. The first goal always is. */
  active?: boolean
}

/** POST /api/goals */
goalRoutes.post('/', async (c) => {
  const body = await c.req.json<GoalBody & { parentId?: number }>()
  const kid = await requireKid(Number(body.kidId))
  await requireGoalActor(body.actorId ?? body.parentId, kid.id)
  const { title, target } = validate(body)

  const id = await tx(async (conn) => {
    const [existing] = await conn.query('SELECT COUNT(*) AS n FROM goals WHERE kid_id = ?', [kid.id])
    const isFirst = Number((existing as { n: number }[])[0]?.n ?? 0) === 0
    const makeActive = body.active ?? isFirst

    if (makeActive) await conn.query('UPDATE goals SET active = 0 WHERE kid_id = ?', [kid.id])

    const [result] = await conn.query(
      'INSERT INTO goals (kid_id, title, target_cents, icon, active) VALUES (?, ?, ?, ?, ?)',
      [kid.id, title, target, body.icon || null, makeActive ? 1 : 0],
    )
    return Number((result as { insertId: number }).insertId)
  })
  return c.json({ id }, 201)
})

/** PUT /api/goals/:id — edit, and optionally make it the tracked one. */
goalRoutes.put('/:id', async (c) => {
  const body = await c.req.json<GoalBody & { parentId?: number }>()
  const id = Number(c.req.param('id'))

  const existing = await one<{ kid_id: number }>('SELECT kid_id FROM goals WHERE id = ?', [id])
  if (!existing) throw new HttpError(404, 'That goal does not exist')
  await requireGoalActor(body.actorId ?? body.parentId, Number(existing.kid_id))
  const { title, target } = validate(body)

  await tx(async (conn) => {
    if (body.active) {
      await conn.query('UPDATE goals SET active = 0 WHERE kid_id = ?', [existing.kid_id])
    }
    await conn.query(
      `UPDATE goals SET title = ?, target_cents = ?, icon = ?${body.active ? ', active = 1' : ''}
        WHERE id = ?`,
      [title, target, body.icon || null, id],
    )
  })
  return c.json({ ok: true })
})

/** PATCH /api/goals/:id/active — switch which goal the trackers follow. */
goalRoutes.patch('/:id/active', async (c) => {
  const body = await c.req.json<{ actorId: number }>()
  const id = Number(c.req.param('id'))

  const existing = await one<{ kid_id: number }>('SELECT kid_id FROM goals WHERE id = ?', [id])
  if (!existing) throw new HttpError(404, 'That goal does not exist')
  await requireGoalActor(body.actorId, Number(existing.kid_id))

  await tx(async (conn) => {
    await conn.query('UPDATE goals SET active = 0 WHERE kid_id = ?', [existing.kid_id])
    await conn.query('UPDATE goals SET active = 1 WHERE id = ?', [id])
  })
  return c.json({ ok: true })
})

goalRoutes.delete('/:id', async (c) => {
  const body = await c.req.json<{ actorId?: number; parentId?: number }>()
  const id = Number(c.req.param('id'))

  const existing = await one<{ kid_id: number; active: number }>(
    'SELECT kid_id, active FROM goals WHERE id = ?',
    [id],
  )
  if (!existing) throw new HttpError(404, 'That goal does not exist')
  await requireGoalActor(body.actorId ?? body.parentId, Number(existing.kid_id))

  await tx(async (conn) => {
    await conn.query('DELETE FROM goals WHERE id = ?', [id])
    // Never leave a kid with goals but nothing being tracked.
    if (existing.active) {
      await conn.query('UPDATE goals SET active = 1 WHERE kid_id = ? ORDER BY id LIMIT 1', [existing.kid_id])
    }
  })
  return c.json({ ok: true })
})

export { requireParent }
