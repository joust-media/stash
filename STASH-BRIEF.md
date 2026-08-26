# Stash — Brand, Character & Product Brief

**Purpose of this document.** Everything a writer, designer, or AI assistant needs
to talk about Stash accurately, write copy in its voice, and develop the
character further — without inventing things that aren't true.

Source material: the Figma brand guide (`Stash.fig`, Brand Guidelines V1.0,
August 2026), the locked character sheet, and a working prototype of the app.

---

## 1. The one-liner

> **Stash — Earn it. Save it. Stash it.**
> A kids' earn-and-save money app. Children earn real money through real
> achievements. A parent approves every movement of money, in both directions.

**Audience.** Two, and they need different voices:
- **Kids** roughly 8–16, who use the app daily.
- **Parents**, who approve everything and hold the actual cash.

**The core promise.** Money is earned, not given. Nothing moves without a parent.
The kid decides what they're saving for.

**What it is not.** Stash is not a bank, a card, a wallet, or a payment
processor. It moves no real money — it is a shared ledger the family agrees to.
Cash changes hands in the real world when a parent hands it over. **Never write
copy implying accounts, deposits, interest, investing, or regulated financial
services.**

---

## 2. The character

### Who he is

**Stash** is a 3D Pixar-style chipmunk with an enormous mustache and black
rectangular glasses. The guide's own framing:

> "The kid's tiny financial advisor — proud, warm, a little theatrical."

He is a **guide, not a mascot standing next to the product**. He appears in the
header of every screen, and his job is to make money feel handleable rather than
serious. He is never the one making decisions — the kid earns, the parent
approves, Stash cheers and explains.

### Appearance — locked

| Always | Never |
| --- | --- |
| Chestnut fur, cream belly, fluffy striped tail | Remove or shrink the mustache |
| Oversized mustache | Remove or restyle the glasses |
| Black rectangular glasses | Recolour his fur |
| Soft drop shadow on flat colour | Stretch, skew, or outline him |
| Minimum 64px tall in UI | Place him over busy imagery |
| Clear space ≥ the width of his glasses | More than one Stash per screen |
| One pose per moment | Give him a negative or scolding line |

**The master file is `assets/design-system/assets/stash-pose-sheet.png`.** New
poses come from that sheet only — he is never redrawn. If new artwork is needed,
it must be produced as new renders of the same character, matching the sheet.

### Poses and what they mean

The sheet contains five usable poses. Each maps to a moment:

| Pose | Moment | Used in the app |
| --- | --- | --- |
| **Coin toss** | Earning | Welcome screen, Achievements header |
| **Coin toss (alt)** | Earning | Profile screens |
| **Nut pile** | Balance, having saved | History, parent Family overview |
| **Confetti, arms up** | Achievement complete | Parent approvals queue |
| **Acorn hug** | Savings goals | Kid Home, Piggy Bank, Goals |
| **Ta-da (jump-spin)** | Big win | Celebration screen |

Two further approved assets exist beyond the original sheet: an **identity
plate** (the same neutral standing pose from four angles — front, three-quarter,
profile, back), which is the master reference every new pose is generated
against, and an **icon bust** cropped from its front view for the app icon.

### Character gaps worth developing

These do not exist yet and are open ground:

- **Reaction poses**: thinking, waiting, disappointed-but-encouraging (for a
  sent-back task), sleeping/idle.
- A **parent-facing** register — Stash currently reads kid-first everywhere,
  but parents see him too on their screens.
- **Motion**: he is a static render today. No animation vocabulary exists.
- **Voice as a character**: he has a brand voice (below) but no catchphrases,
  no backstory, no supporting cast.

---

## 3. Voice

### Four pillars, verbatim from the guide

| Pillar | Meaning | Example |
| --- | --- | --- |
| **Playful, not silly** | Acorn puns OK. Baby talk never. Talk up, not down. | "That's the good stuff. Stash it away!" |
| **Clear about money** | Real amounts, real words: earn, save, spend, goal. | "You earned $2.00 for reading 20 minutes." |
| **Parent-trustworthy** | Parent copy is calm and plain, no gimmicks. | "You approve every achievement before money moves." |
| **Encouraging** | Celebrate effort, not just results. | "3 more to go — your Stash is growing!" |

### Mechanics

- **Second person** — "You earned…", not "Maya earned…".
- **Sentence case** for prose. ALL-CAPS only for nav labels and eyebrow labels.
- **Exclamation points at win moments only.** Not in parent copy.
- **Essentially no emoji** in UI copy. Checkmarks (✓ ✗) as list markers only.
- **Stash never sends a negative message.** A rejected task is "sent back", not
  failed. There is no scolding register in this brand.
- The wordmark is always **"Stash."** — with the period.

### Live copy from the product, for tone reference

- "Who's earning today?"
- "Nice work, Maya!"
- "That's the good stuff. It lands in your stash as soon as Dad says yes."
- "Waiting on a parent"
- "A parent hands over the cash and confirms."
- "Only $0.50 to go!"
- "No goals yet — a goal gives your stash somewhere to go."
- "Never mind" (cancel an in-progress task)
- "See every dollar" (view history)

---

## 4. Visual system

### Colour

> "Forest + treasure. One dominant green warmed by colours sampled from Stash
> himself."

| Colour | Hex | Role |
| --- | --- | --- |
| **Leaf Green** | `#2FBF71` | **Primary — LOCKED. It is the brand.** |
| Deep Leaf | `#1E8F52` | Hover/pressed, eyebrow labels |
| Warm Cream | `#FAF3E3` | App background, inset panels |
| Stash Chestnut | `#8B4A2B` | Headings — his fur |
| Mustache Brown | `#5C3319` | Body text — his mustache |
| **Acorn Gold** | `#F2B93B` | **Rewards and celebration ONLY** |
| Coral | `#D96B4A` | Caution / "never" accent only |
| Border cream | `#E5DBC7` | Hairlines |

Target ratio: **Leaf 50% · Cream 30% · Browns 12% · Gold 8%.**

**Gold is an earned colour.** It appears only when the kid wins — never as
decoration. In the app it is used as a *fill* (a gold pill with brown text)
rather than as type, because gold text on cream or green fails contrast.

**Coral is never a button.** It marks caution, money leaving, and errors.

### Type

- **Baloo 2** — display. ExtraBold titles 28–32, Bold card titles 20–22,
  Bold buttons 18.
- **Nunito** — body. Regular 16 minimum, line-height 1.5–1.6. Bold 13–14 for
  labels and nav, often ALL-CAPS with 0.12–0.16em tracking.
- **Money** — Baloo 2 ExtraBold with **cents at 60% of the dollar size**. Whole
  dollars drop the decimals entirely: `$2`, `$10`, `$1,000`, but `$1.50`,
  `$24.50`.
- No logo file exists. **The wordmark is typeset**: "Stash." in Baloo 2
  ExtraBold. Do not draw a logo.

### Shape and surface

- Cards: white, radius **20**, shadow `0 6px 18px rgba(92,51,25,.10)`.
- Inset panels: cream, radius **12**.
- Hero blocks: radius 20–32; green blocks may round **only the bottom**
  (`0 0 32 32`).
- Every primary CTA is a **pill**: radius 999, min-height 56, Baloo 2 Bold 18.
  **One primary CTA per screen.**

### The Faint Forest Layer — locked

Acorns, leaves and nuts, tone-on-tone, white at 6–8% opacity, 80–160px, cropped
at the edges, 3–6 per screen. **Over Leaf Green only** — never on cream, never
behind text, never another colour, never louder than Stash. The guide's phrase:
**"Felt, not seen."**

### Motion

Hover lifts 2px and scales 1.02. Press shrinks to 0.97. Gold earnings "bounce
in" over ~600ms on a spring. Playful, springy, short. Nothing else is specified.

### Iconography

The brand defines **no icon set**. The guide says prefer text labels; where icons
are unavoidable, use a rounded, filled, friendly set — it names **Phosphor Fill**
— tinted with brand colours, and asks that the substitution be flagged. The app
uses Phosphor Fill on task tiles only. **Never hand-draw SVG approximations of
Stash himself.**

---

## 5. How the product actually works

Accurate detail so promotional copy doesn't overclaim.

### The money rules

1. **Nothing moves without a parent** — in either direction.
2. A kid **earns** by finishing an achievement. Money is created at the moment a
   parent approves, not when the task is done.
3. A kid **takes money out** by asking. The parent hands over physical cash and
   confirms; that is when the balance drops.
4. A kid can't ask for more than their balance minus anything already promised
   to an open request.
5. Every transaction stores its running balance, so history is auditable.

### Start → End

A task is not a single tap. The kid **Starts** it, the tile moves to an
"In progress" section showing how long it's been running, and then they **End**
it. **End is the moment the parent is alerted.** Work in progress never reaches
a parent. "Never mind" cancels with nothing logged.

### The kid's screens

| Screen | What it does |
| --- | --- |
| **Home** | Balance, active goal, things to do |
| **Achievements** | The rung being climbed, and every task that counts toward it |
| **Goals** | The kid's own goals — name it, price it, pick a picture, keep several |
| **Piggy Bank** | Add funds (earn) and Take out (spend), given equal weight |
| History | Every dollar in and out with running balances |
| Celebration | The win moment after ending a task |

Nav labels are ALL-CAPS: **HOME · ACHIEVEMENTS · GOALS · PIGGY BANK.**

### The parent's screens

Family overview, a single **Approvals queue** holding both earnings and cash
requests, a **Manage** admin (achievements, goals, people), a ledger, and
add-cash. Parent mode is behind a PIN.

### Goals — the kid's own

Goals belong to the kid. They name what they want, say what it costs, pick a
picture, and can keep several. One is "active", and that is what every progress
bar in the app measures against. **What the trackers mean is the kid's
decision** — this is a deliberate product position worth leaning on in messaging.

### Progress ladders

Two, and a kid always has exactly one rung in front of them:

- **Achievements** (things finished, lifetime): First win → Warming up → On a
  roll → Chore champ → Halfway to 100 → Century club → Legend.
- **Savings** (balance): $10 → $25 → $50 → $100 → $250 → $500 → $1,000.

Within 80% of a rung, the app nudges: *"Only $0.50 to go!"* Below that it stays
quiet, because "only" would be a lie.

### The achievement catalogue

Real examples currently in the product, with what they pay:

**Daily** — Take out the trash $2 · Empty the dishwasher $1.50 · Load the
dishwasher $1.50 · Make the bed $1 · Feed the dog $1 · Walk the dog $2.50 ·
Water the plants $2.50 · Set the table $1 · Clear the table $1 · Tidy your room
$2 · Read for 20 minutes $2 · Homework done $2.50 · Practice piano $2.50

**Weekly** — Mow the lawn $4 · Vacuum the living room $3 · Sweep the kitchen $2 ·
Dust the shelves $2 · Clean the bathroom $4.50 · Fold the laundry $3 · Put your
laundry away $1.50 · Recycling to the curb $1.50 · Change your sheets $2.50 ·
Rake the leaves $3

**One-time bonuses** — Wash the car $5.50 · Help with the groceries $3 · Clean
out the garage $8 · Wash the windows $4

Note the mix: chores, but also **reading, homework and music practice**. Stash
treats good habits as earnable, not just housework. That is a useful angle.

### The demo family

The Riveras — parents **Dad** and **Mom**; kids **Maya** (15), **Leo** (13),
**Zoe** (16). Use these names in examples and mockups for consistency.

---

## 6. Positioning angles that are true

Grounded in what the product actually does:

- **"Money is earned, not given."** Every dollar traces to something the kid did.
- **"A parent approves every movement."** Both directions. Not a spending-limit
  toggle — an actual approval on every single transaction.
- **"The kid decides what they're saving for."** Goals are theirs, and the
  trackers follow their choice.
- **"Effort counts, not just results."** In-progress work is visible; the app
  nudges on near-misses; achievements reward volume over time.
- **"Real cash, real conversations."** No card, no wallet — a parent physically
  hands over money. The app is the shared record, not the rails.
- **"Good habits pay."** Reading and homework sit alongside chores.

### Claims to avoid

- Anything implying a bank account, card, interest, investing, or regulated
  service.
- "Teaches kids to invest" / "builds credit" — false.
- Automated or instant payouts — a human always approves.
- Anything about data collection from children. If pressed on privacy, defer —
  the current build has **no authentication beyond a shared PIN** and is a
  prototype, not a shipped consumer product.

---

## 7. Status — what exists today

**Exists:** a working prototype. React + Vite front end, MySQL behind a Node API,
all screens above built and functional, 27 achievements, multi-goal support,
start/end task flow, unified approvals, parent admin, profile editing.

**Does not exist:** real accounts or authentication, any payment integration,
an App Store presence, a website, a logo file, a motion system, character
animation, or any published marketing.

**Do not describe Stash as launched, available, or downloadable.**

---

## 8. Good starting prompts for a chat

Ideas that fit what's here and would move it forward:

1. *"Write 10 push notification lines in Stash's voice for the moment a parent
   approves an achievement — kid-facing, gold-moment energy, no emoji."*
2. *"Draft the character bible expansion: give Stash a short backstory, three
   catchphrases, and a rule for how he talks about money he can't give you."*
3. *"Design a wave-hello pose brief for an illustrator — what he's doing,
   what must stay locked, what it's used for."*
4. *"Write App Store copy for Stash. Two voices: the kid-facing subtitle and the
   parent-facing description. No financial-service claims."*
5. *"Propose a motion vocabulary for Stash: idle, celebration, waiting,
   sent-back. Keep it springy and under 600ms."*
6. *"Write the onboarding flow copy for a parent setting up their first kid —
   calm and plain per the voice pillar."*
7. *"Name and script a supporting cast — who else lives in the forest, and what
   role would they play without stealing from Stash?"*

---

## 9. Hard rules — the short list

Paste this into any brief:

1. **Leaf Green `#2FBF71` is locked.** It is the brand.
2. **Acorn Gold only when the kid wins.** Never decoration.
3. **Coral is a caution accent.** Never a button.
4. **One primary CTA per screen**, always a pill, radius 999, min-height 56.
5. **The forest layer goes over Leaf Green only**, ≤10% opacity, never behind
   text.
6. **Stash comes from the locked pose sheet.** Never redrawn, recoloured,
   outlined, or duplicated on a screen. Minimum 64px.
7. **The wordmark is typeset**: "Stash." in Baloo 2 ExtraBold. No logo exists.
8. **Money type**: Baloo 2 ExtraBold, cents at 60%, whole dollars lose the
   decimals.
9. **Stash never sends a negative message.**
10. **No financial-service claims.** Nothing moves real money.
