import { Hono } from 'hono'
import { all, one, run, tx } from '../db.ts'
import type { ChoreCard, Schedule } from '../../shared/types.ts'
import { HttpError, requireParent, scheduleChip, toPerson, type UserRow } from '../lib.ts'

export const choreRoutes = new Hono()

const SCHEDULES: Schedule[] = ['daily', 'weekly', 'once']

async function cardsFor(kidId?: number): Promise<ChoreCard[]> {
  const chores = await all(
    kidId
      ? `SELECT c.* FROM chores c
           JOIN chore_assignments ca ON ca.chore_id = c.id AND ca.kid_id = ?
          ORDER BY c.active DESC, c.id`
      : `SELECT * FROM chores ORDER BY active DESC, id`,
    kidId ? [kidId] : [],
  )
  if (chores.length === 0) return []

  const ids = chores.map((c) => Number(c.id))
  const placeholders = ids.map(() => '?').join(',')

  const [assignees, counts] = await Promise.all([
    all(
      `SELECT ca.chore_id, u.* FROM chore_assignments ca
         JOIN users u ON u.id = ca.kid_id
        WHERE ca.chore_id IN (${placeholders})
        ORDER BY u.id`,
      ids,
    ),
    all<{ chore_id: number; n: number }>(
      `SELECT chore_id, COUNT(*) AS n FROM task_completions
        WHERE chore_id IN (${placeholders}) GROUP BY chore_id`,
      ids,
    ),
  ])

  return chores.map((c) => ({
    id: Number(c.id),
    title: c.title,
    rewardCents: Number(c.reward_cents),
    schedule: c.schedule as Schedule,
    scheduleDetail: c.schedule_detail,
    scheduleLabel: scheduleChip(c.schedule, c.schedule_detail, Boolean(c.active)),
    icon: c.icon ?? null,
    description: (c.description as string | null) ?? null,
    active: Boolean(c.active),
    assignees: assignees
      .filter((a) => Number(a.chore_id) === Number(c.id))
      .map((a) => toPerson(a as unknown as UserRow)),
    completionCount: Number(counts.find((n) => Number(n.chore_id) === Number(c.id))?.n ?? 0),
  }))
}

/** GET /api/chores?kidId= */
choreRoutes.get('/', async (c) => {
  const kidId = c.req.query('kidId')
  return c.json(await cardsFor(kidId ? Number(kidId) : undefined))
})

interface ChoreBody {
  parentId: number
  title: string
  rewardCents: number
  schedule: Schedule
  scheduleDetail?: string | null
  icon?: string | null
  /** What finishing it means — shown to the kid before they start. */
  description?: string | null
  kidIds: number[]
}

function validate(body: Partial<ChoreBody>) {
  const title = body.title?.trim()
  const reward = Math.round(Number(body.rewardCents))
  if (!title) throw new HttpError(400, 'Give it a name')
  if (!Number.isFinite(reward) || reward <= 0) throw new HttpError(400, 'Set a reward above $0')
  if (!SCHEDULES.includes(body.schedule as Schedule)) throw new HttpError(400, 'Pick how often it repeats')
  if (!body.kidIds?.length) throw new HttpError(400, 'Assign it to at least one kid')
  const description = body.description?.trim() || null
  if (description && description.length > 240) throw new HttpError(400, 'Keep the details under 240 characters')
  return { title, reward, description }
}

/** POST /api/chores */
choreRoutes.post('/', async (c) => {
  const body = await c.req.json<ChoreBody>()
  const parent = await requireParent(body.parentId)
  const { title, reward, description } = validate(body)

  const id = await tx(async (conn) => {
    const [result] = await conn.query(
      `INSERT INTO chores (family_id, title, reward_cents, schedule, schedule_detail, icon, description, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        parent.family_id,
        title,
        reward,
        body.schedule,
        body.scheduleDetail?.trim() || null,
        body.icon || null,
        description,
      ],
    )
    const choreId = Number((result as { insertId: number }).insertId)
    for (const kidId of body.kidIds) {
      await conn.query('INSERT INTO chore_assignments (chore_id, kid_id) VALUES (?, ?)', [
        choreId,
        Number(kidId),
      ])
    }
    return choreId
  })
  return c.json({ id }, 201)
})

/** PUT /api/chores/:id — full edit, including who it is assigned to. */
choreRoutes.put('/:id', async (c) => {
  const body = await c.req.json<ChoreBody>()
  await requireParent(body.parentId)
  const id = Number(c.req.param('id'))
  const { title, reward, description } = validate(body)

  const existing = await one('SELECT id FROM chores WHERE id = ?', [id])
  if (!existing) throw new HttpError(404, 'That achievement does not exist')

  await tx(async (conn) => {
    await conn.query(
      `UPDATE chores SET title = ?, reward_cents = ?, schedule = ?, schedule_detail = ?, icon = ?, description = ?
        WHERE id = ?`,
      [title, reward, body.schedule, body.scheduleDetail?.trim() || null, body.icon || null, description, id],
    )
    await conn.query('DELETE FROM chore_assignments WHERE chore_id = ?', [id])
    for (const kidId of body.kidIds) {
      await conn.query('INSERT INTO chore_assignments (chore_id, kid_id) VALUES (?, ?)', [id, Number(kidId)])
    }
  })
  return c.json({ ok: true })
})

/** PATCH /api/chores/:id — the pause/resume toggle. */
choreRoutes.patch('/:id', async (c) => {
  const body = await c.req.json<{ parentId: number; active?: boolean }>()
  await requireParent(body.parentId)
  const id = Number(c.req.param('id'))

  if (typeof body.active !== 'boolean') throw new HttpError(400, 'Nothing to change')
  const result = await run('UPDATE chores SET active = ? WHERE id = ?', [body.active ? 1 : 0, id])
  if (result.affectedRows === 0) throw new HttpError(404, 'That achievement does not exist')
  return c.json({ ok: true })
})

/**
 * DELETE /api/chores/:id — only while nothing has been done against it. Once a
 * completion exists the history has to stay, so pausing is the way out.
 */
choreRoutes.delete('/:id', async (c) => {
  const body = await c.req.json<{ parentId: number }>()
  await requireParent(body.parentId)
  const id = Number(c.req.param('id'))

  const used = await one<{ n: number }>('SELECT COUNT(*) AS n FROM task_completions WHERE chore_id = ?', [id])
  if (Number(used?.n ?? 0) > 0) {
    throw new HttpError(409, 'This one has history — pause it instead of deleting it')
  }

  const result = await run('DELETE FROM chores WHERE id = ?', [id])
  if (result.affectedRows === 0) throw new HttpError(404, 'That achievement does not exist')
  return c.json({ ok: true })
})
