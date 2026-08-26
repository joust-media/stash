# Stash — App Store Standards

**What this is:** the rules Stash has to satisfy to ship on the iOS App Store, and what
each one means for how we build. This is a working engineering document — it sits
next to the code and gets edited as things land.

**Sourced from Apple, verified 25 Aug 2026:**
[Submitting to the App Store](https://developer.apple.com/app-store/submitting/) ·
[App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) ·
[Kids Apps & parental gates](https://developer.apple.com/app-store/kids-apps/) ·
[App Store Connect workflow](https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-workflow) ·
[Create an app record](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app/) ·
[Screenshot specs](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/) ·
[Privacy manifests](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files) ·
[Declared Age Range](https://developer.apple.com/documentation/declaredagerange)

Companion docs: [`STASH-BRIEF.md`](STASH-BRIEF.md) (brand & character) ·
[`coinquest/README.md`](coinquest/README.md) (how the app works).

---

## 0. Three decisions to make before any of this matters

These three choices change the requirements underneath everything else. Make them
first; everything in sections 1–12 assumes the recommendation.

### 0.1 Do we enter the Kids Category? — **Recommendation: no**

The Kids Category has three age bands: **5 and under, 6–8, 9–11**. Stash is built for
**8–16**. More than half our audience sits above the top band, so we'd be declaring an
audience we don't serve.

Opting in also buys permanent constraints. Guideline 1.3 says a Kids Category app must
keep meeting Kids Category requirements *in subsequent updates, even if the category is
later deselected*. That's a one-way door:

- No links out of the app, no purchasing, "or other distractions" except behind a parental gate
- No third-party analytics, no third-party advertising (narrow exceptions only)
- No personally identifiable or device information to third parties at all
- Any advertising must be human-reviewed for age appropriateness

**Instead:** rate the app **4+**, market it to parents, and voluntarily meet the Kids
Category privacy bar anyway (section 11). We get the safety posture without the ceiling.

**Consequence for copy — this one is easy to trip over:** guideline 2.3.8 reserves the
terms **"For Kids"** and **"For Children"** for the Kids Category. Outside it, we cannot
use them in the app name, subtitle, icon, screenshots, or description, or otherwise imply
children are the main audience. `STASH-BRIEF.md` uses "kids" freely — that's fine for
marketing on our own site, but **App Store metadata has to say "families" instead.**

### 0.2 Individual or organization account? — **Recommendation: organization**

Guideline 5.1.1(ix): apps in "highly regulated fields (such as banking and financial
services…)" should be submitted by a legal entity, not an individual developer.

Stash is not a financial service — it moves no money (section 11.1) — but it will be
read as finance-adjacent by a reviewer skimming the product page. Submitting from a
company account removes the argument entirely, and it's also what lets us set a
developer name on the product page.

Organization enrolment needs a **D-U-N-S number** for the legal entity. That takes
days to weeks to obtain if we don't have one — start it early, it's the longest lead
time on this whole list.

### 0.3 Primary category? — **Recommendation: Education, secondary Finance**

Finance is where the competitors sit and where parents search, but it's also the
category that invites the regulated-services read. Education primary / Finance secondary
keeps discoverability and lowers the temperature. Revisit if ASO data says otherwise —
categories are editable after launch, unlike the fields in section 5.

### 0.4 iPhone only at v1? — **Recommendation: yes**

The whole design is a 390pt phone frame. Declaring iPad support makes 13" iPad
screenshots (2064 × 2752) a hard requirement and puts us on the hook for a layout we
haven't designed. Ship iPhone-only; add iPad as a real design pass later.

---

## 1. Where Stash stands today

Honest gap assessment. Stash is a **React + Vite web app** served by a Hono/MySQL
backend on Railway. There is no iOS binary, no App Store Connect record, and no Apple
Developer Program membership.

| Requirement | Status |
|---|---|
| Apple Developer Program membership ($99/yr) | ✗ not enrolled |
| D-U-N-S number for the entity | ✗ unknown |
| App Store Connect app record | ✗ none |
| iOS binary built with iOS 26 SDK or later | ✗ none — web only |
| Real authentication | ✗ **client asserts its own identity** (blocker, §2.1) |
| Account creation + in-app account deletion | ✗ no accounts at all |
| Privacy policy URL, live and linked in-app | ✗ does not exist |
| Privacy nutrition label answers | ✗ not drafted |
| `PrivacyInfo.xcprivacy` privacy manifest | ✗ n/a until there's a binary |
| Age rating questionnaire | ✗ not answered |
| App icon 1024×1024, no alpha | ✗ not produced |
| 6.9" screenshots (1320 × 2868) | ✗ not produced |
| Demo credentials for App Review | ⚠ exist, but as seeded production data (§2.2) |
| HTTPS everywhere | ✓ Railway terminates TLS |
| No third-party SDKs in the client | ✓ currently clean — keep it that way |
| No outbound links in kid-facing UI | ✓ verified: zero `http(s)://` links in `src/` |
| No real money movement | ✓ by design — protect this |
| PIN hashing | ✓ scrypt with per-user salt + `timingSafeEqual` |

---

## 2. Blockers in the current build

These are in the code today and will fail review, or fail worse — in public — before
review. Ordered by severity.

### 2.1 The server trusts the client's claim of who it is — **critical**

`server/routes/goals.ts` and `server/routes/users.ts` authorise by reading an
`actorId` out of the **request body**:

```ts
await requireGoalActor(body.actorId ?? body.parentId, kid.id)
```

There is no session, no token, no cookie. Anyone who can reach the API can send
`{"actorId": 1}` and act as a parent — approving their own withdrawals, editing
anyone's profile. The `requireGoalActor` checks are real logic guarding a door with
no lock on it.

This is fine for a single-family demo on an unlisted URL. It cannot ship.

**Fix:** a signed session established at sign-in, `actorId` derived server-side from
the session and never read from the body. Every route re-derives the actor. This is
the single largest piece of work between here and a submittable app.

### 2.2 Parent PIN lookup is unscoped and unthrottled — **critical**

`server/routes/auth.ts`:

```ts
const parents = await all<UserRow>(`SELECT * FROM users WHERE role = 'parent'`)
const match = parents.find((p) => verifyPin(pin, p.pin_hash))
```

Every parent in **every family** is a candidate. With more than one family in the
database, one family's PIN unlocks another family's parent mode. There's also no rate
limit — a 4-digit PIN is 10,000 guesses, and the endpoint will answer all of them.

**Fix:** scope the query to the authenticated family, and rate-limit with exponential
backoff and lockout. The PIN should be a *local* gate on an already-authenticated
family session, not the authentication itself.

### 2.3 Demo credentials are seeded as production data

`server/seed.ts` creates Dad `1234` / Mom `4321` and logs them to stdout. Fine for the
unlisted demo; it must not exist in a production database.

App Review *does* need working credentials — guideline 2.1 requires demo account info
and a live back end when the app has a login. But that's a purpose-built review account
supplied in Review Notes (§9), not a family seeded into every install.

### 2.4 No privacy policy

Guideline 5.1.1 requires a privacy policy linked in **App Store Connect metadata and
inside the app, easily accessible**, that identifies what we collect, how, every use of
it, third-party sharing, retention, and how a user revokes consent or requests deletion.
Not having one is an automatic rejection. Section 7.1 has the outline.

### 2.5 No account deletion

Guideline 5.1.1(v): if the app supports account creation, we must offer **account
deletion within the app**. Once we build accounts (2.1), deletion ships in the same
release. Not the next one.

### 2.6 Personal data about minors, with no policy behind it

The `users` table holds `name`, `nickname`, `about` (240 chars of free text) and `age`
for children. Guideline 5.1.4(b) puts any app collecting personal information from a
minor under the same obligations as the Kids Category: privacy policy, plus compliance
with COPPA, GDPR and equivalents. See section 11.5 for the data-minimisation rules.

---

## 3. Getting to an actual binary

The App Store takes an iOS binary. Three routes:

| Route | Effort | 4.2 risk | Notes |
|---|---|---|---|
| **Capacitor wrapper** | Low | Medium — mitigable | Reuses the entire React app as-is |
| React Native rewrite | High | Low | Reuses types and server, not the UI |
| Native SwiftUI | Highest | None | Best result, full rebuild |

**Recommendation: Capacitor**, with deliberate mitigation of guideline 4.2.

4.2 says the app must "include features, content, and UI that elevate it beyond a
repackaged website," and 4.2.2 rejects apps that are primarily "web clippings." A
WebView pointed at `stash.up.railway.app` is exactly what that rejects. A Capacitor
build passes when it earns its place on the device:

- **Bundle the web assets locally.** The binary ships the built app; it must not load
  its UI from a remote URL. It talks to the API, like any client — that's normal.
- **Push notifications** — the parent gets an alert the moment a kid hits **End** on a
  task. This is the single most valuable native feature Stash could have, and the
  Start→End flow was built for it.
- **Face ID / Touch ID for parent mode** — replaces or augments the PIN, and fixes §2.2
  at the same time.
- **Home Screen widget** — the balance and the active goal. Directly serves the
  "the number is the hero" design decision.
- **Haptics on approval and on a completed goal.**
- **Offline read** — the app opens and shows the last known balance without a network.

Every one of those is something Stash wants regardless of Apple. That's the test for
whether a 4.2 mitigation is real.

Also note 4.2.3(i): the app must work on its own without requiring another app.
Stash does — no dependency there.

---

## 4. Business and account setup

Longest lead times first.

1. **D-U-N-S number** for the legal entity — days to weeks. Start now.
2. **Apple Developer Program enrolment** as an organization, $99/yr.
3. The **Account Holder** signs the latest agreement in the Business section. Nothing
   can be added to App Store Connect until this is done.
4. **Paid Apps Agreement + banking + tax information** — only needed if we sell the app
   or offer In-App Purchases. If Stash launches free with no IAP, skip this entirely.
5. **Users and Access** — invite the team with roles. The Account Holder can delegate;
   adding an app record needs Account Holder, App Manager, or Admin.

---

## 5. The app record — fields that are hard to change

Created in App Store Connect **before** any build can be uploaded. Some of these are
effectively permanent.

| Field | Value | Changeable later? |
|---|---|---|
| Platforms | iOS | Adding is fine |
| App Name | `Stash` — 30 chars max | Yes, per version |
| Primary Language | English (U.S.) | Effectively no |
| **Bundle ID** | e.g. `com.joustmedia.stash` | **No — permanent** |
| SKU | e.g. `STASH-IOS-001` | No |
| User Access | Full or Limited | Yes |

**"Stash" is a common word.** App names are unique per localization across the whole
store — check availability early, because if it's taken the brand decision reopens.
This is worth checking *this week*, before more is invested in the name.

Once created, status becomes **Prepare for Submission**.

**Housekeeping:** the code folder is still named `coinquest`, after the original design
handoff, and so is `package.json`. Rename it to `stash` before the bundle ID is minted
so the whole chain reads consistently. `.claude/launch.json` needs updating with it.

---

## 6. Metadata and assets

### 6.1 Text

| Field | Limit | Notes |
|---|---|---|
| App name | 30 chars | 2.3.7 — no trademarked terms, no pricing, no keyword stuffing |
| Subtitle | 30 chars | |
| Keywords | 100 chars, comma-separated | Not visible to users |
| Description | 4,000 chars | |
| Promotional text | 170 chars | Editable without a new build |
| What's New | Required per version | 2.3.12 — describe real changes; generic text only for pure bug fixes |
| Support URL | Required | Must be live and functional (2.1a) |
| Marketing URL | Optional | |
| **Privacy Policy URL** | **Required** | Must be live |

**Do not use "For Kids" or "For Children"** anywhere in this metadata — see §0.1.

### 6.2 App icon

1024 × 1024 px, **no alpha channel, no transparency**, no rounded corners (Apple masks
it). Must be appropriate for a 4+ rating (2.3.8).

iOS 26 uses layered icons built in **Icon Composer** — the chipmunk on the leaf-green
ground is a natural fit for a foreground/background split. Plan the icon as layers from
the start rather than flattening and redrawing later.

### 6.3 Screenshots

1–10 per device size. `.png` or `.jpg`, **no alpha channel**.

| Size | Portrait | Required? |
|---|---|---|
| **6.9"** (iPhone 17 Pro Max) | **1320 × 2868** | **Required** |
| 6.5" | 1284 × 2778 | Only if 6.9" absent |
| 6.3", 6.1", and smaller | — | Auto-scaled from the above |
| 13" iPad | 2064 × 2752 | Required *only* if we declare iPad support — see §0.4 |

So: **produce 6.9" only.** Everything else scales.

Guideline 2.3.3: screenshots must show the app **in use** — not title art, not login
screens, not splash screens. Overlaid text and captions are allowed. The strongest set
for Stash: the balance hero with Stash the chipmunk, a task mid-Start, the End →
parent-approval moment, the goals screen with a bar near full, and the parent approval
queue.

2.3.9: display **fictional account information** — the Rivera family is already exactly
that, which is convenient.

### 6.4 App previews (optional)

Video screen captures of the app itself only (2.3.4). Narration and overlays allowed.
Worth doing eventually; not a launch blocker.

---

## 7. Privacy

### 7.1 Privacy policy — must be written, must be live

Per 5.1.1 it must explicitly cover:

- **What we collect:** family name; each member's first name, nickname, optional age,
  avatar colour, optional "about" text; chore names and completion timestamps; goal
  names and targets; balances and transaction history; hashed parent PINs.
- **How we collect it:** entered by the family, in-app. Nothing from third parties.
- **Every use:** operating the app. Nothing else. No advertising, no profiling, no sale.
- **Third parties:** the hosting provider and the database. Named, with the statement
  that they provide equal protection of the data.
- **Retention and deletion:** how long we hold it, and how a family deletes everything.
- **Revoking consent** and requesting deletion — with a working contact route.
- **Children:** a specific section on data from minors, COPPA and GDPR posture.

### 7.2 Privacy nutrition label

Required to submit — new apps and every update. Draft answers, assuming section 11's
data rules hold:

| Data type | Collected | Linked to identity | Used for tracking |
|---|---|---|---|
| Name (first name / nickname) | Yes | Yes | **No** |
| User content (goal titles, notes, "about") | Yes | Yes | **No** |
| Identifiers (account ID) | Yes | Yes | **No** |
| Usage data, contacts, location, photos, financial info | **No** | — | — |

Purpose for all of it: **App Functionality** only. Nothing for analytics, product
personalization, or advertising. **Tracking: none** — so no App Tracking Transparency
prompt, which is one fewer thing that can go wrong in a family app.

We must also declare the practices of any third-party code we integrate. Right now
there is none in the client, which is why §11.4 exists.

### 7.3 Privacy manifest — `PrivacyInfo.xcprivacy`

Mandatory in every app submitted since **12 Nov 2024**. It declares collected data
types and every **required-reason API** used, with an approved reason code.

The wrapper and its plugins will pull these in whether we notice or not — typically
`UserDefaults` (reason `CA92.1`), file timestamps, disk space, and system boot time.
Any third-party SDK must ship its own manifest and signature. Invalid manifests bounce
the upload with an email naming the offending file.

In Xcode, adding the file **does not** set Target Membership automatically. Check it.

### 7.4 Age assurance

Apple's [Declared Age Range](https://developer.apple.com/documentation/declaredagerange)
API returns an age *band* rather than a birthdate, plus whether parental controls are
enabled — and when a parent revokes consent, Apple prevents the app from launching.

We don't need it at 4+ in the US today, but it's the right long-term answer to "how old
is this user" and it's already mandated in some jurisdictions
([Brazil, Australia, Singapore, Utah, Louisiana](https://developer.apple.com/news/?id=f5zj08ey)).
**Design the data model so an age band, not a birthdate, is enough** — see §11.5. That
keeps the door open without collecting anything.

---

## 8. Age rating

The rating system now spans **4+, 9+, 13+, 16+, 18+**, and the questionnaire has been
extended with required questions on in-app controls, capabilities, medical/wellness
topics, violent themes, and social media features. Ratings vary by region.

**Stash should rate 4+.** Nothing in it is age-sensitive. Guideline 2.3.6: answer
honestly — a mis-rating breaks parental controls and invites regulatory attention.

The questions about in-app controls and communication features are the ones to read
carefully. If Stash ever adds messaging between family members, that answer changes and
so does the rating.

---

## 9. Preparing for App Review

**Guideline 2.1 — completeness.** Final build, no placeholder text, all URLs live and
functional.

**Demo account.** Because Stash has a login, we must supply working credentials and have
the back end running during review. Prepare:

- A dedicated review family, pre-seeded with a realistic spread — chores in every state,
  a goal near completion, a pending withdrawal, some history. The Rivera seed is already
  the right shape; make a review-only copy of it.
- Parent credentials **and** the parent PIN, both in Review Notes.
- A note that the app requires the back end, which will remain available.

**Review Notes must specifically describe what the app does.** Generic descriptions get
rejected (2.3.1a). For Stash, spell out the thing a reviewer will otherwise assume wrong:

> Stash is a chore-and-savings tracker for families. **No real money moves through the
> app.** Balances are a shared record of cash a parent physically hands over. There is no
> bank connection, no card, no payment processing, and no In-App Purchase. Every change
> to a balance — in either direction — requires a parent to approve it in-app with a PIN.

That paragraph pre-empts the finance-app review path. It is the most valuable text in
the entire submission.

---

## 10. TestFlight

Before review: upload a build, then distribute via TestFlight.

- **Internal testers** — up to 100 App Store Connect users, no review needed.
- **External testers** — up to 10,000, requires a Beta App Review, needs beta app
  description and feedback email.

Real families on real devices for at least a couple of weeks. Everything about Stash —
whether a kid actually taps **End**, whether a parent notices the approval — is a
behavioural question the simulator can't answer.

---

## 11. Engineering standards — build to these from now on

The rules that keep Stash submittable. These are the point of this document.

### 11.1 Stash never moves real money. Non-negotiable.

This one architectural fact keeps us clear of guideline 3.2.1(viii) (financial trading
and money management must come from the licensed financial institution) and 5.1.1(ix)
(regulated fields). Balances are a **shared record of cash that changed hands in the
real world**.

The moment Stash touches an actual transfer, it becomes a regulated financial product
and this document is replaced by a much longer one. If that's ever the plan, it is a
company decision made deliberately, not a feature someone adds.

Note the flip side: if we ever sell a subscription, it **must** go through In-App
Purchase (3.1.1) — no license keys, no external checkout for digital features.

### 11.2 The server decides who you are

No route reads identity from a request body. A signed session establishes the actor;
every route derives it server-side. Replaces the `actorId` pattern in §2.1 wholesale.

### 11.3 Kid-facing surfaces have no way out

No outbound links, no purchases, no "other distractions" anywhere a kid can reach —
currently true and verified. If something must link out (support, the privacy policy,
a store), it goes behind the **parent gate**: PIN or Face ID, and an adult-level task,
never a "Are you a grown-up? [Yes]" tap.

### 11.4 Zero third-party SDKs in the client

No analytics, no crash reporters that fingerprint the device, no ad networks, no
tag managers. Every SDK added is a privacy-manifest obligation, a nutrition-label
disclosure, and a 1.3/5.1.4 exposure. If we need product metrics, they're first-party,
aggregate, and carry no device or persistent identifier.

### 11.5 Collect the minimum, from minors especially

- First name or nickname. **No last names, no email, no phone, no photos** for kids.
- **No birthdates.** If age matters, store a band, and prefer Declared Age Range (§7.4)
  over asking. The current `age TINYINT` column should become optional or go.
- `about` free text stays private to the family. The moment any user content becomes
  visible outside one family, we inherit moderation, reporting, and blocking obligations
  (1.2, 4.7.1) — a completely different product.
- No chat. Adding messaging changes the age rating and the review path.

### 11.6 Deletion and export ship with accounts, not after

In-app account deletion (5.1.1(v)) removes the family and everything under it. A data
export lands in the same release. Neither is a follow-up ticket.

### 11.7 Accessibility is a build standard

App Store Connect now takes accessibility declarations on the product page, and we
should be able to answer yes:

- **Dynamic Type** — the fixed `text-[17px]` sizing throughout will not survive this.
  It's the largest accessibility debt in the current code.
- **VoiceOver labels** on every control. Icon-only buttons currently rely on `aria-label`
  in places and nothing in others.
- **44×44pt minimum** tap targets.
- **4.5:1 contrast.** Cream-on-cream has already caused two visual bugs in this
  codebase — it is also a contrast failure, not just a design one.

### 11.8 Ship no demo credentials

Production seeds no families and no PINs. The review family is created deliberately and
separately.

### 11.9 HTTPS only

App Transport Security requires it. Railway handles TLS; no plaintext endpoints, ever.

---

## 12. Roadmap

**Phase 0 — Business** *(start immediately; longest lead time)*
D-U-N-S → Developer Program enrolment as an organization → Account Holder signs the
agreement → check that the name "Stash" is available on the App Store.

**Phase 1 — Make the web app submittable** *(the real work)*
Real authentication and sessions (§2.1) · scoped, rate-limited PIN gate (§2.2) ·
family accounts with sign-up · in-app account deletion + export (§2.5) · privacy policy
written and hosted (§2.4) · demo seed removed from production (§2.3) · Dynamic Type and
VoiceOver pass (§11.7) · rename `coinquest` → `stash`.

**Phase 2 — Native shell**
Capacitor project · bundled local assets · push notifications on task **End** ·
Face ID parent gate · balance widget · offline read · `PrivacyInfo.xcprivacy` ·
`ITSAppUsesNonExemptEncryption` (standard HTTPS is exempt) · launch screen, safe areas,
dark mode.

**Phase 3 — Store presence**
Layered app icon in Icon Composer · 6.9" screenshots · name, subtitle, keywords,
description · privacy nutrition label answers · age rating questionnaire · support URL.

**Phase 4 — TestFlight**
Internal build → external beta with real families → iterate.

**Phase 5 — Submit**
Review family seeded · credentials and PIN in Review Notes · the "no real money moves"
paragraph from §9 · submit · monitor status history.

---

## 13. The short version

Ten things, if you read nothing else:

1. **Don't enter the Kids Category** — it caps at age 11 and the constraints are permanent.
2. **Never say "For Kids" in App Store metadata** — say "families."
3. **Submit from a company account**, not an individual one.
4. **Stash moves no real money.** Protect that fact; it's what keeps this simple.
5. **The server must decide who the user is.** `actorId` in a request body is the top blocker.
6. **A privacy policy is mandatory** — in Connect metadata *and* in the app.
7. **Account deletion ships with account creation.** Same release.
8. **No third-party SDKs in the client.** Every one is a privacy obligation.
9. **Screenshots at 6.9" (1320 × 2868) only.** Everything else scales.
10. **Tell App Review, in Review Notes, that no real money moves.** It pre-empts the
    finance-app review path.
