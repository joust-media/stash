/** Shared wire types between the Hono API and the React client. */

export type Role = 'kid' | 'parent'
export type Schedule = 'daily' | 'weekly' | 'once'
export type CompletionStatus = 'in_progress' | 'pending' | 'approved' | 'rejected'
export type TxType = 'earn' | 'deposit' | 'withdraw'
export type WithdrawalStatus = 'pending' | 'confirmed' | 'declined'

/** Mascot poses available from the locked character sheet. */
export type Pose = 'coin-toss' | 'coin-toss-alt' | 'nut-pile' | 'confetti' | 'acorn-hug' | 'tada'

export interface Family {
  id: number
  name: string
}

export interface Person {
  id: number
  familyId: number
  name: string
  role: Role
  age: number | null
  avatarColor: string
  initial: string
  nickname: string | null
  about: string | null
  /** The pose that greets this person in their hero. Null falls back per screen. */
  mascotPose: Pose | null
  hasPin: boolean
}

export interface Goal {
  id: number
  kidId: number
  title: string
  targetCents: number
  progressPct: number
  /** The goal currently driving the tracker. Only one at a time. */
  active: boolean
  /** Key into the chore icon set, so a goal can look like the thing it is. */
  icon: string | null
  /** How much is still to save. */
  remainingCents: number
  /**
   * Set when this goal was adopted from a Good Stuff suggestion. These are a
   * snapshot taken at adoption — the parent's item can change or vanish and
   * these do not move.
   */
  suggestedItemId: number | null
  matchPercent: number | null
  /** What the parent covers. Never money the kid has, never a transaction. */
  matchAmountCents: number | null
  /** Which parent committed to the match — "Dad pays half", not just "a parent". */
  matchPayerName: string | null
  /** The kid has saved their share and can ask for it. */
  claimable: boolean
  /** A parent has handed this over. It is done, and cannot be claimed twice. */
  claimed: boolean
  /** Asked for, waiting on a parent. */
  claimPending: boolean
}

/**
 * A thing a parent would like the kid to have, with the share they commit to
 * covering. Not a product, not a catalogue entry — a line a parent typed.
 */
export interface SuggestedItem {
  id: number
  name: string
  /** The full price of the thing. */
  priceCents: number
  matchPercent: number
  /** What the kid saves for. The number that becomes their goal target. */
  kidShareCents: number
  /** What the parent covers. */
  matchAmountCents: number
  icon: string | null
  note: string | null
  /** Null means every kid in the family sees it. */
  visibleToUserId: number | null
  /** Set when this kid has already adopted it. */
  adoptedGoalId: number | null
  /** Who added it, for "Dad pays half". */
  addedByName: string
}

/** The parent's view: the same item plus who has taken it up. */
export interface SuggestedItemRow extends SuggestedItem {
  active: boolean
  visibleToName: string | null
  /** Names of kids saving for it. Editing price or match is locked once set. */
  adoptedBy: string[]
}

export interface KidSummary extends Person {
  balanceCents: number
  pendingCount: number
  openCount: number
  choresThisWeek: number
  goal: Goal | null
}

export interface TaskRow {
  choreId: number
  title: string
  rewardCents: number
  scheduleLabel: string
  /** Key into the chore icon set; null falls back to a generic glyph. */
  icon: string | null
  completionId: number | null
  status: CompletionStatus | null
  /** Set once the kid hits Start. Null until then. */
  startedAt: string | null
  /** "Started 12 minutes ago" — only while in progress. */
  startedLabel: string | null
}

/** Something the kid has asked for and is waiting on a parent to clear. */
export interface KidRequest {
  kind: ApprovalKind
  id: number
  title: string
  /** Positive for money coming in, negative for money going out. */
  amountCents: number
  icon: string | null
  at: string
  timeLabel: string
}

/**
 * A single thing being worked towards, shown as a bar in a screen's header.
 * One at a time — the ladder advances as each rung is reached.
 */
export interface Milestone {
  /** e.g. "On a roll" or "Save $50". */
  label: string
  /** Short line under the title, e.g. "3 of 10 done". */
  detail: string
  current: number
  target: number
  pct: number
  /** `count` values are things done; `cents` values are money. */
  unit: 'count' | 'cents'
  /** True once the top of the ladder is reached. */
  complete: boolean
  /** Set when the rung is within reach, e.g. "Only $0.50 to go!" */
  nudge: string | null
}

export interface KidHome {
  kid: Person
  balanceCents: number
  goal: Goal | null
  tasks: TaskRow[]
  doneCount: number
  totalCount: number
  remainingCents: number
  approverName: string
  /** The achievement being worked towards — one at a time. */
  achievement: Milestone
  /** The next savings rung: $10, $25, $50, $100 … */
  savings: Milestone
  /** Money already promised to an open withdrawal request. */
  heldCents: number
  /** Everything this kid is waiting on a parent for, both directions. */
  requests: KidRequest[]
  /** Every goal this kid is saving towards; `goal` is the active one. */
  goals: Goal[]
  /** The Good Stuff — parent suggestions this kid can see. Filtered server-side. */
  suggestions: SuggestedItem[]
}

export interface LedgerEntry {
  id: number
  type: TxType
  title: string
  meta: string
  amountCents: number
  balanceAfterCents: number
  createdAt: string
}

export interface LedgerGroup {
  label: string
  entries: LedgerEntry[]
}

export interface WeeklySummary {
  earnedCents: number
  spentCents: number
  savedPct: number | null
}

export interface Ledger {
  groups: LedgerGroup[]
  weekly: WeeklySummary
}

/**
 * One item in the parent's approval queue. Nothing leaves or enters a stash
 * without a parent clearing one of these.
 */
export type ApprovalKind = 'achievement' | 'withdrawal'

export interface ApprovalItem {
  kind: ApprovalKind
  /** Completion id for achievements, request id for withdrawals. */
  id: number
  kid: Person
  title: string
  /** Positive for an achievement payout, negative for money leaving the stash. */
  amountCents: number
  at: string
  timeLabel: string
  /** Withdrawals only: what the kid says it is for. */
  note: string | null
  /** Set when the withdrawal is a Good Stuff claim — what the parent owes. */
  matchAmountCents?: number | null
}

export interface ApprovalsPayload {
  items: ApprovalItem[]
  /** Total the kids would be paid if every achievement were approved. */
  payoutCents: number
  /** Total that would leave the stashes if every request were handed over. */
  withdrawalCents: number
}

export interface ChoreCard {
  id: number
  title: string
  rewardCents: number
  schedule: Schedule
  scheduleDetail: string | null
  scheduleLabel: string
  icon: string | null
  active: boolean
  assignees: Person[]
  /** Completions recorded against this chore, ever. Blocks careless deletes. */
  completionCount: number
}

export interface WithdrawalRequest {
  id: number
  kid: Person
  amountCents: number
  category: string
  status: WithdrawalStatus
  requestedAt: string
}

export interface FamilyOverview {
  family: Family
  parents: Person[]
  kids: KidSummary[]
  totalHeldCents: number
  weekDeltaCents: number
  pendingTotal: number
  pendingByKid: { name: string; count: number }[]
  pendingWithdrawals: WithdrawalRequest[]
}

export interface GoalRow {
  id: number
  kidId: number
  kidName: string
  title: string
  targetCents: number
  active: boolean
  progressPct: number
}

export interface ProfileUpdate {
  name?: string
  nickname?: string | null
  about?: string | null
  age?: number | null
  avatarColor?: string
  mascotPose?: Pose | null
  pin?: string | null
}

export interface ApiError {
  error: string
}
