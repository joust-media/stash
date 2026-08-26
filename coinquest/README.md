# Stash — Earn it. Save it. Stash it.

A kids' earn-and-save money app. Children earn real money through real
achievements; **a parent approves every movement of money, in both directions.**

Behaviour and data come from the handoff in `../assets/design files/`. The visual
system comes from the brand guide in `../assets/design-system/`.

> The folder is still named `coinquest` (the original handoff's working title).
> Renaming it to `stash` only needs the path updated in `../.claude/launch.json`.

## Deploying

The API serves the built client in production, so a deployment is **one service
plus a MySQL database**. `npm run build` emits `dist/`; `npm start` runs the API
with `NODE_ENV=production` and serves `dist/` with an SPA fallback. The schema is
applied and an empty database is seeded on boot.

```bash
docker compose up --build     # app + MySQL locally → http://localhost:8787
```

`Dockerfile` is a two-stage build (build the client, run the API), and
`railway.json` wires it up for Railway.

### Railway

1. **New Project → Deploy from GitHub repo**, pointed at this folder. Railway
   reads `railway.json` and builds the Dockerfile.
2. **New → Database → MySQL** in the same project.
3. On the app service, **Variables → add** (Railway exposes the database's own
   values as `MYSQL*` references you can pick from the UI):

   ```
   PORT=8787
   MYSQL_HOST=${{MySQL.MYSQLHOST}}
   MYSQL_PORT=${{MySQL.MYSQLPORT}}
   MYSQL_USER=${{MySQL.MYSQLUSER}}
   MYSQL_PASSWORD=${{MySQL.MYSQLPASSWORD}}
   MYSQL_DATABASE=${{MySQL.MYSQLDATABASE}}
   ```

4. **Settings → Networking → Generate Domain.**

First boot applies the schema and seeds the Rivera family. Health check is
already set to `GET /api/health`. To reset the demo data later, run
`npm run seed` from a Railway shell on the service.

Any other host works the same way: build `npm ci && npm run build`, start
`npm start`, plus the env vars from `.env.example`.

> **This is a dev environment, not a private one.** The parent PINs are the
> seeded demo values (Dad `1234`, Mom `4321`) and the app has no authentication
> beyond them — anyone with the URL can open it and unlock parent mode. That is
> a deliberate choice for a shareable demo with fake data. Before real families
> or real money, this needs accounts and sessions; see **Not built**.

## Running it locally

Needs a MySQL 8+ server. On this machine it was installed with Homebrew:

```bash
brew install mysql && brew services start mysql
```

Then:

```bash
npm install && npm run dev
```

The API creates the `stash` database, applies the schema, and seeds the Rivera
family on first boot. API on `:8787`, web app on `:5173`.

Parent mode PINs: **Dad `1234`**, **Mom `4321`**.

| Command | What it does |
| --- | --- |
| `npm run dev` | API + web app together |
| `npm run seed` | Migrate, wipe, and reseed the demo family |
| `npm run build` | Typecheck and build the client |
| `npm start` | Production: API serving the built client |

Connection settings come from the environment, defaulting to a local install:
`MYSQL_HOST` `MYSQL_PORT` `MYSQL_USER` `MYSQL_PASSWORD` `MYSQL_DATABASE`.

## Stack

- **React 19 + Vite + TypeScript**, TanStack Query for server state
- **Tailwind v4**, with the Stash tokens defined once in `src/index.css`
- **Baloo 2** (display) and **Nunito** (body) from Google Fonts
- **Hono** on Node, **MySQL 8** through `mysql2/promise`

## Layout

```
shared/types.ts     wire types shared by the API and the client
server/
  db.ts             pool, schema DDL, transactions, PIN hashing
  lib.ts            scheduling periods, balances, row mappers
  seed.ts           the demo family
  routes/           auth · family · kids · users · chores · goals · money · approvals · tasks
src/
  index.css         the whole design system: tokens, utilities, motion
  components/       ui · Hero · Mascot · Money · ForestBackdrop · TaskList · LedgerView · Keypad
  screens/          one file per screen
public/stash/       mascot poses cropped from the locked master
```

Money is integer cents everywhere. Every transaction stores its running balance
in `balance_after_cents`, so the ledger's per-row balance is read, not computed.

**Formatting lives in `shared/money.ts`**, used by both the API and the client so
a label built on the server never disagrees with one built in the browser. Whole
dollars drop the `.00` — `$2`, `$10`, `$1,000` — while anything with cents keeps
them: `$1.50`, `$24.50`. Rounding $2.50 to $2 would lose real money, so only the
empty decimals go. `Money` renders the cents at 60% per the type rules, and the
span simply does not render when there are none.

## Screens

| Screen | Route |
| --- | --- |
| Welcome / who's earning | `/` |
| Kid home | `/kid/:id` |
| Achievements | `/kid/:id/tasks` |
| Goals | `/kid/:id/goals` |
| Piggy bank (add funds / take money out) | `/kid/:id/bank` |
| History | `/kid/:id/history` |
| Celebration | `/kid/:id/done` |
| Profile editor | `/profile/:personId` |
| Parent PIN gate | `/parent/pin` |
| Family overview | `/parent` |
| Manage (admin) | `/parent/admin` |
| Approvals | `/parent/approvals` |
| Ledger | `/parent/ledger` |
| Add cash | `/parent/deposit` |

### Heroes

Every screen opens with a `<Hero>`, and **every hero is the same height** — one
constant, `BAND_HEIGHT` in `Hero.tsx` — so the app does not jump as you move
between tabs. It is a full-width Leaf Green band carrying the locked forest
layer, rounded only at the bottom (0 0 32 32) per the guide, and it takes over
the status bar slot so the green runs to the very top edge.

**Stash owns the right half at full band height**, with the screen's words left
of him on the same row — so he reads large without costing vertical space. He is
sized to the exact width of his column, never wider, so he is never trimmed at
the sides; the band crops him from the waist down and `.mascot-bust` masks that
cut into a fade rather than a slice.

Three constants at the top of `Hero.tsx` control this, and **`BAND_HEIGHT` and
`MASCOT_COLUMN` move together**: because he is sized by width, a taller band on
its own only adds empty green beneath him — his column has to widen for him to
actually get bigger. `TEXT_INSET` is the padding that keeps the words off him,
and every line in the text column is width-bounded and clamped so nothing can
spill onto his face.

A note on the geometry: the poses are near-square (~0.9:1), so "top half at full
height" and "narrow column" cannot both hold — filling the height from a 50% crop
would need him roughly twice as wide as the column, which trims his ears and the
acorn. Sizing by width and letting the band do the cropping gets the same look
with nothing clipped.

Back arrows and per-screen controls float over the band so they never change its
height. The status bar paints above him, the way a phone's does over a hero image.

A hero can carry **one progress bar** — the single thing being worked towards.
It sits low in the band where the mask has already faded Stash out, so it runs
the full width without crowding him.

| Screen | Bar shows |
| --- | --- |
| Home | The kid's active goal (tap it to open Goals), or the savings ladder |
| Goals | The active goal |
| Achievements | The achievement rung being climbed |
| Piggy bank | The next savings rung |
| History | No bar — same height regardless |

## Milestones

One thing at a time, on two ladders, both derived in `server/milestones.ts`:

- **Achievements** advance on lifetime approved completions — First win, Warming
  up, On a roll, Chore champ, Halfway to 100, Century club, Legend.
- **Savings** advance on balance — $10, $25, $50, $100, $250, $500, $1,000.

Progress runs from the rung below, so a bar never restarts at zero. Nothing is
stored and nothing needs configuring; if these should become parent-authored
instead, `milestones.ts` is the seam — swap the two functions for table reads and
no screen changes.

## Task tiles and icons

Tasks, achievements and things-to-do all render as the same tile in a
**two-column grid**: icon, name, when, and what it pays. One component,
`TaskTile`, is used on Home, Achievements, and the Add-funds picker, so the
three stay in step.

**Icons are a flagged substitution.** The brand guide defines no icon set and
says to prefer text labels; where icons are unavoidable it names a rounded,
filled, friendly set — Phosphor Fill — tinted with brand colours. That is what
`ChoreIcon.tsx` wraps, and it is used only on task tiles. Each chore stores an
`icon` key, chosen from a picker in Manage.

## Outstanding approvals

Both sides now see what is waiting. The parent has the queue at
`/parent/approvals`; the kid sees **Waiting on a parent** on Home and in the
Piggy Bank, listing money in and money out together with a running total of
each. `KidHome.requests` carries both kinds.

## Nudges

A milestone within 80% of its rung carries a `nudge` — "Only $0.50 to go!" —
shown as a gold strip above the content. Below 80% there is no nudge, because
"only" would be a lie.

## Start and End

A task runs **Start → End**, not a single tap:

1. Tapping an untouched tile **starts** it. `started_at` is stamped and the slot
   is reserved, so nobody else — and no other tab — can start the same thing.
2. The tile moves to an **In progress** section at the top of Home and
   Achievements, showing how long it has been running, with **End** and a quiet
   **Never mind**.
3. **End** is the moment the parent is alerted: the completion flips to
   `pending` and joins the approval queue.

Work in progress never reaches a parent, so a kid part-way through a chore is
not pestering anyone. `Never mind` deletes the in-progress row and frees the
slot; nothing is logged.

`task_completions.status` is now
`in_progress | pending | approved | rejected`, and `completed_at` is nullable —
it is only set at End. The generated `active_period_key` treats `in_progress`
like any other live state, so starting a task holds its period slot.

## Goals — the kid's own

Goals belong to the kid, not the parent. `/kid/:id/goals` lets them name what
they want, say what it costs, pick a picture for it, and keep **as many as they
like**. Exactly one is `active`, and that is the one every tracker in the app
measures against — so what the bars mean is the kid's decision.

The server decides who may change what: a kid can create and edit their own
goals, a parent can do it for anyone in the family, and neither can touch
another family. Deleting the tracked goal promotes the next one, so a kid with
goals is never left with nothing being tracked.

The kid nav now matches the brand guide exactly — **HOME · ACHIEVEMENTS · GOALS
· PIGGY BANK** — and History moved to a link on the Piggy Bank, which is where
the money already lives.

## Adding funds

The Piggy Bank is where money moves in both directions, and **"Add funds" is the
screen's one big move**:

1. Tap **Add funds** — a full-width Leaf Green card, not a pill, because it is
   the point of the screen.
2. Pick **one** thing to do from the list of what is currently earnable.
3. Hit **Start**, then **End** it when the job is done.

End files a `pending` completion and hands off to the celebration screen. No
money moves until a parent approves it in the queue.

**Add funds and Take out are the same size**, side by side: taking money out is
the point of saving, so it gets equal footprint. Only one of the two is the
filled primary, which keeps the brand's one-primary-CTA rule intact.

**Adding artwork.** Poses live in one registry, `POSES` in
`src/components/Mascot.tsx`. To add purpose-drawn hero art: drop the file in
`public/stash/`, add a line to `POSES`, and add the name to `Pose` in
`shared/types.ts`. Screens pick their pose through `HERO_POSE`, and a person's
own choice (set in their profile) overrides it — so new art appears everywhere
without touching a screen.

Current poses come from the locked character sheet, cut with an edge flood-fill,
the studio floor shadow removed, and downscaled in premultiplied alpha so no
white fringe survives onto Leaf Green. His drop shadow is CSS, not baked in.

## Approvals — the money gate

Nothing enters or leaves a stash without a parent. Both halves live in **one
queue** at `/parent/approvals`:

| Kind | What the kid does | What approval does |
| --- | --- | --- |
| `achievement` | Marks a task done → `pending` completion, no money | Writes the `earn` transaction and raises the balance |
| `withdrawal` | Asks to take money out → `pending` request, no money | Writes the `withdraw` transaction and lowers the balance |

- Rejecting an achievement ("Send back") returns it to the kid's list.
  Rejecting a withdrawal declines it. Neither moves money.
- A kid cannot ask for more than their balance **minus anything already
  promised to an open request** — checked under a row lock so two requests
  cannot both pass.
- Bulk approve covers achievements only. Handing over cash is a physical act per
  request, so withdrawals are never cleared in bulk.
- Every balance read that precedes a write happens inside a transaction with
  `SELECT … FOR UPDATE`.

## Profiles

`/profile/:personId` edits name, nickname, age, an about line, avatar colour
(restricted to the Stash palette), and which Stash pose greets them.

The server enforces who may edit what: a kid may edit only themselves, a parent
may edit anyone in the family, and only a parent can set or clear a PIN. Kids
reach their own profile from the avatar in their home hero; parents reach anyone
from **Manage → People**.

## Manage (parent admin)

Three sections behind the PIN gate:

- **Achievements** — create, edit (title, reward, schedule, who it's assigned
  to), pause/resume, delete. Deleting is blocked once a completion exists; the
  card shows how many are logged and pausing is the way out.
- **Goals** — one active goal per kid; setting a new one retires the old.
- **People** — add a kid or parent, and open anyone's profile.

Reached from the welcome screen: **Parent & admin** unlocks to the family
overview, and **Manage achievements** (`/parent/pin?to=admin`) unlocks straight
into Manage. Both go through the PIN gate.

## Schema

MySQL 8, InnoDB, utf8mb4. Follows the handoff's suggested schema with these
additions:

| Addition | Why |
| --- | --- |
| `task_completions.period_key` | Tells whether *today's* "take out the trash" is done. |
| `task_completions.active_period_key` | Stored generated column: `NULL` when rejected, otherwise `period_key`. MySQL has no partial indexes, so this plus a `UNIQUE` key gives "one live completion per chore, per kid, per period" — and sending a task back frees the slot without deleting history. |
| `withdrawal_requests` | The kid-requested / parent-approved middle state. |
| `transactions.category` | The "what's it for?" tag; `note` stays for deposit notes. |
| `users.nickname` / `about` / `mascot_pose` | Profile fields. |

`amount_cents` is signed: positive for `earn` and `deposit`, negative for
`withdraw`, so a running balance is a plain sum.

## How the brand is applied

`tokens/*.css` is dropped in verbatim at the top of `src/index.css`, then mapped
into Tailwind's `@theme`. Exact values are kept — nothing is snapped to a grid.

- **Type** — Baloo 2 ExtraBold titles (28–32) and card titles (20–22), Bold 18
  buttons; Nunito 16/1.55 body, Bold 13 / 0.16em eyebrows. Money is Baloo 2
  ExtraBold with cents at 60%.
- **Buttons** — pills at radius 999, min-height 56, one primary per screen.
  Hover lifts 2px and scales 1.02; press scales 0.97.
- **Cards** — white, radius 20, `0 6px 18px rgba(92,51,25,.10)`. Inset panels 12.
- **Forest layer** — acorn and oak-leaf silhouettes, white at 5–7%, 88–156px,
  cropped at the edges, over Leaf Green only.

### Judgment calls

1. **Gold is used as a fill, not as type.** "Gold only when the kid wins" is
   absolute, but Acorn Gold as text on cream or green fails contrast. Won
   amounts render as a gold pill with Mustache Brown text — the guide's own
   `reward` pairing — so gold marks every win and stays legible.
2. **A pending achievement is not a win yet**, so it gets a neutral cream chip.
   Gold arrives at approval, which is when the money does.
3. **Coral stays a caution accent** — the goal-setback warning, money leaving,
   errors, and destructive links. Never a button.
4. **Nav labels** follow the guide's ALL-CAPS `HOME · ACHIEVEMENTS · GOALS ·
   PIGGY BANK`. There is no Goals screen for kids (goals live in the hero), so
   their fourth tab is HISTORY. The source defines no icon set and says to
   prefer text labels, so the tab bars are text only.
5. **Form fields are white with a cream hairline.** A cream fill — the literal
   reading of "inset panels are cream" — disappears against the cream app
   background, so fields keep the cream only as a border.

## Design notes

The seed reproduces every headline figure from the original board: balances
$24.50 / $11.25 / $38.00, $73.75 held, goals at 61% and 84%, three achievements
waiting worth $4.50, and a week of $12.50 earned / $8.00 spent / 64% saved, with
the ledger's running balances chaining exactly as drawn.

Where that board contradicted itself, the app computes the honest value: the
"2 of 4 done" counter, the launch-screen task counts, a chore shown as both
approved and pending on the same day (resolved via the rule that earn
transactions are written at approval time), an assignment shown on one screen
and not another, "this week" meaning chore earnings over a rolling 7 days, and
"saved %" as `1 − spent ÷ (earned + deposited)`.

## Not built

Session handling is a PIN in `sessionStorage` and an actor id on write requests
— right for a shared family tablet, not an authentication system. Before this
faces real money it needs real sessions, server-side authorisation scoped per
family (several endpoints currently trust the family of the acting parent rather
than a session claim), and rate limiting on the PIN endpoint.

Schema changes are applied by `migrate()`: `CREATE TABLE IF NOT EXISTS` for new
tables, plus an idempotent `ADDED_COLUMNS` list checked against
`information_schema` for columns added to tables that already exist. That is
enough for a dev environment but is not a migration tool — it cannot rename,
backfill, or roll back, and it should be replaced before production.
