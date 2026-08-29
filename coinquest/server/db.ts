import mysql from 'mysql2/promise'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

/*
 * MySQL 8. Timestamps are stored as UTC DATETIME(3) and the pool is pinned to
 * UTC (`timezone: 'Z'`) so a Date written here reads back as the same instant
 * regardless of where the server runs.
 */

/*
 * Managed MySQL is usually handed over as a connection URL, and Railway also
 * exposes MYSQLHOST/MYSQLUSER/… with no underscore. Read all three shapes:
 * without this the app silently falls back to 127.0.0.1 as root and the only
 * symptom is a connection refused at boot.
 */
function resolveConfig() {
  const url = process.env.MYSQL_URL ?? process.env.DATABASE_URL
  if (url) {
    const u = new URL(url)
    return {
      host: decodeURIComponent(u.hostname),
      port: Number(u.port || 3306),
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, '') || 'stash',
    }
  }
  return {
    host: process.env.MYSQL_HOST ?? process.env.MYSQLHOST ?? '127.0.0.1',
    port: Number(process.env.MYSQL_PORT ?? process.env.MYSQLPORT ?? 3306),
    user: process.env.MYSQL_USER ?? process.env.MYSQLUSER ?? 'root',
    password: process.env.MYSQL_PASSWORD ?? process.env.MYSQLPASSWORD ?? '',
    database: process.env.MYSQL_DATABASE ?? process.env.MYSQLDATABASE ?? 'stash',
  }
}

const config = resolveConfig()

export const pool = mysql.createPool({
  ...config,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: 'Z',
  decimalNumbers: true,
  supportBigNumbers: true,
  bigNumberStrings: false,
})

export type Row = Record<string, any>

/** SELECT returning many rows. */
export async function all<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await pool.query(sql, params)
  return rows as T[]
}

/** SELECT returning the first row, or undefined. */
export async function one<T = Row>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  const rows = await all<T>(sql, params)
  return rows[0]
}

export interface WriteResult {
  insertId: number
  affectedRows: number
}

/** INSERT / UPDATE / DELETE. */
export async function run(sql: string, params: unknown[] = []): Promise<WriteResult> {
  const [result] = await pool.query(sql, params)
  const r = result as mysql.ResultSetHeader
  return { insertId: Number(r.insertId), affectedRows: Number(r.affectedRows) }
}

/**
 * Runs `fn` inside a transaction on a single connection. Anything that reads a
 * balance and then writes against it must go through here, so the `FOR UPDATE`
 * row locks in `lib.ts` actually hold.
 */
export async function tx<T>(fn: (c: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const out = await fn(conn)
    await conn.commit()
    return out
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

/* --------------------------------------------------------------- schema --- */

const DDL = [
  `CREATE TABLE IF NOT EXISTS families (
     id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
     name       VARCHAR(120) NOT NULL,
     created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS users (
     id           INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
     family_id    INT UNSIGNED NOT NULL,
     name         VARCHAR(80) NOT NULL,
     role         ENUM('kid','parent') NOT NULL,
     age          TINYINT UNSIGNED NULL,
     avatar_color CHAR(7) NOT NULL,
     pin_hash     VARCHAR(255) NULL,
     nickname     VARCHAR(80) NULL,
     mascot_pose  VARCHAR(32) NULL,
     about        VARCHAR(240) NULL,
     created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
     updated_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
     KEY idx_users_family (family_id, role),
     CONSTRAINT fk_users_family FOREIGN KEY (family_id) REFERENCES families(id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS chores (
     id              INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
     family_id       INT UNSIGNED NOT NULL,
     title           VARCHAR(120) NOT NULL,
     reward_cents    INT UNSIGNED NOT NULL,
     schedule        ENUM('daily','weekly','once') NOT NULL,
     schedule_detail VARCHAR(80) NULL,
     icon            VARCHAR(40) NULL,
     active          TINYINT(1) NOT NULL DEFAULT 1,
     created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
     updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
     KEY idx_chores_family (family_id, active),
     CONSTRAINT fk_chores_family FOREIGN KEY (family_id) REFERENCES families(id),
     CONSTRAINT chk_chores_reward CHECK (reward_cents > 0)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS chore_assignments (
     chore_id INT UNSIGNED NOT NULL,
     kid_id   INT UNSIGNED NOT NULL,
     PRIMARY KEY (chore_id, kid_id),
     KEY idx_assignment_kid (kid_id),
     CONSTRAINT fk_assign_chore FOREIGN KEY (chore_id) REFERENCES chores(id) ON DELETE CASCADE,
     CONSTRAINT fk_assign_kid FOREIGN KEY (kid_id) REFERENCES users(id) ON DELETE CASCADE
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  /*
   * MySQL has no partial indexes, so "one live completion per chore, per kid,
   * per period" is enforced with a stored generated column that goes NULL once
   * a completion is rejected — and a UNIQUE index ignores NULLs. Sending a task
   * back therefore frees the slot without deleting history.
   */
  `CREATE TABLE IF NOT EXISTS task_completions (
     id                INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
     chore_id          INT UNSIGNED NOT NULL,
     kid_id            INT UNSIGNED NOT NULL,
     started_at        DATETIME(3) NULL,
     completed_at      DATETIME(3) NULL,
     status            ENUM('in_progress','pending','approved','rejected') NOT NULL,
     reviewed_by       INT UNSIGNED NULL,
     reviewed_at       DATETIME(3) NULL,
     period_key        VARCHAR(24) NOT NULL,
     active_period_key VARCHAR(24) AS (IF(status = 'rejected', NULL, period_key)) STORED,
     UNIQUE KEY uq_completion_period (chore_id, kid_id, active_period_key),
     KEY idx_completion_status (status, completed_at),
     KEY idx_completion_kid (kid_id, completed_at),
     CONSTRAINT fk_completion_chore FOREIGN KEY (chore_id) REFERENCES chores(id),
     CONSTRAINT fk_completion_kid FOREIGN KEY (kid_id) REFERENCES users(id),
     CONSTRAINT fk_completion_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS transactions (
     id                    INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
     kid_id                INT UNSIGNED NOT NULL,
     type                  ENUM('earn','deposit','withdraw') NOT NULL,
     amount_cents          INT NOT NULL,
     note                  VARCHAR(240) NULL,
     category              VARCHAR(60) NULL,
     related_completion_id INT UNSIGNED NULL,
     created_by            INT UNSIGNED NOT NULL,
     created_at            DATETIME(3) NOT NULL,
     balance_after_cents   INT NOT NULL,
     KEY idx_tx_kid (kid_id, id DESC),
     KEY idx_tx_created (created_at),
     CONSTRAINT fk_tx_kid FOREIGN KEY (kid_id) REFERENCES users(id),
     CONSTRAINT fk_tx_creator FOREIGN KEY (created_by) REFERENCES users(id),
     CONSTRAINT fk_tx_completion FOREIGN KEY (related_completion_id) REFERENCES task_completions(id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS goals (
     id           INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
     kid_id       INT UNSIGNED NOT NULL,
     title        VARCHAR(120) NOT NULL,
     target_cents INT UNSIGNED NOT NULL,
     icon         VARCHAR(40) NULL,
     active       TINYINT(1) NOT NULL DEFAULT 1,
     created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
     KEY idx_goals_kid (kid_id, active),
     CONSTRAINT fk_goals_kid FOREIGN KEY (kid_id) REFERENCES users(id) ON DELETE CASCADE,
     CONSTRAINT chk_goals_target CHECK (target_cents > 0)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS withdrawal_requests (
     id             INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
     kid_id         INT UNSIGNED NOT NULL,
     amount_cents   INT UNSIGNED NOT NULL,
     category       VARCHAR(60) NOT NULL,
     note           VARCHAR(240) NULL,
     status         ENUM('pending','confirmed','declined') NOT NULL,
     requested_at   DATETIME(3) NOT NULL,
     confirmed_by   INT UNSIGNED NULL,
     confirmed_at   DATETIME(3) NULL,
     transaction_id INT UNSIGNED NULL,
     KEY idx_withdrawal_status (status, requested_at),
     CONSTRAINT fk_wd_kid FOREIGN KEY (kid_id) REFERENCES users(id),
     CONSTRAINT fk_wd_confirmer FOREIGN KEY (confirmed_by) REFERENCES users(id),
     CONSTRAINT fk_wd_tx FOREIGN KEY (transaction_id) REFERENCES transactions(id),
     CONSTRAINT chk_wd_amount CHECK (amount_cents > 0)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  /*
   * The Good Stuff: things a parent would like the kid to have, each carrying a
   * share the parent commits to covering. A kid adopts one and it becomes an
   * ordinary goal priced at their share alone.
   *
   * This is a list a parent types, not a catalogue — no merchants, no feeds, no
   * external anything. That distinction is deliberate and load-bearing.
   *
   * Rows are never hard-deleted; `active = 0` retires one while leaving every
   * goal already adopted from it untouched.
   */
  `CREATE TABLE IF NOT EXISTS suggested_items (
     id                 INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
     family_id          INT UNSIGNED NOT NULL,
     created_by_user_id INT UNSIGNED NOT NULL,
     name               VARCHAR(80) NOT NULL,
     price_cents        INT UNSIGNED NOT NULL,
     match_percent      TINYINT UNSIGNED NOT NULL DEFAULT 0,
     image_key          VARCHAR(120) NULL,
     note               VARCHAR(160) NULL,
     visible_to_user_id INT UNSIGNED NULL,
     active             TINYINT(1) NOT NULL DEFAULT 1,
     created_at         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
     updated_at         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
     KEY idx_suggested_family (family_id, active),
     CONSTRAINT fk_si_family  FOREIGN KEY (family_id) REFERENCES families(id),
     CONSTRAINT fk_si_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id),
     CONSTRAINT fk_si_visible FOREIGN KEY (visible_to_user_id) REFERENCES users(id),
     CONSTRAINT chk_si_price CHECK (price_cents > 0),
     CONSTRAINT chk_si_match CHECK (match_percent BETWEEN 0 AND 90)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  /*
   * Stash carrying a message: a kid can send him to remind a parent about
   * whatever is waiting. Rate-limited to two a day per kid — a nudge is a
   * nudge, not a siege — and the rows are the rate limit, so they are never
   * deleted, just aged past.
   */
  `CREATE TABLE IF NOT EXISTS reminders (
     id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
     kid_id     INT UNSIGNED NOT NULL,
     created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
     KEY idx_reminders_kid (kid_id, created_at),
     CONSTRAINT fk_rem_kid FOREIGN KEY (kid_id) REFERENCES users(id) ON DELETE CASCADE
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
]

/*
 * Additive columns. `CREATE TABLE IF NOT EXISTS` does nothing to a table that
 * already exists, so anything added after a database is first created has to be
 * applied here too. Each entry is idempotent: it checks information_schema and
 * only alters when the column is genuinely missing.
 */
const ADDED_COLUMNS: { table: string; column: string; definition: string }[] = [
  { table: 'task_completions', column: 'started_at', definition: 'DATETIME(3) NULL' },
  { table: 'users', column: 'nickname', definition: 'VARCHAR(80) NULL' },
  { table: 'users', column: 'mascot_pose', definition: 'VARCHAR(32) NULL' },
  { table: 'users', column: 'about', definition: 'VARCHAR(240) NULL' },
  { table: 'chores', column: 'icon', definition: 'VARCHAR(40) NULL' },
  { table: 'goals', column: 'icon', definition: 'VARCHAR(40) NULL' },
  { table: 'withdrawal_requests', column: 'note', definition: 'VARCHAR(240) NULL' },

  /*
   * The Good Stuff. The three goal columns are a SNAPSHOT taken at adoption and
   * are never read back through to `suggested_items`: if a parent later edits or
   * retires the item, a goal already adopted from it does not move. A kid must
   * never watch their target change.
   *
   * No foreign key on `suggested_item_id` for exactly that reason — the goal has
   * to outlive the row it came from.
   */
  { table: 'goals', column: 'suggested_item_id', definition: 'INT UNSIGNED NULL' },
  { table: 'goals', column: 'match_percent_locked', definition: 'TINYINT UNSIGNED NULL' },
  { table: 'goals', column: 'match_amount_cents', definition: 'INT UNSIGNED NULL' },

  // Carries a claim from request through approval to the ledger line.
  { table: 'withdrawal_requests', column: 'goal_id', definition: 'INT UNSIGNED NULL' },
  { table: 'transactions', column: 'goal_id', definition: 'INT UNSIGNED NULL' },

  // What finishing the task actually means — the criteria the kid agrees to
  // when they hit Start, shown full-screen before the task begins.
  { table: 'chores', column: 'description', definition: 'VARCHAR(240) NULL' },

  /*
   * A goal can carry a real photo of the thing — stored inline as a compressed
   * data URL rather than on disk, because the deploy filesystem is ephemeral
   * and an image that vanishes on the next release is worse than none.
   * The client resizes before upload; the server enforces the byte cap.
   */
  { table: 'goals', column: 'image', definition: 'MEDIUMTEXT NULL' },
]

/*
 * Columns whose type changed after first release. `MODIFY COLUMN` is naturally
 * idempotent — re-applying the same definition is a no-op — so these run every
 * boot rather than being version-gated.
 */
const CHANGED_COLUMNS: { table: string; sql: string }[] = [
  {
    table: 'task_completions',
    sql: `ALTER TABLE task_completions
            MODIFY COLUMN status ENUM('in_progress','pending','approved','rejected') NOT NULL,
            MODIFY COLUMN completed_at DATETIME(3) NULL`,
  },
]

async function ensureColumns(): Promise<void> {
  for (const { table, column, definition } of ADDED_COLUMNS) {
    const [rows] = await pool.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_schema = ? AND table_name = ? AND column_name = ? LIMIT 1`,
      [config.database, table, column],
    )
    if ((rows as unknown[]).length === 0) {
      await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`)
      console.log(`migrated: ${table}.${column}`)
    }
  }

  for (const { sql } of CHANGED_COLUMNS) await pool.query(sql)
}

/** Creates the database if missing, applies the schema, then adds any new columns. */
export async function migrate(): Promise<void> {
  // A managed database already exists and its user often cannot CREATE DATABASE,
  // so this is best-effort: it matters locally, and is a no-op in the cloud.
  try {
    const bootstrap = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
    })
    await bootstrap.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    )
    await bootstrap.end()
  } catch (err) {
    console.log(`skipping database bootstrap: ${(err as Error).message}`)
  }

  for (const statement of DDL) await pool.query(statement)
  await ensureColumns()
}

export function describeConnection(): string {
  return `mysql://${config.user}@${config.host}:${config.port}/${config.database}`
}

/* ------------------------------------------------------------------ pin --- */

export function hashPin(pin: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(pin, salt, 64)
  return `${salt.toString('hex')}:${hash.toString('hex')}`
}

export function verifyPin(pin: string, stored: string | null): boolean {
  if (!stored) return false
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = scryptSync(pin, Buffer.from(saltHex, 'hex'), expected.length)
  return timingSafeEqual(expected, actual)
}
