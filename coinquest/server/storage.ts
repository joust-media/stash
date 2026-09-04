import { one, run } from './db.ts'

/*
 * Where image bytes actually live, behind the one interface every call site
 * uses. Swap in S3 (or anything) later by writing another implementation and
 * changing the export at the bottom — nothing else in the codebase knows.
 *
 * The first implementation stores blobs in MySQL rather than the spec's local
 * `/uploads` directory, deliberately: the deploy host's filesystem is wiped on
 * every release, so disk storage would delete every family's photos each time
 * we ship. At prototype scale — re-encoded JPEGs, ~100–400KB each — the
 * database is the boring, durable answer.
 */

export interface StorageAdapter {
  put(key: string, data: Buffer): Promise<void>
  get(key: string): Promise<Buffer | null>
  delete(key: string): Promise<void>
}

class DbStorage implements StorageAdapter {
  async put(key: string, data: Buffer): Promise<void> {
    await run('INSERT INTO media_blobs (storage_key, data) VALUES (?, ?)', [key, data])
  }

  async get(key: string): Promise<Buffer | null> {
    const row = await one<{ data: Buffer }>('SELECT data FROM media_blobs WHERE storage_key = ?', [key])
    return row ? Buffer.from(row.data) : null
  }

  async delete(key: string): Promise<void> {
    await run('DELETE FROM media_blobs WHERE storage_key = ?', [key])
  }
}

export const storage: StorageAdapter = new DbStorage()
