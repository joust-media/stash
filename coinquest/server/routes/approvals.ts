import { Hono } from 'hono'
import type { PoolConnection } from 'mysql2/promise'
import { all, tx } from '../db.ts'
import type { ApprovalItem, ApprovalsPayload } from '../../shared/types.ts'
import { HttpError, insertTransaction, iso, requireParent, timeLabel, toPerson } from '../lib.ts'

export const approvalRoutes = new Hono()

/*
 * One queue for everything a parent has to clear. Nothing enters a stash
 * without an achievement approval, and nothing leaves one without a withdrawal
 * approval — both live here so a parent has a single place to look.
 */

function personFrom(r: Record<string, any>) {
  return toPerson({
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
  })
}

const USER_COLUMNS = `u.id AS u_id, u.family_id, u.name, u.role, u.age, u.avatar_color,
                      u.pin_hash, u.nickname, u.mascot_pose, u.about`

/** GET /api/approvals — achievements waiting to pay out, plus cash requests. */
approvalRoutes.get('/', async (c) => {
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)

  const [completions, withdrawals, nudges] = await Promise.all([
    all(
      `SELECT tc.id, tc.completed_at, tc.proof_media_id, ch.title, ch.reward_cents, ${USER_COLUMNS}
         FROM task_completions tc
         JOIN chores ch ON ch.id = tc.chore_id
         JOIN users  u  ON u.id  = tc.kid_id
        WHERE tc.status = 'pending'
        ORDER BY tc.completed_at DESC`,
    ),
    all(
      `SELECT w.id, w.amount_cents, w.category, w.note, w.requested_at, w.goal_id, w.kind,
              g.match_amount_cents, ${USER_COLUMNS}
         FROM withdrawal_requests w
         JOIN users u ON u.id = w.kid_id
         LEFT JOIN goals g ON g.id = w.goal_id
        WHERE w.status = 'pending'
        ORDER BY w.requested_at DESC`,
    ),
    // Stash's visits today — the kid sent him to nudge whoever approves.
    all(
      `SELECT u.name, r.created_at FROM reminders r
         JOIN users u ON u.id = r.kid_id
        WHERE r.created_at >= ?
        ORDER BY r.created_at DESC`,
      [dayStart],
    ),
  ])

  const items: ApprovalItem[] = [
    ...completions.map((r) => ({
      kind: 'achievement' as const,
      id: Number(r.id),
      kid: personFrom(r),
      title: r.title as string,
      amountCents: Number(r.reward_cents),
      at: iso(r.completed_at),
      timeLabel: timeLabel(r.completed_at),
      note: null,
      proofThumbUrl: r.proof_media_id ? `/api/media/${r.proof_media_id}/thumb` : null,
      proofUrl: r.proof_media_id ? `/api/media/${r.proof_media_id}` : null,
    })),
    ...withdrawals.map((r) => ({
      kind: (r.kind === 'deposit' ? 'deposit' : 'withdrawal') as 'deposit' | 'withdrawal',
      id: Number(r.id),
      kid: personFrom(r),
      title: r.kind === 'deposit' ? 'Cash handed over' : (r.category as string),
      amountCents: (r.kind === 'deposit' ? 1 : -1) * Number(r.amount_cents),
      at: iso(r.requested_at),
      timeLabel: timeLabel(r.requested_at),
      note: (r.note as string | null) ?? null,
      matchAmountCents: r.match_amount_cents == null ? null : Number(r.match_amount_cents),
    })),
  ].sort((a, b) => {
    /*
     * Cash-in-hand jumps the queue. A kid who handed over real money is
     * trusting a parent to make it exist in the app — that is not a
     * whenever-you-get-to-it item, it sits on top until it is done.
     */
    if ((a.kind === 'deposit') !== (b.kind === 'deposit')) return a.kind === 'deposit' ? -1 : 1
    return b.at.localeCompare(a.at)
  })

  const payload: ApprovalsPayload = {
    items,
    reminders: nudges.map((r) => ({ kidName: r.name as string, timeLabel: timeLabel(r.created_at) })),
    payoutCents: items.filter((i) => i.kind === 'achievement').reduce((s, i) => s + i.amountCents, 0),
    withdrawalCents: items
      .filter((i) => i.kind === 'withdrawal')
      .reduce((s, i) => s + Math.abs(i.amountCents), 0),
    depositCents: items.filter((i) => i.kind === 'deposit').reduce((s, i) => s + i.amountCents, 0),
  }
  return c.json(payload)
})

/** Approving is what creates the money — see the handoff's rules. */
async function approveAchievement(conn: PoolConnection, completionId: number, parentId: number) {
  const [rows] = await conn.query(
    `SELECT tc.id, tc.kid_id, tc.status, ch.reward_cents
       FROM task_completions tc JOIN chores ch ON ch.id = tc.chore_id
      WHERE tc.id = ? FOR UPDATE`,
    [completionId],
  )
  const row = (rows as Record<string, any>[])[0]
  if (!row) throw new HttpError(404, 'That is not in the queue')
  if (row.status !== 'pending') throw new HttpError(409, 'Already reviewed')

  const at = new Date()
  await conn.query(
    `UPDATE task_completions SET status = 'approved', reviewed_by = ?, reviewed_at = ? WHERE id = ?`,
    [parentId, at, row.id],
  )
  // The proof photo's job ends here. Thirty days of grace, then the sweep.
  await conn.query(
    `UPDATE media m JOIN task_completions tc ON tc.proof_media_id = m.id
        SET m.purge_after = DATE_ADD(?, INTERVAL 30 DAY)
      WHERE tc.id = ?`,
    [at, row.id],
  )
  await insertTransaction(
    {
      kidId: Number(row.kid_id),
      type: 'earn',
      amountCents: Number(row.reward_cents),
      relatedCompletionId: Number(row.id),
      createdBy: parentId,
      createdAt: at,
    },
    conn,
  )
  return Number(row.reward_cents)
}

/**
 * Confirming a cash request is the moment money actually moves — out of the
 * stash for a withdrawal, into it for cash the kid already handed over.
 */
async function approveWithdrawal(conn: PoolConnection, requestId: number, parentId: number) {
  const [rows] = await conn.query(`SELECT * FROM withdrawal_requests WHERE id = ? FOR UPDATE`, [requestId])
  const row = (rows as Record<string, any>[])[0]
  if (!row) throw new HttpError(404, 'That request does not exist')
  if (row.status !== 'pending') throw new HttpError(409, 'Already handled')

  const isDeposit = row.kind === 'deposit'
  const t = await insertTransaction(
    {
      kidId: Number(row.kid_id),
      type: isDeposit ? 'deposit' : 'withdraw',
      amountCents: (isDeposit ? 1 : -1) * Number(row.amount_cents),
      category: isDeposit ? null : row.category,
      note: isDeposit ? (row.note || 'Cash handed over') : row.note,
      // Only the kid's share ever moves. The parent's match is not a
      // transaction and never enters the balance — it is not money the kid has.
      goalId: row.goal_id == null ? null : Number(row.goal_id),
      createdBy: parentId,
    },
    conn,
  )
  await conn.query(
    `UPDATE withdrawal_requests
        SET status = 'confirmed', confirmed_by = ?, confirmed_at = ?, transaction_id = ?
      WHERE id = ?`,
    [parentId, new Date(), t.id, row.id],
  )

  /*
   * A claimed goal is finished — the kid has the thing. Leaving it active would
   * put them straight back to "$16.50 to go" for something already sitting on
   * their desk, so it steps aside and the next goal takes over the tracker.
   * The row stays: it is their history, and the ledger points at it.
   */
  if (row.goal_id != null) {
    await conn.query('UPDATE goals SET active = 0 WHERE id = ?', [row.goal_id])
    const [others] = await conn.query(
      `SELECT id FROM goals
        WHERE kid_id = ? AND id <> ?
          AND id NOT IN (SELECT goal_id FROM transactions WHERE goal_id IS NOT NULL)
        ORDER BY id LIMIT 1`,
      [row.kid_id, row.goal_id],
    )
    const next = (others as { id: number }[])[0]
    if (next) await conn.query('UPDATE goals SET active = 1 WHERE id = ?', [next.id])
  }

  return Number(row.amount_cents)
}

approvalRoutes.post('/:kind/:id/approve', async (c) => {
  const { parentId } = await c.req.json<{ parentId: number }>()
  const parent = await requireParent(parentId)
  const kind = c.req.param('kind')
  const id = Number(c.req.param('id'))

  if (kind === 'achievement') {
    const paidCents = await tx((conn) => approveAchievement(conn, id, parent.id))
    return c.json({ paidCents })
  }
  if (kind === 'withdrawal' || kind === 'deposit') {
    const handedOverCents = await tx((conn) => approveWithdrawal(conn, id, parent.id))
    return c.json({ handedOverCents })
  }
  throw new HttpError(400, 'Unknown approval kind')
})

approvalRoutes.post('/:kind/:id/reject', async (c) => {
  const { parentId } = await c.req.json<{ parentId: number }>()
  const parent = await requireParent(parentId)
  const kind = c.req.param('kind')
  const id = Number(c.req.param('id'))

  if (kind === 'achievement') {
    // "Send back" returns the task to the kid's list; no money moves.
    const result = await tx(async (conn) => {
      const [r] = await conn.query(
        `UPDATE task_completions SET status = 'rejected', reviewed_by = ?, reviewed_at = ?
          WHERE id = ? AND status = 'pending'`,
        [parent.id, new Date(), id],
      )
      return r as { affectedRows: number }
    })
    if (result.affectedRows === 0) throw new HttpError(409, 'Already reviewed')
    return c.json({ ok: true })
  }

  if (kind === 'withdrawal' || kind === 'deposit') {
    const result = await tx(async (conn) => {
      const [r] = await conn.query(
        `UPDATE withdrawal_requests SET status = 'declined', confirmed_by = ?, confirmed_at = ?
          WHERE id = ? AND status = 'pending'`,
        [parent.id, new Date(), id],
      )
      return r as { affectedRows: number }
    })
    if (result.affectedRows === 0) throw new HttpError(409, 'Already handled')
    return c.json({ ok: true })
  }

  throw new HttpError(400, 'Unknown approval kind')
})

/**
 * Bulk approve covers achievements only. Handing over cash is a physical act
 * per request, so withdrawals are never cleared in bulk.
 */
approvalRoutes.post('/approve-all', async (c) => {
  const { parentId } = await c.req.json<{ parentId: number }>()
  const parent = await requireParent(parentId)

  const pending = await all<{ id: number }>(`SELECT id FROM task_completions WHERE status = 'pending'`)
  const paidCents = await tx(async (conn) => {
    let total = 0
    for (const row of pending) total += await approveAchievement(conn, Number(row.id), parent.id)
    return total
  })
  return c.json({ approved: pending.length, paidCents })
})
