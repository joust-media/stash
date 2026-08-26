import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Person } from '../../shared/types'

const KEY = 'coinquest.parent'

interface SessionValue {
  /** Set once a parent PIN has been accepted; cleared on "leave parent mode". */
  parent: Person | null
  unlock: (parent: Person) => void
  lock: () => void
}

const SessionContext = createContext<SessionValue | null>(null)

function read(): Person | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Person) : null
  } catch {
    return null
  }
}

/**
 * Parent mode lives in sessionStorage: this is a shared family device, so the
 * gate is a PIN for the duration of a tab, not a login with a bearer token.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [parent, setParent] = useState<Person | null>(read)

  const unlock = useCallback((next: Person) => {
    sessionStorage.setItem(KEY, JSON.stringify(next))
    setParent(next)
  }, [])

  const lock = useCallback(() => {
    sessionStorage.removeItem(KEY)
    setParent(null)
  }, [])

  const value = useMemo(() => ({ parent, unlock, lock }), [parent, unlock, lock])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside SessionProvider')
  return value
}
