import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import sharp, { type Sharp } from 'sharp'
import { all, one, run } from '../db.ts'
import { storage } from '../storage.ts'
import { HttpError, getUser } from '../lib.ts'

export const mediaRoutes = new Hono()

/*
 * The one upload pipeline, used by everything that attaches an image: goal
 * photos, achievement art, avatars, cash-out snaps, proof photos.
 *
 * Every upload is treated as hostile until re-encoded:
 *  - the file type comes from magic bytes, never the Content-Type header or
 *    the filename — a .pdf renamed to .jpg is rejected, a .png renamed to
 *    .jpg is simply a png;
 *  - the whole image is decoded and re-encoded through sharp, which discards
 *    anything hiding in the original container;
 *  - EXIF — including GPS, which on a child's photo is a home address — is
 *    stripped, after the orientation tag is applied so portraits stay upright.
 */

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024
const MAX_EDGE = 1600
const THUMB_EDGE = 320

type Sniffed = 'jpeg' | 'png' | 'webp' | 'heic'

/** File type from the bytes themselves. Returns null for anything else (pdf, svg, …). */
function sniff(buf: Buffer): Sniffed | null {
  if (buf.length < 16) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg'
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png'
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP')
    return 'webp'
  if (buf.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buf.subarray(8, 12).toString('ascii')
    if (['heic', 'heix', 'mif1', 'msf1', 'heim', 'heis', 'hevc'].includes(brand)) return 'heic'
  }
  return null
}

export interface StoredMedia {
  id: number
  width: number
  height: number
  url: string
  thumbUrl: string
}

export function mediaUrl(id: number | null | undefined): string | null {
  return id ? `/api/media/${id}` : null
}
export function mediaThumbUrl(id: number | null | undefined): string | null {
  return id ? `/api/media/${id}/thumb` : null
}

/** The full pipeline: sniff, re-encode, resize, thumb, store, record. */
export async function ingestImage(buf: Buffer, createdBy: number): Promise<StoredMedia> {
  if (buf.length > MAX_UPLOAD_BYTES) throw new HttpError(400, 'That photo is too big — 15MB is the limit')

  const kind = sniff(buf)
  if (!kind) throw new HttpError(400, 'That is not a photo Stash can use')

  let pipeline: Sharp
  try {
    // .rotate() with no arguments applies the EXIF orientation tag; the
    // re-encode then drops all metadata (sharp strips it unless asked to keep).
    pipeline = sharp(buf).rotate()
    await pipeline.metadata()
  } catch {
    // Most iPhones hand the browser a JPEG, but a raw HEIC can slip through
    // and stock sharp cannot decode it. Say so plainly rather than 500ing.
    throw new HttpError(
      400,
      kind === 'heic' ? 'That photo format did not come through — try taking it again' : 'That photo did not come through right — try another',
    )
  }

  const full = await pipeline
    .clone()
    .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer({ resolveWithObject: true })
  const thumb = await pipeline
    .clone()
    .resize(THUMB_EDGE, THUMB_EDGE, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 78 })
    .toBuffer()

  const storageKey = randomUUID()
  const thumbKey = `${storageKey}-thumb`
  await storage.put(storageKey, full.data)
  await storage.put(thumbKey, thumb)

  const { insertId } = await run(
    `INSERT INTO media (storage_key, mime, width, height, bytes, thumb_key, created_by)
     VALUES (?, 'image/jpeg', ?, ?, ?, ?, ?)`,
    [storageKey, full.info.width, full.info.height, full.data.length, thumbKey, createdBy],
  )

  return {
    id: insertId,
    width: full.info.width,
    height: full.info.height,
    url: `/api/media/${insertId}`,
    thumbUrl: `/api/media/${insertId}/thumb`,
  }
}

/** Removes the row and both blobs. Owning FKs must be nulled by the caller. */
export async function destroyMedia(id: number): Promise<void> {
  const row = await one<{ storage_key: string; thumb_key: string }>(
    'SELECT storage_key, thumb_key FROM media WHERE id = ?',
    [id],
  )
  if (!row) return
  await storage.delete(row.storage_key)
  await storage.delete(row.thumb_key)
  await run('DELETE FROM media WHERE id = ?', [id])
}

/**
 * The daily sweep: proof photos age out 30 days after approval. The photo's
 * job — letting a parent verify a claim — ended the moment they approved;
 * keeping a child's photo after that is liability, not history. The
 * transaction record survives; History just stops showing a thumbnail.
 */
export async function purgeExpiredMedia(): Promise<number> {
  const due = await all<{ id: number }>(
    'SELECT id FROM media WHERE purge_after IS NOT NULL AND purge_after < NOW(3)',
  )
  for (const row of due) {
    await run('UPDATE task_completions SET proof_media_id = NULL WHERE proof_media_id = ?', [row.id])
    await destroyMedia(Number(row.id))
  }
  return due.length
}

/** POST /api/media — multipart: `file` + `actorId`. */
mediaRoutes.post('/', async (c) => {
  const body = await c.req.parseBody()
  const file = body.file
  const actor = await getUser(Number(body.actorId))
  if (!actor) throw new HttpError(403, 'Who is uploading this?')
  if (!(file instanceof File)) throw new HttpError(400, 'Attach a photo')
  if (file.size > MAX_UPLOAD_BYTES) throw new HttpError(400, 'That photo is too big — 15MB is the limit')

  const stored = await ingestImage(Buffer.from(await file.arrayBuffer()), actor.id)
  return c.json(stored, 201)
})

async function serveBlob(c: any, key: string | undefined) {
  if (!key) throw new HttpError(404, 'No such photo')
  const data = await storage.get(key)
  if (!data) throw new HttpError(404, 'No such photo')
  return c.body(data, 200, {
    'Content-Type': 'image/jpeg',
    'Cache-Control': 'private, max-age=86400',
    'Content-Length': String(data.length),
  })
}

/*
 * Served through the API on purpose, never as a static directory. There is no
 * access control on these yet — but the route is the place it will live, and
 * a guessable public path to a child's photo is a hole that cannot be closed
 * after launch. IDs are sequential but keys are random UUIDs internally.
 */
mediaRoutes.get('/:id', async (c) => {
  const row = await one<{ storage_key: string }>('SELECT storage_key FROM media WHERE id = ?', [
    Number(c.req.param('id')),
  ])
  return serveBlob(c, row?.storage_key)
})

mediaRoutes.get('/:id/thumb', async (c) => {
  const row = await one<{ thumb_key: string }>('SELECT thumb_key FROM media WHERE id = ?', [
    Number(c.req.param('id')),
  ])
  return serveBlob(c, row?.thumb_key)
})
