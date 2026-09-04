import { Hono } from 'hono'
import { one, run, tx } from '../db.ts'
import { HttpError, balanceOf, insertTransaction, requireKid, requireParent } from '../lib.ts'
import { formatMoney } from '../../shared/money.ts'

export const moneyRoutes = new Hono()

/** POST /api/money/deposits — a parent adds cash to a stash. */
moneyRoutes.post('/deposits', async (c) => {
  const { kidId, amountCents, note, parentId } = await c.req.json<{
    kidId: number
    amountCents: number
    note?: string
    parentId: number
  }>()
  const parent = await requireParent(parentId)
  const kid = await requireKid(Number(kidId))
  const amount = Math.round(Number(amountCents))
  if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, 'Enter an amount above $0')

  const result = await tx((conn) =>
    insertTransaction(
      {
        kidId: kid.id,
        type: 'deposit',
        amountCents: amount,
        note: note?.trim() || null,
        createdBy: parent.id,
      },
      conn,
    ),
  )
  return c.json({ balanceCents: result.balanceAfter })
})

/**
 * POST /api/money/withdrawals — a kid asks to take money out. This only files
 * the request; the money does not move until a parent approves it.
 */
moneyRoutes.post('/withdrawals', async (c) => {
  const { kidId, amountCents, category, note, goalId, imageMediaId } = await c.req.json<{
    kidId: number
    amountCents: number
    category: string
    note?: string
    /** Set when this is a Good Stuff claim rather than a plain cash-out. */
    goalId?: number | null
    /** Optional snap of what the money is for. */
    imageMediaId?: number | null
  }>()
  const kid = await requireKid(Number(kidId))
  const amount = Math.round(Number(amountCents))
  if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, 'Enter an amount above $0')

  /*
   * A claim is the same request as any other cash-out — it just carries the
   * goal. The amount is re-derived from the goal rather than trusted from the
   * client, so a tampered request cannot ask for more than the kid's share.
   */
  let claimTitle: string | null = null
  const claimGoalId = goalId ? Number(goalId) : null
  if (claimGoalId) {
    const goal = await one<{ kid_id: number; title: string; target_cents: number }>(
      'SELECT kid_id, title, target_cents FROM goals WHERE id = ?',
      [claimGoalId],
    )
    if (!goal) throw new HttpError(404, 'That goal does not exist')
    if (Number(goal.kid_id) !== kid.id) throw new HttpError(403, 'That is not your goal')
    if (amount !== Number(goal.target_cents)) {
      throw new HttpError(400, 'A goal is claimed for its full share, not part of it')
    }

    // A goal is claimed once. Hiding the button is not enough — without this a
    // kid with the balance for it could ask again for something already handed
    // over, and pay for it twice.
    const settled = await one<{ n: number }>(
      'SELECT COUNT(*) AS n FROM transactions WHERE goal_id = ?',
      [claimGoalId],
    )
    if (Number(settled?.n ?? 0) > 0) throw new HttpError(409, 'You already got this one')

    const open = await one<{ n: number }>(
      `SELECT COUNT(*) AS n FROM withdrawal_requests WHERE goal_id = ? AND status = 'pending'`,
      [claimGoalId],
    )
    if (Number(open?.n ?? 0) > 0) throw new HttpError(409, 'You have already asked for this one')

    claimTitle = goal.title
  }

  const id = await tx(async (conn) => {
    const balance = await balanceOf(kid.id, conn, true)
    // Money already promised to another open request cannot be spent twice.
    const [rows] = await conn.query(
      `SELECT COALESCE(SUM(amount_cents), 0) AS n
         FROM withdrawal_requests
        WHERE kid_id = ? AND status = 'pending' AND kind = 'withdraw' FOR UPDATE`,
      [kid.id],
    )
    const held = Number((rows as { n: number }[])[0]?.n ?? 0)
    const available = balance - held
    if (amount > available) {
      throw new HttpError(400, `You can ask for up to ${formatMoney(available)}`)
    }

    const [result] = await conn.query(
      `INSERT INTO withdrawal_requests (kid_id, amount_cents, category, note, status, requested_at, goal_id, image_media_id)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [
        kid.id,
        amount,
        claimTitle?.slice(0, 60) || category?.trim() || 'Other',
        note?.trim() || null,
        new Date(),
        claimGoalId,
        imageMediaId ? Number(imageMediaId) : null,
      ],
    )
    return Number((result as { insertId: number }).insertId)
  })

  return c.json({ id })
})

/**
 * POST /api/money/deposit-requests — the kid handed a parent real cash and is
 * asking for it to be added. No balance check: there is nothing to check, the
 * money exists in a parent's hand. The parent confirming is what records it.
 */
moneyRoutes.post('/deposit-requests', async (c) => {
  const { kidId, amountCents, note, imageMediaId } = await c.req.json<{
    kidId: number
    amountCents: number
    note?: string
    imageMediaId?: number | null
  }>()
  const kid = await requireKid(Number(kidId))
  const amount = Math.round(Number(amountCents))
  if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, 'Enter an amount above $0')
  if (amount > 100_000) throw new HttpError(400, `Keep it under ${formatMoney(100_000)} at a time`)

  const { insertId } = await run(
    `INSERT INTO withdrawal_requests (kid_id, amount_cents, category, note, status, requested_at, kind, image_media_id)
     VALUES (?, ?, 'Cash handed over', ?, 'pending', ?, 'deposit', ?)`,
    [kid.id, amount, note?.trim() || null, new Date(), imageMediaId ? Number(imageMediaId) : null],
  )
  return c.json({ id: insertId })
})

/** GET /api/money/withdrawals?kidId= — a kid's own open requests. */
moneyRoutes.get('/withdrawals', async (c) => {
  const kidId = Number(c.req.query('kidId'))
  await requireKid(kidId)
  const rows = await one<{ n: number }>(
    `SELECT COALESCE(SUM(amount_cents), 0) AS n
       FROM withdrawal_requests WHERE kid_id = ? AND status = 'pending' AND kind = 'withdraw'`,
    [kidId],
  )
  return c.json({ heldCents: Number(rows?.n ?? 0) })
})

/** Retired in favour of /api/approvals; kept so older clients get a clear error. */
moneyRoutes.post('/withdrawals/:id/confirm', () => {
  throw new HttpError(410, 'Use POST /api/approvals/withdrawal/:id/approve')
})

export { run }
