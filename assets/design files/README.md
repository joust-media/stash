# Handoff: CoinQuest — Chore Rewards Money App for Teens

## Overview
CoinQuest is a mobile-first web app where teens (13–16) earn real cash by completing chores. Parents manage the chore list, approve completed tasks, deposit cash, and confirm withdrawals. Each kid keeps a tracked balance with a full transaction ledger and optional savings goals. Backend is a SQL database (schema below).

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, not production code to copy directly. Your task is to **recreate these designs in the target codebase's environment** (React, Vue, native, etc.) using its established patterns — or, if no environment exists yet, choose an appropriate stack (e.g. React + a REST/SQL backend) and implement there.

`CoinQuest Mobile App.dc.html` is a design board containing all 9 screens side-by-side as 390×844 phone frames. Open it in a browser to view.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and copy are final. Recreate pixel-perfectly, using the design tokens below.

## Visual Language (Joust Media Design System)
- Dark navy canvas only — no light mode.
- Font: **Inter** (Google Fonts), weights 400/600/700/800.
- Hairline borders everywhere: `1px solid #2E3150`. Nothing borderless.
- Brand gradient (orange→pink) used sparingly — once per screen max (balance card top strip, primary CTA).
- Radii: 4px chips, 12px small panels/list rows, 16px cards, 999px pills.
- 8-pt spacing grid (8/12/16/24/32).
- Uppercase letter-spaced labels (11px, 600, letter-spacing 0.08em) for section headings and meta fields.
- Status pills: `[dot] WORD` in SCREAMING CAPS (e.g. PENDING in amber).
- No icon library; glyphs only (✓ → ↓ ↑ ⌂ ☑ ↕ ≡ ←). If richer icons are needed, use Lucide (thin stroke).
- Motion: fades/short transforms, 120–320ms ease-out. No bounces.
- Hover: brighter border + 1px lift; Focus: orange glow ring `0 0 0 3px rgba(245,141,58,0.25)`.

## Design Tokens
Colors:
- Canvas: `#0F1020` · Deep bg: `#080914` / `#0A0B18`
- Card: `#1F2139` · Raised/bar: `#151728` · Chip bg: `#2A2D47`
- Borders: `#2E3150` (default), `#4A4E78` (unchecked circle)
- Text: primary `#F5F5F8`, secondary `#A8ABCE`, muted `#6C6F94`, on-brand `#1B1C2E`
- Brand: orange `#F58D3A`, pink `#E7426B`, gradient `linear-gradient(90deg,#F58D3A,#E7426B)`
- Semantic: earn/positive green `#3CC88A`, deposit blue `#4D9EFF`, spend/negative pink `#E7426B`, pending amber `#FFB547`
- Tinted pill backgrounds: color at 12% alpha, e.g. `rgba(60,200,138,0.12)`

Type scale (Inter):
- Balance display: 44–56px / 800 / letter-spacing -0.02em
- Screen title: 22px / 700 · Card title: 15–17px / 600
- Body: 13–15px / 400–600 · Meta: 12px muted · Label: 11px / 600 / uppercase / 0.08em
- Money amounts: 700–800, colored semantically (+green, −pink, deposit blue)

## Screens (all 390×844, `data-screen-label` attrs 01–09 in the HTML)

### 01 · Kid Picker (login)
Profile-picker launch screen. Centered brand mark (72px circle, brand gradient, "¢"), app name, "Who's earning today?". One row card per kid: 48px colored avatar circle (initial), name + task count subtitle, right-aligned green balance. Footer: outlined pill "Parent mode · PIN" — parent area is PIN-gated.

### 02 · Kid Home — balance + things to do
- Header: greeting + name, avatar top-right.
- Balance card: 16px radius, 6px gradient strip on top, "MY BALANCE" label, 44px balance, savings-goal progress row (goal name, `$x / $y` in orange, 8px gradient progress bar).
- "THINGS TO DO — EARN $7.50" section with "2 of 4 done" counter in orange.
- Task rows: 28px circle checkbox (empty = 2px `#4A4E78` border; done = green filled ✓), title + schedule meta, reward pill `+$2.00` (green on 12% green).
- Completed-awaiting-approval row: 60% opacity, strikethrough title, amber PENDING pill.
- Bottom tab bar (`#151728`, top hairline): Home ⌂ / Tasks ☑ / Bank ↕ / History ≡; active = orange, inactive = muted.

### 03 · Task Done — Celebration
Full-screen takeover after marking a task done. Confetti (small colored rects/dots scattered, brand palette — animate falling on implement). 120px gradient circle with ✓ and layered glow rings. "Nice work, Maya!" 28px/800. Task name subtitle. Giant `+$2.00` 56px green. Amber status pill "WAITING FOR DAD'S OK" with dot. Helper line about approval. CTAs: gradient button "Next task → …", ghost "Back to home".

### 04 · Deposit Cash (parent)
Back arrow + "Deposit cash" title. Kid selector row (avatar, name, current balance). Centered amount display 56px with quick-amount chips ($5/$10/$20/$50 — selected = orange border + 10% orange bg). Note field (single line). 3×4 numeric keypad (keys = `#1F2139` 12px-radius tiles). Full-width gradient CTA "Add $10.00 to Maya's balance".

### 05 · Withdraw / Spend
Back arrow + "Take money out". Available-balance card. Amount 56px in pink, `−$` prefix; chips $5/$10/All of it. "WHAT'S IT FOR?" category chips (Going out / Food / Gift / Other; selected = pink border + 10% pink bg). Amber warning banner: withdrawing moves goal progress back. CTA: solid pink "Ask to withdraw $8.00" + helper "A parent hands over the cash and confirms." Withdrawals are kid-requested, parent-confirmed.

### 06 · History / Ledger
Filter chips: All / Earned / Deposits / Withdrawn (active = solid orange). Grouped by day ("TODAY", "YESTERDAY"). Row: 36px tinted icon circle (✓ green = chore, ↓ blue = deposit, ↑ pink = withdrawal), title + meta ("Chore · approved by Dad"), right column amount (colored, signed) + running balance beneath (11px muted). Weekly summary strip (dashed border): Earned / Spent / "Saved 64%".

### 07 · Parent — Family Overview
"Parent mode / The Riveras" header + blue PARENT badge pill. Total-held card (gradient strip, 32px total, kid count + weekly delta). Amber approvals-waiting banner (count badge, per-kid breakdown, "Review →"). Kid rows: avatar, name · age, weekly chore stats, balance + goal %. Two quick-action tiles: "↓ Deposit", "＋ New chore". Parent tab bar: Family / Chores / Approvals / Ledger.

### 08 · Parent — Manage Chores
Title + gradient "＋ New chore" pill button. Kid filter chips. Chore cards: title + green/gray toggle switch (active/paused), reward pill, schedule chip (Daily / Weekly · Sat / Paused), overlapping assigned-kid avatars (24px, -6px margin). Paused card at 55% opacity. Dashed-border row: "＋ Add a one-time bonus task".

### 09 · Parent — Approvals
Title + "3 tasks waiting · $4.50 total". One card per pending completion: kid avatar, task name, timestamp, reward; two buttons — solid green "Approve ✓", ghost "Send back". Bottom gradient CTA "Approve all · pay out $4.50".

## Interactions & Behavior
- Marking a task done → task enters `pending` → celebration screen (03) → confetti animation (~1.5s, ease-out fall) → balance credits only on parent approval.
- Approval (09): Approve moves completion to `approved`, writes an `earn` transaction, updates balance. "Send back" sets `rejected` and returns the task to the kid's to-do list.
- Deposit (04): parent-only; writes `deposit` transaction with optional note.
- Withdraw (05): kid submits a request; parent confirms (hands over cash) → `withdraw` transaction. Block amounts > balance.
- Goal progress bar animates width on change (~300ms ease-out).
- Filter chips and kid filters are client-side list filters.
- Parent mode entry requires PIN.
- Toggle switch in 08 pauses a chore (kept, hidden from kids).

## State Management
- Session: current user (kid or parent), family id.
- Kid home: task list w/ per-task status, balance, goal.
- Parent: pending-approvals count (badge), per-kid summaries.
- Optimistic UI on task-complete; reconcile on server response.

## SQL Schema (suggested)
```sql
CREATE TABLE families (id PK, name);
CREATE TABLE users (
  id PK, family_id FK, name, role ENUM('kid','parent'),
  age INT NULL, avatar_color VARCHAR(7), pin_hash VARCHAR NULL
);
CREATE TABLE chores (
  id PK, family_id FK, title, reward_cents INT,
  schedule ENUM('daily','weekly','once'), schedule_detail VARCHAR NULL,
  active BOOL DEFAULT TRUE
);
CREATE TABLE chore_assignments (chore_id FK, kid_id FK, PRIMARY KEY(chore_id, kid_id));
CREATE TABLE task_completions (
  id PK, chore_id FK, kid_id FK, completed_at DATETIME,
  status ENUM('pending','approved','rejected'),
  reviewed_by FK users NULL, reviewed_at DATETIME NULL
);
CREATE TABLE transactions (
  id PK, kid_id FK, type ENUM('earn','deposit','withdraw'),
  amount_cents INT, note VARCHAR NULL, related_completion_id FK NULL,
  created_by FK users, created_at DATETIME,
  balance_after_cents INT  -- running balance for the ledger
);
CREATE TABLE goals (
  id PK, kid_id FK, title, target_cents INT, active BOOL
);
```
Balance = sum of transactions (or read `balance_after_cents` of latest). Earn transactions are created only at approval time.

## Assets
No image assets. Avatars are initial-letter colored circles. Confetti is CSS shapes. Font: Inter via Google Fonts.

## Files
- `CoinQuest Mobile App.dc.html` — all 9 screens (design board; each phone frame has a `data-screen-label`).
