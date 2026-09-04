import { Hono } from 'hono'
import { all, hashPin, run } from '../db.ts'
import type { Person, Pose, ProfileUpdate } from '../../shared/types.ts'
import { HttpError, getUser, requireParent, toPerson, type UserRow } from '../lib.ts'

export const userRoutes = new Hono()

const POSES: Pose[] = ['coin-toss', 'coin-toss-alt', 'nut-pile', 'confetti', 'acorn-hug']

/** The Stash palette. Avatars stay on-brand rather than accepting any hex. */
const AVATAR_COLORS = ['#8B4A2B', '#2FBF71', '#1E8F52', '#5C3319', '#F2B93B', '#D96B4A']

/** GET /api/users — everyone in the family. */
userRoutes.get('/', async (c) => {
  const rows = await all<UserRow>('SELECT * FROM users ORDER BY role DESC, id')
  return c.json(rows.map(toPerson))
})

userRoutes.get('/:id', async (c) => {
  const row = await getUser(Number(c.req.param('id')))
  if (!row) throw new HttpError(404, 'That account does not exist')
  return c.json(toPerson(row))
})

/**
 * PATCH /api/users/:id — a person edits their own profile. A parent may edit
 * anyone in the family; a kid may only edit themselves, and only a parent can
 * set or clear a PIN.
 */
userRoutes.patch('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json<ProfileUpdate & { actorId: number }>()

  const target = await getUser(id)
  if (!target) throw new HttpError(404, 'That account does not exist')

  const actor = await getUser(Number(body.actorId))
  if (!actor) throw new HttpError(403, 'Who is making this change?')
  if (actor.role !== 'parent' && actor.id !== target.id) {
    throw new HttpError(403, 'You can only edit your own profile')
  }
  if (actor.family_id !== target.family_id) throw new HttpError(403, 'Different family')

  const sets: string[] = []
  const params: unknown[] = []

  if (body.name !== undefined) {
    const name = body.name.trim()
    if (!name) throw new HttpError(400, 'A name is required')
    if (name.length > 80) throw new HttpError(400, 'That name is too long')
    sets.push('name = ?')
    params.push(name)
  }
  if (body.nickname !== undefined) {
    sets.push('nickname = ?')
    params.push(body.nickname?.trim() || null)
  }
  if (body.about !== undefined) {
    const about = body.about?.trim() || null
    if (about && about.length > 240) throw new HttpError(400, 'Keep it under 240 characters')
    sets.push('about = ?')
    params.push(about)
  }
  if (body.age !== undefined) {
    if (body.age === null) {
      sets.push('age = ?')
      params.push(null)
    } else {
      const age = Math.round(Number(body.age))
      if (!Number.isFinite(age) || age < 1 || age > 120) throw new HttpError(400, 'That age looks off')
      sets.push('age = ?')
      params.push(age)
    }
  }
  if (body.avatarColor !== undefined) {
    if (!AVATAR_COLORS.includes(body.avatarColor)) throw new HttpError(400, 'Pick a Stash colour')
    sets.push('avatar_color = ?')
    params.push(body.avatarColor)
  }
  if (body.avatarMediaId !== undefined) {
    sets.push('avatar_media_id = ?')
    params.push(body.avatarMediaId ? Number(body.avatarMediaId) : null)
  }
  if (body.mascotPose !== undefined) {
    if (body.mascotPose !== null && !POSES.includes(body.mascotPose)) {
      throw new HttpError(400, 'That is not one of Stash&apos;s poses')
    }
    sets.push('mascot_pose = ?')
    params.push(body.mascotPose)
  }
  if (body.pin !== undefined) {
    if (actor.role !== 'parent') throw new HttpError(403, 'Only a parent can change a PIN')
    if (target.role !== 'parent') throw new HttpError(400, 'Only parent accounts use a PIN')
    if (body.pin === null) {
      sets.push('pin_hash = ?')
      params.push(null)
    } else {
      if (!/^\d{4}$/.test(body.pin)) throw new HttpError(400, 'A PIN is four digits')
      sets.push('pin_hash = ?')
      params.push(hashPin(body.pin))
    }
  }

  if (sets.length === 0) throw new HttpError(400, 'Nothing to change')

  params.push(id)
  await run(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params)

  const updated = await getUser(id)
  return c.json(toPerson(updated!) satisfies Person)
})

/** POST /api/users — a parent adds someone to the family. */
userRoutes.post('/', async (c) => {
  const body = await c.req.json<{
    parentId: number
    name: string
    role: 'kid' | 'parent'
    age?: number | null
    avatarColor?: string
    pin?: string
  }>()
  const parent = await requireParent(body.parentId)

  const name = body.name?.trim()
  if (!name) throw new HttpError(400, 'A name is required')
  if (body.role !== 'kid' && body.role !== 'parent') throw new HttpError(400, 'Pick kid or parent')
  if (body.role === 'parent' && body.pin && !/^\d{4}$/.test(body.pin)) {
    throw new HttpError(400, 'A PIN is four digits')
  }

  const color = body.avatarColor && AVATAR_COLORS.includes(body.avatarColor)
    ? body.avatarColor
    : AVATAR_COLORS[0]

  const result = await run(
    `INSERT INTO users (family_id, name, role, age, avatar_color, pin_hash) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      parent.family_id,
      name,
      body.role,
      body.age ?? null,
      color,
      body.role === 'parent' && body.pin ? hashPin(body.pin) : null,
    ],
  )
  const created = await getUser(result.insertId)
  return c.json(toPerson(created!), 201)
})

export { AVATAR_COLORS }
