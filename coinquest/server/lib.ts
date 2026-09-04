import type { PoolConnection } from 'mysql2/promise'
import { all, one, pool, run, type Row } from './db.ts'
import type { Goal, Person, Pose, Schedule, TxType } from '../shared/types.ts'

/** Either the pool or a transaction's connection. */
export type Db = Pick<PoolConnection, 'query'> | typeof pool

async function rows_<T = Row>(db: Db, sql: string, params: unknown[] = []): Promise<T[]> {
  const [r] = await db.query(sql, params)
  return r as T[]
}

async function first<T = Row>(db: Db, sql: string, params: unknown[] = []): Promise<T | undefined> {
  return (await rows_<T>(db, sql, params))[0]
}

/* ---------------------------------------------------------------- time --- */

const pad = (n: number) => String(n).padStart(2, '0')

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** ISO-8601 week key, e.g. 2026-W34. */
export function weekKey(d: Date): string {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7))
  const isoYear = t.getFullYear()
  const firstThursday = new Date(isoYear, 0, 4)
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7))
  const week = 1 + Math.round((t.getTime() - firstThursday.getTime()) / (7 * 86_400_000))
  return `${isoYear}-W${pad(week)}`
}

/**
 * Which scheduling occurrence a completion satisfies. A daily chore reopens
 * every calendar day, a weekly chore every ISO week, a one-time chore never.
 */
export function periodKeyFor(schedule: Schedule, at: Date): string {
  if (schedule === 'daily') return `d:${dayKey(at)}`
  if (schedule === 'weekly') return `w:${weekKey(at)}`
  return 'once'
}

/** "This week" is a rolling 7 days, so the summary still reads on a Monday. */
export function windowStart(days = 7): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d
}

/** mysql2 hands back Date objects; the wire format is always ISO. */
export const iso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString()

export function dayLabel(value: Date | string): string {
  const d = new Date(value)
  const today = new Date()
  const diff = Math.round(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() -
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) /
      86_400_000,
  )
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function timeLabel(value: Date | string): string {
  const d = new Date(value)
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()
  const day = dayLabel(value)
  return day === 'Today' || day === 'Yesterday' ? `${day.toLowerCase()} ${time}` : `${day} ${time}`
}

/* --------------------------------------------------------------- labels --- */

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export function scheduleLabel(schedule: Schedule, detail: string | null): string {
  const base = schedule === 'daily' ? 'Daily' : schedule === 'weekly' ? 'Weekly' : 'One-time'
  return detail ? `${base} · ${detail}` : base
}

export function scheduleChip(schedule: Schedule, detail: string | null, active: boolean): string {
  if (!active) return detail ? `Paused · ${detail}` : 'Paused'
  const base = schedule === 'daily' ? 'Daily' : schedule === 'weekly' ? 'Weekly' : 'One-time'
  if (!detail) return base
  return `${base} · ${WEEKDAYS.includes(detail.toLowerCase()) ? detail.slice(0, 3) : detail}`
}

/* ----------------------------------------------------------------- rows --- */

export interface UserRow {
  id: number
  family_id: number
  name: string
  role: 'kid' | 'parent'
  age: number | null
  avatar_color: string
  pin_hash: string | null
  nickname: string | null
  mascot_pose: string | null
  about: string | null
}

const POSES: Pose[] = ['coin-toss', 'coin-toss-alt', 'nut-pile', 'confetti', 'acorn-hug']

export function toPerson(row: UserRow & { avatar_media_id?: number | null }): Person {
  const pose = POSES.includes(row.mascot_pose as Pose) ? (row.mascot_pose as Pose) : null
  return {
    avatarUrl: row.avatar_media_id ? `/api/media/${row.avatar_media_id}/thumb` : null,
    id: Number(row.id),
    familyId: Number(row.family_id),
    name: row.name,
    role: row.role,
    age: row.age === null ? null : Number(row.age),
    avatarColor: row.avatar_color,
    initial: (row.nickname || row.name).charAt(0).toUpperCase(),
    nickname: row.nickname,
    about: row.about,
    mascotPose: pose,
    hasPin: Boolean(row.pin_hash),
  }
}

export async function getUser(id: number, db: Db = pool): Promise<UserRow | undefined> {
  return first<UserRow>(db, 'SELECT * FROM users WHERE id = ?', [id])
}

export async function requireKid(id: number, db: Db = pool): Promise<UserRow> {
  const row = await getUser(id, db)
  if (!row || row.role !== 'kid') throw new HttpError(404, 'That account does not exist')
  return row
}

export async function requireParent(id: unknown, db: Db = pool): Promise<UserRow> {
  const parent = await getUser(Number(id), db)
  if (!parent || parent.role !== 'parent') throw new HttpError(403, 'Parent mode required')
  return parent
}

/* -------------------------------------------------------------- balance --- */

/**
 * Inside a transaction this locks the kid's transaction rows, so two writers
 * cannot both read the same balance and then append against it.
 */
export async function balanceOf(kidId: number, db: Db = pool, forUpdate = false): Promise<number> {
  const row = await first<{ b: number }>(
    db,
    `SELECT balance_after_cents AS b FROM transactions
      WHERE kid_id = ? ORDER BY id DESC LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
    [kidId],
  )
  return row ? Number(row.b) : 0
}

export interface NewTransaction {
  kidId: number
  type: TxType
  /** Signed: positive for earn/deposit, negative for withdraw. */
  amountCents: number
  note?: string | null
  category?: string | null
  relatedCompletionId?: number | null
  /** Set when this is a Good Stuff claim, so the ledger can name the thing. */
  goalId?: number | null
  createdBy: number
  createdAt?: Date
}

/** Appends a transaction and stamps the running balance onto it. */
export async function insertTransaction(
  t: NewTransaction,
  db: Db = pool,
): Promise<{ id: number; balanceAfter: number }> {
  const balanceAfter = (await balanceOf(t.kidId, db, db !== pool)) + t.amountCents
  if (balanceAfter < 0) throw new HttpError(400, 'That would put the stash below zero')

  const [result] = await db.query(
    `INSERT INTO transactions
       (kid_id, type, amount_cents, note, category, related_completion_id, goal_id,
        created_by, created_at, balance_after_cents)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      t.kidId,
      t.type,
      t.amountCents,
      t.note ?? null,
      t.category ?? null,
      t.relatedCompletionId ?? null,
      t.goalId ?? null,
      t.createdBy,
      t.createdAt ?? new Date(),
      balanceAfter,
    ],
  )
  return { id: Number((result as { insertId: number }).insertId), balanceAfter }
}

/* ----------------------------------------------------------------- goal --- */

interface GoalRowShape {
  id: number
  kid_id: number
  title: string
  target_cents: number
  active: number
  icon: string | null
  suggested_item_id?: number | null
  match_percent_locked?: number | null
  match_amount_cents?: number | null
  match_payer_name?: string | null
  claim_settled?: number
  claim_pending?: number
  image?: string | null
  image_media_id?: number | null
}

export function toGoal(row: GoalRowShape, balanceCents: number): Goal {
  const target = Number(row.target_cents)
  const claimed = Number(row.claim_settled ?? 0) > 0
  const claimPending = Number(row.claim_pending ?? 0) > 0
  return {
    id: Number(row.id),
    kidId: Number(row.kid_id),
    title: row.title,
    targetCents: target,
    progressPct: Math.min(100, Math.round((balanceCents / target) * 100)),
    active: Boolean(row.active),
    icon: row.icon ?? null,
    image: row.image_media_id ? `/api/media/${row.image_media_id}` : (row.image ?? null),
    remainingCents: Math.max(0, target - balanceCents),
    suggestedItemId: row.suggested_item_id == null ? null : Number(row.suggested_item_id),
    matchPercent: row.match_percent_locked == null ? null : Number(row.match_percent_locked),
    matchAmountCents: row.match_amount_cents == null ? null : Number(row.match_amount_cents),
    matchPayerName: row.match_payer_name ?? null,
    claimed,
    claimPending,
    /*
     * The target is already the kid's share, so reaching it is most of the
     * test — but a goal already handed over, or already asked for, must not
     * offer to be claimed again. Without this a kid can spend their share
     * twice on something they have already been given.
     */
    claimable: balanceCents >= target && !claimed && !claimPending,
  }
}

/** Every goal this kid is saving towards, the active one first. */
export async function goalsFor(kidId: number, balanceCents: number, db: Db = pool): Promise<Goal[]> {
  const rows = await rows_<GoalRowShape>(
    db,
    `SELECT g.*, pu.name AS match_payer_name,
             (SELECT COUNT(*) FROM transactions t
               WHERE t.goal_id = g.id) AS claim_settled,
             (SELECT COUNT(*) FROM withdrawal_requests w
               WHERE w.goal_id = g.id AND w.status = 'pending') AS claim_pending
       FROM goals g
       LEFT JOIN suggested_items si ON si.id = g.suggested_item_id
       LEFT JOIN users pu           ON pu.id = si.created_by_user_id
      WHERE g.kid_id = ? ORDER BY g.active DESC, g.id`,
    [kidId],
  )
  return rows.map((r) => toGoal(r, balanceCents))
}

export async function goalFor(kidId: number, balanceCents: number, db: Db = pool): Promise<Goal | null> {
  const row = await first<GoalRowShape>(
    db,
    `SELECT g.*, pu.name AS match_payer_name,
             (SELECT COUNT(*) FROM transactions t
               WHERE t.goal_id = g.id) AS claim_settled,
             (SELECT COUNT(*) FROM withdrawal_requests w
               WHERE w.goal_id = g.id AND w.status = 'pending') AS claim_pending
       FROM goals g
       LEFT JOIN suggested_items si ON si.id = g.suggested_item_id
       LEFT JOIN users pu           ON pu.id = si.created_by_user_id
      WHERE g.kid_id = ? AND g.active = 1 ORDER BY g.id LIMIT 1`,
    [kidId],
  )
  return row ? toGoal(row, balanceCents) : null
}

/** "12 minutes" / "2 hours" — how long a task has been running. */
export function elapsedLabel(since: Date | string): string {
  const ms = Date.now() - new Date(since).getTime()
  const minutes = Math.max(0, Math.round(ms / 60_000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr`
  return `${Math.round(hours / 24)} d`
}

/* ---------------------------------------------------------------- error --- */

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export { all, one, run }
