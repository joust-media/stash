import { Hono } from 'hono'
import { all, one, run } from '../db.ts'
import type { FamilyOverview, KidSummary, WithdrawalRequest } from '../../shared/types.ts'
import {
  HttpError,
  balanceOf,
  goalFor,
  iso,
  periodKeyFor,
  requireParent,
  toPerson,
  windowStart,
  type UserRow,
} from '../lib.ts'

export const familyRoutes = new Hono()

/** Every kid's headline numbers — used by the welcome screen and overview. */
export async function kidSummary(row: UserRow): Promise<KidSummary> {
  const person = toPerson(row)
  const balanceCents = await balanceOf(person.id)
  const now = new Date()

  const [open, pending, week] = await Promise.all([
    one<{ n: number }>(
      `SELECT COUNT(*) AS n
         FROM chores c
         JOIN chore_assignments ca ON ca.chore_id = c.id AND ca.kid_id = ?
         LEFT JOIN task_completions tc
                ON tc.chore_id = c.id AND tc.kid_id = ca.kid_id AND tc.status <> 'rejected'
               AND tc.period_key = CASE c.schedule WHEN 'daily' THEN ? WHEN 'weekly' THEN ? ELSE 'once' END
        WHERE c.active = 1 AND tc.id IS NULL`,
      [person.id, periodKeyFor('daily', now), periodKeyFor('weekly', now)],
    ),
    one<{ n: number }>(
      `SELECT COUNT(*) AS n FROM task_completions WHERE kid_id = ? AND status = 'pending'`,
      [person.id],
    ),
    one<{ n: number }>(
      `SELECT COUNT(*) AS n FROM task_completions
        WHERE kid_id = ? AND status <> 'rejected' AND completed_at >= ?`,
      [person.id, windowStart()],
    ),
  ])

  return {
    ...person,
    balanceCents,
    pendingCount: Number(pending?.n ?? 0),
    openCount: Number(open?.n ?? 0),
    choresThisWeek: Number(week?.n ?? 0),
    goal: await goalFor(person.id, balanceCents),
  }
}

async function pendingWithdrawals(): Promise<WithdrawalRequest[]> {
  const rows = await all(
    `SELECT w.id, w.amount_cents, w.category, w.requested_at,
            u.id AS u_id, u.family_id, u.name, u.role, u.age, u.avatar_color,
            u.pin_hash, u.nickname, u.mascot_pose, u.about
       FROM withdrawal_requests w
       JOIN users u ON u.id = w.kid_id
      WHERE w.status = 'pending'
      ORDER BY w.id DESC`,
  )

  return rows.map((r) => ({
    id: Number(r.id),
    kid: toPerson({
      id: r.u_id,
      family_id: r.family_id,
      name: r.name,
      role: r.role,
      age: r.age,
      avatar_color: r.avatar_color,
      pin_hash: r.pin_hash,
      nickname: r.nickname,
      mascot_pose: r.mascot_pose,
      about: r.about,
    }),
    amountCents: Number(r.amount_cents),
    category: r.category,
    status: 'pending' as const,
    requestedAt: iso(r.requested_at),
  }))
}

/** GET /api/family — the whole parent overview in one payload. */
familyRoutes.get('/', async (c) => {
  const family = await one<{ id: number; name: string; photo_proof_enabled: number }>(
    'SELECT id, name, photo_proof_enabled FROM families ORDER BY id LIMIT 1',
  )
  if (!family) return c.json({ error: 'No family seeded' }, 404)

  const users = await all<UserRow>('SELECT * FROM users WHERE family_id = ? ORDER BY role DESC, id', [
    family.id,
  ])

  const kids = await Promise.all(users.filter((u) => u.role === 'kid').map(kidSummary))
  const parents = users.filter((u) => u.role === 'parent').map(toPerson)

  // "This week +$X" counts what the kids earned; deposits are not earnings.
  const delta = await one<{ n: number }>(
    `SELECT COALESCE(SUM(amount_cents), 0) AS n
       FROM transactions WHERE type = 'earn' AND created_at >= ?`,
    [windowStart()],
  )

  const payload: FamilyOverview = {
    family: { id: Number(family.id), name: family.name },
    photoProofEnabled: Boolean(family.photo_proof_enabled ?? 1),
    parents,
    kids,
    totalHeldCents: kids.reduce((sum, k) => sum + k.balanceCents, 0),
    weekDeltaCents: Number(delta?.n ?? 0),
    pendingTotal: kids.reduce((sum, k) => sum + k.pendingCount, 0),
    pendingByKid: kids.filter((k) => k.pendingCount > 0).map((k) => ({ name: k.name, count: k.pendingCount })),
    pendingWithdrawals: await pendingWithdrawals(),
  }
  return c.json(payload)
})


/** PATCH /api/family/settings — the family-level photo-proof switch. */
familyRoutes.patch('/settings', async (c) => {
  const body = await c.req.json<{ parentId: number; photoProofEnabled?: boolean }>()
  const parent = await requireParent(body.parentId)
  if (typeof body.photoProofEnabled !== 'boolean') throw new HttpError(400, 'Nothing to change')

  await run('UPDATE families SET photo_proof_enabled = ? WHERE id = ?', [
    body.photoProofEnabled ? 1 : 0,
    parent.family_id,
  ])
  return c.json({ ok: true })
})
