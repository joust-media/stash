import { all, run } from '../db.ts'
import { ingestImage } from './media.ts'

/*
 * Goal photos used to be stored as base64 data URLs on the goal row itself.
 * One-time, idempotent move onto the shared media system: each pending row is
 * decoded, pushed through the same pipeline as a fresh upload (re-encode,
 * strip, thumb), and the old column is cleared. Rows that fail stay as they
 * are — the client still renders a data URL fine — and are retried next boot.
 */
export async function convertLegacyImages(): Promise<void> {
  const rows = await all<{ id: number; kid_id: number; image: string }>(
    `SELECT id, kid_id, image FROM goals
      WHERE image IS NOT NULL AND image_media_id IS NULL`,
  )
  for (const row of rows) {
    try {
      const base64 = row.image.split(',')[1]
      if (!base64) continue
      const stored = await ingestImage(Buffer.from(base64, 'base64'), Number(row.kid_id))
      await run('UPDATE goals SET image_media_id = ?, image = NULL WHERE id = ?', [stored.id, row.id])
      console.log(`migrated goal ${row.id} photo -> media ${stored.id}`)
    } catch (err) {
      console.error(`legacy image migration failed for goal ${row.id}:`, (err as Error).message)
    }
  }
}
