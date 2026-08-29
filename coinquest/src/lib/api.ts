import type {
  ApprovalKind,
  Goal,
  ApprovalsPayload,
  ChoreCard,
  FamilyOverview,
  GoalRow,
  KidHome,
  Ledger,
  Person,
  ProfileUpdate,
  Schedule,
  SuggestedItem,
  SuggestedItemRow,
} from '../../shared/types'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, (body as { error?: string }).error ?? 'Something went wrong')
  }
  return res.json() as Promise<T>
}

const send = <T>(method: string, path: string, body: unknown) =>
  request<T>(path, { method, body: JSON.stringify(body) })

export interface StartResult {
  completionId: number
  choreTitle: string
  rewardCents: number
}

export interface CompletionResult {
  completionId: number
  kidName: string
  choreTitle: string
  rewardCents: number
  approverName: string
  /** How long the task took, from Start to End. */
  tookLabel: string | null
  nextTask: { choreId: number; title: string } | null
}

export interface GoalInput {
  /** Whoever is making the change: the kid themselves, or a parent. */
  actorId: number
  kidId: number
  title: string
  targetCents: number
  icon?: string | null
  /** A photo of the thing, client-resized to a small data URL. */
  image?: string | null
  active?: boolean
}

export interface SuggestedItemInput {
  parentId: number
  name: string
  priceCents: number
  matchPercent: number
  icon?: string | null
  note?: string | null
  /** Null shows it to every kid in the family. */
  visibleToUserId?: number | null
}

export interface ChoreInput {
  parentId: number
  title: string
  rewardCents: number
  description?: string | null
  schedule: Schedule
  scheduleDetail?: string | null
  icon?: string | null
  kidIds: number[]
}

export const api = {
  family: () => request<FamilyOverview>('/family'),
  kidHome: (kidId: number) => request<KidHome>(`/kids/${kidId}/home`),
  ledger: (kidId: number, filter: string) => request<Ledger>(`/kids/${kidId}/ledger?filter=${filter}`),
  approvals: () => request<ApprovalsPayload>('/approvals'),
  chores: (kidId?: number) => request<ChoreCard[]>(`/chores${kidId ? `?kidId=${kidId}` : ''}`),
  goals: () => request<GoalRow[]>('/goals'),
  kidGoals: (kidId: number) => request<Goal[]>(`/goals/kids/${kidId}`),
  people: () => request<Person[]>('/users'),

  unlockParent: (pin: string) => send<{ parent: Person }>('POST', '/auth/parent', { pin }),

  /** A task runs Start → End; End is what alerts the parent. */
  startTask: (choreId: number, kidId: number) =>
    send<StartResult>('POST', '/completions/start', { choreId, kidId }),
  endTask: (completionId: number, kidId: number) =>
    send<CompletionResult>('POST', `/completions/${completionId}/end`, { kidId }),
  cancelTask: (completionId: number, kidId: number) =>
    send<{ ok: true }>('POST', `/completions/${completionId}/cancel`, { kidId }),

  /** Both halves of the approval queue share these two calls. */
  approve: (kind: ApprovalKind, id: number, parentId: number) =>
    send<{ paidCents?: number; handedOverCents?: number }>('POST', `/approvals/${kind}/${id}/approve`, {
      parentId,
    }),
  reject: (kind: ApprovalKind, id: number, parentId: number) =>
    send<{ ok: true }>('POST', `/approvals/${kind}/${id}/reject`, { parentId }),
  approveAll: (parentId: number) =>
    send<{ approved: number; paidCents: number }>('POST', '/approvals/approve-all', { parentId }),

  deposit: (input: { kidId: number; amountCents: number; note?: string; parentId: number }) =>
    send<{ balanceCents: number }>('POST', '/money/deposits', input),
  requestWithdrawal: (input: {
    kidId: number
    amountCents: number
    category: string
    note?: string
    /** Set to claim a Good Stuff goal — the server re-derives the amount. */
    goalId?: number | null
  }) => send<{ id: number }>('POST', '/money/withdrawals', input),

  createChore: (input: ChoreInput) => send<{ id: number }>('POST', '/chores', input),
  updateChore: (id: number, input: ChoreInput) => send<{ ok: true }>('PUT', `/chores/${id}`, input),
  setChoreActive: (id: number, input: { parentId: number; active: boolean }) =>
    send<{ ok: true }>('PATCH', `/chores/${id}`, input),
  deleteChore: (id: number, parentId: number) => send<{ ok: true }>('DELETE', `/chores/${id}`, { parentId }),

  createGoal: (input: GoalInput) => send<{ id: number }>('POST', '/goals', input),
  updateGoal: (id: number, input: GoalInput) => send<{ ok: true }>('PUT', `/goals/${id}`, input),
  setGoalActive: (id: number, actorId: number) =>
    send<{ ok: true }>('PATCH', `/goals/${id}/active`, { actorId }),
  deleteGoal: (id: number, actorId: number) => send<{ ok: true }>('DELETE', `/goals/${id}`, { actorId }),

  goodStuff: (kidId: number) => request<SuggestedItem[]>(`/good-stuff?kidId=${kidId}`),
  sendReminder: (kidId: number) =>
    send<{ remainingToday: number }>('POST', '/reminders', { kidId }),
  allGoodStuff: () => request<SuggestedItemRow[]>('/good-stuff/all'),
  createSuggestion: (input: SuggestedItemInput) => send<{ id: number }>('POST', '/good-stuff', input),
  updateSuggestion: (id: number, input: SuggestedItemInput) =>
    send<{ ok: true }>('PUT', `/good-stuff/${id}`, input),
  deleteSuggestion: (id: number, parentId: number) =>
    send<{ ok: true; stillSavedFor: number }>('DELETE', `/good-stuff/${id}`, { parentId }),
  adoptSuggestion: (id: number, input: { actorId: number; kidId: number; makeActive?: boolean }) =>
    send<{ goalId: number; kidShareCents: number; matchAmountCents: number; claimable: boolean }>(
      'POST',
      `/good-stuff/${id}/adopt`,
      input,
    ),

  person: (id: number) => request<Person>(`/users/${id}`),
  updateProfile: (id: number, input: ProfileUpdate & { actorId: number }) =>
    send<Person>('PATCH', `/users/${id}`, input),
  addPerson: (input: {
    parentId: number
    name: string
    role: 'kid' | 'parent'
    age?: number | null
    avatarColor?: string
    pin?: string
  }) => send<Person>('POST', '/users', input),
}

/** The avatar colours the API accepts — the Stash palette, nothing else. */
export const AVATAR_COLORS = ['#8B4A2B', '#2FBF71', '#1E8F52', '#5C3319', '#F2B93B', '#D96B4A']
