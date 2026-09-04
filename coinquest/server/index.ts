import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { describeConnection, migrate } from './db.ts'
import { HttpError } from './lib.ts'
import { approvalRoutes } from './routes/approvals.ts'
import { authRoutes } from './routes/auth.ts'
import { choreRoutes } from './routes/chores.ts'
import { familyRoutes } from './routes/family.ts'
import { goalRoutes } from './routes/goals.ts'
import { goodStuffRoutes } from './routes/goodStuff.ts'
import { kidRoutes } from './routes/kids.ts'
import { mediaRoutes, purgeExpiredMedia } from './routes/media.ts'
import { convertLegacyImages } from './routes/legacyImages.ts'
import { moneyRoutes } from './routes/money.ts'
import { reminderRoutes } from './routes/reminders.ts'
import { taskRoutes } from './routes/tasks.ts'
import { userRoutes } from './routes/users.ts'
import { ensureSeed } from './seed.ts'

await migrate()
await ensureSeed()
await convertLegacyImages()

/*
 * Proof photos age out 30 days after approval (§B6). Swept on boot and every
 * six hours after — a purge job that only runs at midnight never runs on a
 * host that restarts daily.
 */
purgeExpiredMedia().catch((err) => console.error('media purge failed:', err))
setInterval(
  () => purgeExpiredMedia().catch((err) => console.error('media purge failed:', err)),
  6 * 60 * 60 * 1000,
)

const app = new Hono()

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status as 400)
  console.error(err)
  return c.json({ error: 'Something went wrong' }, 500)
})

const api = new Hono()
api.get('/health', (c) => c.json({ ok: true, db: describeConnection() }))
api.route('/auth', authRoutes)
api.route('/family', familyRoutes)
api.route('/kids', kidRoutes)
api.route('/users', userRoutes)
api.route('/chores', choreRoutes)
api.route('/goals', goalRoutes)
api.route('/good-stuff', goodStuffRoutes)
api.route('/money', moneyRoutes)
api.route('/reminders', reminderRoutes)
api.route('/media', mediaRoutes)
api.route('/approvals', approvalRoutes)
api.route('/', taskRoutes)

app.route('/api', api)

/*
 * In production the API also serves the built client, so a deployment is a
 * single service. Unknown paths fall back to index.html for client routing.
 */
if (process.env.NODE_ENV === 'production') {
  /*
   * An unknown /api path must not fall through to index.html: the client would
   * see a 200, try to parse HTML as JSON, and report a generic failure instead
   * of the 404 it actually got. Only the dev proxy makes this obvious, so the
   * guard has to live here.
   */
  app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404))

  app.use('/*', serveStatic({ root: './dist' }))
  app.get('*', serveStatic({ path: './dist/index.html' }))
}

const port = Number(process.env.PORT ?? 8787)
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Stash API on http://localhost:${info.port} → ${describeConnection()}`)
})
