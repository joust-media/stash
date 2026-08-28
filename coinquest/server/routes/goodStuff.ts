import { Hono } from 'hono'
import { all, one, tx } from '../db.ts'
import type { SuggestedItem, SuggestedItemRow } from '../../shared/types.ts'
import {
  MAX_ITEM_PRICE_CENTS,
  MAX_MATCH_PERCENT,
  MIN_KID_SHARE_CENTS,
  formatMoney,
  splitMatch,
} from '../../shared/money.ts'
import { HttpError, balanceOf, getUser, requireKid, requireParent } from '../lib.ts'

export const goodStuffRoutes = new Hono()

/*
 * The Good Stuff — things a parent would like the kid to have, each with a
 * share the parent commits to covering.
 *
 * This is not a store. A parent types a name and a price; there is no
 * catalogue, no merchant, no feed, no external anything. Keep it that way.
 *
 * Adoption copies the price and match onto the goal and never looks back at the
 * item again. That snapshot is the most important rule here: a parent editing
 * or retiring an item must never move a target a kid is already saving towards.
 */

interface ItemBody {
  parentId: number
  name: string
  priceCents: number
  matchPercent: number
  icon?: string | null
  note?: string | null
  visibleToUserId?: number | null
}

function validate(body: ItemBody) {
  const name = body.name?.trim()
  const price = Math.round(Number(body.priceCents))
  const percent = Math.round(Number(body.matchPercent ?? 0))

  if (!name) throw new HttpError(400, 'What is it?')
  if (name.length > 80) throw new HttpError(400, 'That name is a bit long')
  if (!Number.isFinite(price) || price <= 0) throw new HttpError(400, 'How much does it cost?')
  if (price > MAX_ITEM_PRICE_CENTS) {
    throw new HttpError(400, `Keep it under ${formatMoney(MAX_ITEM_PRICE_CENTS)}`)
  }
  if (!Number.isFinite(percent) || percent < 0 || percent > MAX_MATCH_PERCENT) {
    throw new HttpError(400, `A match can go up to ${MAX_MATCH_PERCENT}%`)
  }

  const { kidShareCents } = splitMatch(price, percent)
  if (kidShareCents < MIN_KID_SHARE_CENTS) {
    throw new HttpError(
      400,
      `That leaves less than ${formatMoney(MIN_KID_SHARE_CENTS)} to save for. Lower the match or raise the price.`,
    )
  }

  return {
    name,
    price,
    percent,
    icon: body.icon?.trim() || null,
    note: body.note?.trim() || null,
    visibleToUserId: body.visibleToUserId ? Number(body.visibleToUserId) : null,
  }
}

function toItem(r: Record<string, any>, adoptedGoalId: number | null = null): SuggestedItem {
  const price = Number(r.price_cents)
  const percent = Number(r.match_percent)
  const { kidShareCents, matchAmountCents } = splitMatch(price, percent)
  return {
    id: Number(r.id),
    name: r.name,
    priceCents: price,
    matchPercent: percent,
    kidShareCents,
    matchAmountCents,
    icon: r.image_key ?? null,
    note: r.note ?? null,
    visibleToUserId: r.visible_to_user_id == null ? null : Number(r.visible_to_user_id),
    adoptedGoalId,
    addedByName: r.added_by_name ?? 'A parent',
  }
}

/**
 * Everything one kid may see. Items aimed at a sibling are filtered in SQL —
 * they never reach the client at all.
 */
export async function suggestionsFor(kidId: number, familyId: number): Promise<SuggestedItem[]> {
  const rows = await all(
    `SELECT s.*, u.name AS added_by_name, g.id AS adopted_goal_id
       FROM suggested_items s
       JOIN users u ON u.id = s.created_by_user_id
       LEFT JOIN goals g ON g.suggested_item_id = s.id AND g.kid_id = ?
      WHERE s.family_id = ? AND s.active = 1
        AND (s.visible_to_user_id IS NULL OR s.visible_to_user_id = ?)
      ORDER BY s.created_at DESC`,
    [kidId, familyId, kidId],
  )
  return rows.map((r) => toItem(r, r.adopted_goal_id == null ? null : Number(r.adopted_goal_id)))
}

/** GET /api/good-stuff?kidId= — the kid-facing row. */
goodStuffRoutes.get('/', async (c) => {
  const kid = await requireKid(Number(c.req.query('kidId')))
  return c.json(await suggestionsFor(kid.id, Number(kid.family_id)))
})

/** GET /api/good-stuff/all — the parent's Manage list, including who adopted what. */
goodStuffRoutes.get('/all', async (c) => {
  const rows = await all(
    `SELECT s.*, u.name AS added_by_name, v.name AS visible_to_name
       FROM suggested_items s
       JOIN users u ON u.id = s.created_by_user_id
       LEFT JOIN users v ON v.id = s.visible_to_user_id
      WHERE s.active = 1
      ORDER BY s.created_at DESC`,
  )
  const adoptions = await all<{ suggested_item_id: number; name: string }>(
    `SELECT g.suggested_item_id, u.name
       FROM goals g JOIN users u ON u.id = g.kid_id
      WHERE g.suggested_item_id IS NOT NULL`,
  )

  const out: SuggestedItemRow[] = rows.map((r) => ({
    ...toItem(r),
    active: Boolean(r.active),
    visibleToName: (r.visible_to_name as string | null) ?? null,
    adoptedBy: adoptions.filter((a) => Number(a.suggested_item_id) === Number(r.id)).map((a) => a.name),
  }))
  return c.json(out)
})

/** POST /api/good-stuff — a parent adds something. */
goodStuffRoutes.post('/', async (c) => {
  const body = await c.req.json<ItemBody>()
  const parent = await requireParent(body.parentId)
  const v = validate(body)

  if (v.visibleToUserId) await requireKid(v.visibleToUserId)

  const id = await tx(async (conn) => {
    const [result] = await conn.query(
      `INSERT INTO suggested_items
         (family_id, created_by_user_id, name, price_cents, match_percent, image_key, note, visible_to_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [parent.family_id, parent.id, v.name, v.price, v.percent, v.icon, v.note, v.visibleToUserId],
    )
    return Number((result as { insertId: number }).insertId)
  })
  return c.json({ id }, 201)
})

/** How many kids are already saving for this. Editing the money is locked once any are. */
async function adoptionCount(id: number): Promise<number> {
  const row = await one<{ n: number }>(
    'SELECT COUNT(*) AS n FROM goals WHERE suggested_item_id = ?',
    [id],
  )
  return Number(row?.n ?? 0)
}

/**
 * PUT /api/good-stuff/:id — edit. Price and match are frozen once anyone has
 * adopted it, so a kid's target cannot move under them. Everything else stays
 * editable: fixing a typo should not require a new item.
 */
goodStuffRoutes.put('/:id', async (c) => {
  const body = await c.req.json<ItemBody>()
  await requireParent(body.parentId)
  const id = Number(c.req.param('id'))

  const existing = await one<Record<string, any>>('SELECT * FROM suggested_items WHERE id = ?', [id])
  if (!existing) throw new HttpError(404, 'That is not on the list')
  const v = validate(body)

  const adopted = await adoptionCount(id)
  if (adopted > 0) {
    const priceMoved = Number(existing.price_cents) !== v.price
    const matchMoved = Number(existing.match_percent) !== v.percent
    if (priceMoved || matchMoved) {
      throw new HttpError(
        409,
        'Someone is already saving for this, so the price and match are locked. Add a new one instead.',
      )
    }
  }

  if (v.visibleToUserId) await requireKid(v.visibleToUserId)

  await tx((conn) =>
    conn.query(
      `UPDATE suggested_items
          SET name = ?, price_cents = ?, match_percent = ?, image_key = ?, note = ?, visible_to_user_id = ?
        WHERE id = ?`,
      [v.name, v.price, v.percent, v.icon, v.note, v.visibleToUserId, id],
    ),
  )
  return c.json({ ok: true })
})

/** DELETE /api/good-stuff/:id — retire it. Adopted goals keep their snapshot and carry on. */
goodStuffRoutes.delete('/:id', async (c) => {
  const body = await c.req.json<{ parentId: number }>()
  await requireParent(body.parentId)
  const id = Number(c.req.param('id'))

  const existing = await one<{ id: number }>('SELECT id FROM suggested_items WHERE id = ?', [id])
  if (!existing) throw new HttpError(404, 'That is not on the list')

  await tx((conn) => conn.query('UPDATE suggested_items SET active = 0 WHERE id = ?', [id]))
  return c.json({ ok: true, stillSavedFor: await adoptionCount(id) })
})

/**
 * POST /api/good-stuff/:id/adopt — the kid takes one up.
 *
 * This is where the snapshot happens. From here on the goal stands on its own
 * and nothing the parent does to the item can move it.
 */
goodStuffRoutes.post('/:id/adopt', async (c) => {
  const body = await c.req.json<{ actorId: number; kidId: number; makeActive?: boolean }>()
  const kid = await requireKid(Number(body.kidId))

  // A kid adopts for themselves; a parent may do it for anyone in the family.
  const actor = await getUser(Number(body.actorId))
  if (!actor) throw new HttpError(403, 'Who is making this change?')
  if (actor.role !== 'parent' && actor.id !== kid.id) {
    throw new HttpError(403, 'You can only pick goals for yourself')
  }

  const id = Number(c.req.param('id'))
  const item = await one<Record<string, any>>(
    'SELECT * FROM suggested_items WHERE id = ? AND active = 1',
    [id],
  )
  if (!item) throw new HttpError(404, 'That is not on the list any more')
  if (Number(item.family_id) !== Number(kid.family_id)) {
    throw new HttpError(403, 'That belongs to another family')
  }
  if (item.visible_to_user_id != null && Number(item.visible_to_user_id) !== kid.id) {
    throw new HttpError(403, 'That one is not for you')
  }

  const { kidShareCents, matchAmountCents } = splitMatch(
    Number(item.price_cents),
    Number(item.match_percent),
  )

  const goalId = await tx(async (conn) => {
    const [dupes] = await conn.query(
      'SELECT id FROM goals WHERE kid_id = ? AND suggested_item_id = ? LIMIT 1',
      [kid.id, id],
    )
    const existing = (dupes as { id: number }[])[0]
    if (existing) throw new HttpError(409, 'You are already saving for that one')

    const makeActive = body.makeActive ?? true
    if (makeActive) await conn.query('UPDATE goals SET active = 0 WHERE kid_id = ?', [kid.id])

    const [result] = await conn.query(
      `INSERT INTO goals
         (kid_id, title, target_cents, icon, active, suggested_item_id, match_percent_locked, match_amount_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        kid.id,
        item.name,
        kidShareCents,
        item.image_key || null,
        makeActive ? 1 : 0,
        id,
        Number(item.match_percent),
        matchAmountCents,
      ],
    )
    return Number((result as { insertId: number }).insertId)
  })

  // Already saved enough? Say so rather than hiding the claim behind a fake wait.
  const balance = await balanceOf(kid.id)
  return c.json({ goalId, kidShareCents, matchAmountCents, claimable: balance >= kidShareCents }, 201)
})
