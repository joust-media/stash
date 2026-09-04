import { argv } from 'node:process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PoolConnection } from 'mysql2/promise'
import { hashPin, migrate, one, pool, tx } from './db.ts'
import { insertTransaction, periodKeyFor } from './lib.ts'

/**
 * Seed data reproduces every headline number from the behaviour handoff:
 * balances $24.50 / $11.25 / $38.00, $73.75 held, goals at 61% and 84%,
 * 3 achievements waiting worth $4.50, and a week of $12.50 earned / $8.00 spent
 * / 64% saved, with the ledger's running balances chaining exactly as drawn.
 */

type Schedule = 'daily' | 'weekly' | 'once'

/** A local timestamp `days` back from now, at HH:MM. */
function at(days: number, time: string): Date {
  const [h, m] = time.split(':').map(Number)
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(h, m, 0, 0)
  return d
}

export async function isSeeded(): Promise<boolean> {
  const row = await one<{ n: number }>('SELECT COUNT(*) AS n FROM families')
  return Number(row?.n ?? 0) > 0
}

export async function wipe(): Promise<void> {
  const conn = await pool.getConnection()
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0')
    for (const table of [
      'media_blobs',
      'media',
      'reminders',
      'suggested_items',
      'withdrawal_requests',
      'transactions',
      'task_completions',
      'chore_assignments',
      'goals',
      'chores',
      'users',
      'families',
    ]) {
      await conn.query(`TRUNCATE TABLE ${table}`)
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1')
  } finally {
    conn.release()
  }
}

export async function seed(): Promise<void> {
  await tx(async (conn: PoolConnection) => {
    const insert = async (sql: string, params: unknown[]) => {
      const [r] = await conn.query(sql, params)
      return Number((r as { insertId: number }).insertId)
    }

    const familyId = await insert('INSERT INTO families (name) VALUES (?)', ['The Riveras'])

    const addUser = (
      name: string,
      role: 'kid' | 'parent',
      age: number | null,
      color: string,
      pin: string | null,
      pose: string | null,
    ) =>
      insert(
        `INSERT INTO users (family_id, name, role, age, avatar_color, pin_hash, mascot_pose)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [familyId, name, role, age, color, pin ? hashPin(pin) : null, pose],
      )

    const dad = await addUser('Dad', 'parent', null, '#1E8F52', '1234', 'nut-pile')
    const mom = await addUser('Mom', 'parent', null, '#8B4A2B', '4321', 'nut-pile')
    const maya = await addUser('Maya', 'kid', 15, '#8B4A2B', null, 'acorn-hug')
    const leo = await addUser('Leo', 'kid', 13, '#2FBF71', null, 'coin-toss')
    const zoe = await addUser('Zoe', 'kid', 16, '#1E8F52', null, 'confetti')

    const chore = async (
      title: string,
      rewardCents: number,
      schedule: Schedule,
      detail: string | null,
      icon: string | null,
      kids: number[],
      active = true,
    ) => {
      const id = await insert(
        `INSERT INTO chores (family_id, title, reward_cents, schedule, schedule_detail, icon, active)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [familyId, title, rewardCents, schedule, detail, icon, active ? 1 : 0],
      )
      for (const k of kids) {
        await conn.query('INSERT INTO chore_assignments (chore_id, kid_id) VALUES (?, ?)', [id, k])
      }
      return id
    }

    const all3 = [maya, leo, zoe]

    // --- Daily routine ------------------------------------------------------
    const trash = await chore('Take out the trash', 200, 'daily', 'before 6 pm', 'trash', [maya, leo])
    await chore('Empty the dishwasher', 150, 'daily', null, 'dishes', [maya, zoe])
    await chore('Load the dishwasher', 150, 'daily', 'after dinner', 'dishes', [leo, zoe])
    const makeBed = await chore('Make the bed', 100, 'daily', null, 'bed', all3)
    const feedDog = await chore('Feed the dog', 100, 'daily', null, 'dog', [maya, leo])
    await chore('Walk the dog', 250, 'daily', 'after school', 'paw', [maya, zoe])
    const waterPlants = await chore('Water the plants', 250, 'daily', null, 'drop', [leo])
    await chore('Set the table', 100, 'daily', 'before dinner', 'cook', [leo, zoe])
    await chore('Clear the table', 100, 'daily', 'after dinner', 'dishes', [maya, leo])
    await chore('Tidy your room', 200, 'daily', null, 'sparkle', all3)
    await chore('Read for 20 minutes', 200, 'daily', null, 'book', all3)
    await chore('Homework done', 250, 'daily', 'school nights', 'homework', all3)
    await chore('Practice piano', 250, 'daily', '20 minutes', 'music', [zoe])

    // --- Weekly -------------------------------------------------------------
    const mow = await chore('Mow the lawn', 400, 'weekly', 'Saturday', 'leaf', [maya, zoe])
    await chore('Vacuum the living room', 300, 'weekly', 'Saturday', 'broom', [maya, leo])
    await chore('Sweep the kitchen', 200, 'weekly', 'Friday', 'broom', all3)
    await chore('Dust the shelves', 200, 'weekly', 'Sunday', 'dust', [maya, zoe])
    await chore('Clean the bathroom', 450, 'weekly', 'Sunday', 'bath', [zoe])
    await chore('Fold the laundry', 300, 'weekly', 'Sunday', 'laundry', [maya, leo])
    await chore('Put your laundry away', 150, 'weekly', null, 'laundry', all3)
    await chore('Recycling to the curb', 150, 'weekly', 'Tuesday', 'recycle', [leo])
    await chore('Change your sheets', 250, 'weekly', 'Sunday', 'bed', all3)
    await chore('Rake the leaves', 300, 'weekly', 'seasonal', 'leaf', [maya, leo], false)

    // --- One-time bonuses ---------------------------------------------------
    const washCar = await chore('Wash the car', 550, 'once', null, 'car', [maya])
    await chore('Help with the groceries', 300, 'once', null, 'cart', [leo, zoe])
    await chore('Clean out the garage', 800, 'once', null, 'sparkle', all3)
    await chore('Wash the windows', 400, 'once', null, 'sparkle', [zoe])

    const goal = (kidId: number, title: string, cents: number, icon: string, active: boolean) =>
      conn.query('INSERT INTO goals (kid_id, title, target_cents, icon, active) VALUES (?, ?, ?, ?, ?)', [
        kidId,
        title,
        cents,
        icon,
        active ? 1 : 0,
      ])

    // Kids keep a few goals; exactly one is the tracked one.
    await goal(maya, 'Concert tickets', 4000, 'music', true)
    await goal(maya, 'Bluetooth speaker', 6500, 'music', false)
    await goal(maya, 'New headphones', 12000, 'sport', false)
    await goal(leo, 'Nintendo game', 5999, 'sport', true)
    await goal(leo, 'Skate helmet', 3500, 'sport', false)
    await goal(zoe, 'New skateboard', 4500, 'sport', true)
    await goal(zoe, 'Camera', 15000, 'sparkle', false)

    /*
     * What finishing each task means — the criteria the kid sees full-screen
     * before hitting Start. Written to the voice rules: second person, plain,
     * no scolding.
     */
    const DESCRIPTIONS: Record<string, string> = {
      'Take out the trash': 'Bag it, tie it, new bag in the bin, and the can out where the truck can reach it.',
      'Empty the dishwasher': 'Everything put away where it lives — not stacked on the counter.',
      'Make the bed': 'Sheets pulled flat, pillow at the top, blanket straightened. Ten seconds, done.',
      'Feed the dog': 'One scoop of food, fresh water in the bowl. Check the water even if the bowl is full.',
      'Walk the dog': 'At least 15 minutes, leash on, and bring bags.',
      'Read for 20 minutes': 'Any book you like. Comics count. Twenty real minutes, not twenty with your phone.',
      'Homework done': 'Every subject finished before screens. Ask for help early, not at bedtime.',
      'Practice piano': 'Twenty minutes at the keys. Scales first, then the piece you are working on.',
      'Mow the lawn': 'Front and back, edges included, clippings raked. Ask before mowing if the grass is wet.',
      'Clean the bathroom': 'Sink, mirror, toilet, and the floor. Towels folded on the rail.',
      'Tidy your room': 'Floor clear, desk clear, clothes in the basket or the drawer — not the chair.',
      'Wash the car': 'Soap, rinse, and dry — inside windows too. Buckets away when you are done.',
    }
    // A taste of photo proof: one required, one optional, the rest off.
    await conn.query(`UPDATE chores SET photo_proof = 'required' WHERE family_id = ? AND title = 'Tidy your room'`, [familyId])
    await conn.query(`UPDATE chores SET photo_proof = 'optional' WHERE family_id = ? AND title = 'Make the bed'`, [familyId])

    for (const [title, description] of Object.entries(DESCRIPTIONS)) {
      await conn.query('UPDATE chores SET description = ? WHERE family_id = ? AND title = ?', [
        description,
        familyId,
        title,
      ])
    }

    /*
     * The Good Stuff — things the Riveras would go halves on. Deliberately the
     * kind of thing a parent is glad to see wanted: a chemistry set, not a toy.
     */
    const suggest = (
      name: string,
      priceCents: number,
      matchPercent: number,
      icon: string,
      note: string | null,
      visibleTo: number | null,
      by: number,
    ) =>
      insert(
        `INSERT INTO suggested_items
           (family_id, created_by_user_id, name, price_cents, match_percent, image_key, note, visible_to_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [familyId, by, name, priceCents, matchPercent, icon, note, visibleTo],
      )

    await suggest('Chemistry set', 4000, 50, 'sparkle', "You've been asking about this for months.", null, dad)
    await suggest('Microscope', 6500, 50, 'book', null, null, dad)
    await suggest('Museum membership', 5000, 60, 'book', 'Gets you in free all year.', null, mom)
    await suggest('Guitar lessons — first block', 12000, 70, 'music', 'Ten lessons to start.', maya, mom)
    await suggest('Good skate helmet', 3500, 40, 'sport', 'Non-negotiable if you want the board.', leo, dad)
    await suggest('Sketchbook and pencils', 2200, 25, 'book', null, zoe, mom)

    /** A finished achievement a parent already approved: pays out at review time. */
    const approved = async (
      choreId: number,
      kidId: number,
      rewardCents: number,
      done: Date,
      reviewed: Date,
      reviewer: number,
      schedule: Schedule,
    ) => {
      const completionId = await insert(
        `INSERT INTO task_completions (chore_id, kid_id, completed_at, status, reviewed_by, reviewed_at, period_key)
         VALUES (?, ?, ?, 'approved', ?, ?, ?)`,
        [choreId, kidId, done, reviewer, reviewed, periodKeyFor(schedule, done)],
      )
      await insertTransaction(
        {
          kidId,
          type: 'earn',
          amountCents: rewardCents,
          relatedCompletionId: completionId,
          createdBy: reviewer,
          createdAt: reviewed,
        },
        conn,
      )
    }

    /** Waiting on a parent — no money moves yet. */
    const waiting = (choreId: number, kidId: number, done: Date, schedule: Schedule) =>
      conn.query(
        `INSERT INTO task_completions (chore_id, kid_id, completed_at, status, period_key)
         VALUES (?, ?, ?, 'pending', ?)`,
        [choreId, kidId, done, periodKeyFor(schedule, done)],
      )

    // --- Maya: the ledger, in the order it has to chain ---------------------
    await insertTransaction(
      {
        kidId: maya,
        type: 'deposit',
        amountCents: 1000,
        note: 'Allowance kickoff',
        createdBy: dad,
        createdAt: at(12, '18:00'),
      },
      conn,
    )
    await approved(washCar, maya, 550, at(3, '15:00'), at(3, '19:10'), mom, 'once')
    await approved(trash, maya, 200, at(1, '16:30'), at(1, '17:00'), mom, 'daily')
    // Mowed last week, only approved yesterday — earnings are dated at approval.
    await approved(mow, maya, 400, at(8, '11:00'), at(1, '17:30'), dad, 'weekly')

    const withdrawalAt = at(1, '18:00')
    const spend = await insertTransaction(
      {
        kidId: maya,
        type: 'withdraw',
        amountCents: -800,
        category: 'Going out',
        createdBy: mom,
        createdAt: withdrawalAt,
      },
      conn,
    )
    await conn.query(
      `INSERT INTO withdrawal_requests
         (kid_id, amount_cents, category, status, requested_at, confirmed_by, confirmed_at, transaction_id)
       VALUES (?, ?, ?, 'confirmed', ?, ?, ?, ?)`,
      [maya, 800, 'Going out', at(1, '17:45'), mom, withdrawalAt, spend.id],
    )

    await insertTransaction(
      {
        kidId: maya,
        type: 'deposit',
        amountCents: 1000,
        note: 'Birthday money from Grandma',
        createdBy: dad,
        createdAt: at(0, '06:50'),
      },
      conn,
    )
    await approved(feedDog, maya, 100, at(1, '18:40'), at(0, '07:20'), dad, 'daily')
    await waiting(feedDog, maya, at(0, '08:12'), 'daily')

    // --- Leo -----------------------------------------------------------------
    await insertTransaction(
      {
        kidId: leo,
        type: 'deposit',
        amountCents: 1025,
        note: 'Allowance kickoff',
        createdBy: dad,
        createdAt: at(12, '18:00'),
      },
      conn,
    )
    await approved(feedDog, leo, 100, at(2, '08:00'), at(2, '19:00'), dad, 'daily')
    await waiting(waterPlants, leo, at(1, '17:30'), 'daily')
    await waiting(makeBed, leo, at(0, '07:45'), 'daily')

    // --- Zoe -----------------------------------------------------------------
    await insertTransaction(
      {
        kidId: zoe,
        type: 'deposit',
        amountCents: 3400,
        note: 'Allowance kickoff',
        createdBy: mom,
        createdAt: at(12, '18:00'),
      },
      conn,
    )
    await approved(mow, zoe, 400, at(2, '10:00'), at(2, '18:00'), mom, 'weekly')
    await conn.query(
      `INSERT INTO withdrawal_requests (kid_id, amount_cents, category, note, status, requested_at)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      [zoe, 1200, 'Going out', 'movie with friends', at(0, '09:15')],
    )
  })
}

export async function ensureSeed(): Promise<void> {
  if (!(await isSeeded())) {
    await seed()
    console.log('Seeded the Rivera family (parent PINs: Dad 1234, Mom 4321)')
  }
}

// `npm run seed` reseeds from scratch; importing this module never wipes data.
if (argv[1] && resolve(argv[1]) === fileURLToPath(import.meta.url)) {
  await migrate()
  await wipe()
  await seed()
  console.log('Reseeded the Rivera family (parent PINs: Dad 1234, Mom 4321)')
  await pool.end()
}
