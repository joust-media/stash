# Deploying Stash to stash.joustmedia.com

Target: a Railway service behind your own subdomain, for device testing before
the App Store work begins. **No code changes are needed** — the app is served
from the domain root, which is exactly why a subdomain beats `joustmedia.com/stash`.

Verified end to end locally in production mode: the build serves the client, the
SPA deep links resolve, the API answers, and a fresh empty database migrates and
seeds itself on first boot.

---

## 1. Get the code into a git repo

Railway deploys from a repository, and this folder is not one yet.

```bash
git init && git add . && git commit -m "Stash"
```

Then create an empty repo on GitHub and push. Keep it **private** — see §6.

`.dockerignore` and `.gitignore` already exclude `node_modules`, `dist` and `.env`.

## 2. Create the Railway project

1. New Project → **Deploy from GitHub repo** → pick the repo.
2. Railway reads `railway.json` and builds with the `Dockerfile`. Nothing to configure.
3. Set the **root directory** to `coinquest` if you pushed the whole Stash folder.

The healthcheck is already pointed at `/api/health`, so a failed boot shows up as
a failed deploy instead of a silently broken site.

## 3. Add MySQL

In the same project: **New → Database → Add MySQL**.

Then open the app service → Variables → **Add a Variable Reference** to the
MySQL service's `MYSQL_URL`. One variable is all it needs:

```
MYSQL_URL = ${{MySQL.MYSQL_URL}}
```

The server parses that URL directly. It also accepts `DATABASE_URL`, or the
individual `MYSQL_HOST` / `MYSQLHOST` style variables — Railway names them
without the underscore, which is the single most common way this deploy fails.

Do **not** set `PORT`. Railway injects it and the server already reads it.

On first boot the app creates its tables and seeds the Rivera demo family.

## 4. Point the subdomain at it

In Railway: app service → Settings → Networking → **Custom Domain** →
`stash.joustmedia.com`. Railway gives you a CNAME target.

In your DNS (wherever joustmedia.com's records live):

| Type | Name | Value |
| --- | --- | --- |
| CNAME | `stash` | *the target Railway shows you* |

Your main site is untouched — this is a new record, not a change to the existing
one. TLS is issued automatically once the record resolves; allow a few minutes.

## 5. Check it

```bash
curl https://stash.joustmedia.com/api/health
```

Expect `{"ok":true,"db":"mysql://…"}`. Then open the site on a phone.

To reset the demo data at any point, run `npm run seed` against the Railway
database — it wipes and reseeds.

## 6. What is deliberately not done yet

You chose to ship the deployment first and harden after. Recording it here so
it does not get lost — all three are covered in [`../STASH-APPSTORE.md`](../STASH-APPSTORE.md):

- **No authentication.** The server still takes the caller's word for who they
  are (`actorId` in the request body), so anyone with the URL can act as a
  parent. The demo PINs `1234` / `4321` are seeded.
- **No access fence.** The subdomain is public and will be crawled. HTTP Basic
  Auth over the whole service, plus `noindex`, is minutes of work and is the
  right cover until real auth lands.
- **Not installable.** A web app manifest would let it install to the iPhone
  home screen full-screen with the Stash icon. The icons already exist.

Use fictional data until the first of those is fixed. Do not put a real child's
name, or anything you would not want indexed, into this deployment.
