import { Navigate, Route, Routes } from 'react-router-dom'
import { useSession } from './lib/session'
import { KidPicker } from './screens/KidPicker'
import { KidHome } from './screens/KidHome'
import { KidTasks } from './screens/KidTasks'
import { TaskConfirm } from './screens/TaskConfirm'
import { FinishTask } from './screens/FinishTask'
import { GoodStuffBrowse } from './screens/GoodStuffBrowse'
import { Celebration } from './screens/Celebration'
import { PiggyBank } from './screens/PiggyBank'
import { History } from './screens/History'
import { Goals } from './screens/Goals'
import { Profile } from './screens/Profile'
import { ParentPin } from './screens/ParentPin'
import { ParentOverview } from './screens/ParentOverview'
import { Admin } from './screens/Admin'
import { Approvals } from './screens/Approvals'
import { Deposit } from './screens/Deposit'
import { ParentLedger } from './screens/ParentLedger'
import type { ReactElement } from 'react'

/** Parent screens are unreachable until a parent PIN has been accepted. */
function ParentOnly({ children }: { children: ReactElement }) {
  const { parent } = useSession()
  return parent ? children : <Navigate to="/parent/pin" replace />
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<KidPicker />} />

      <Route path="/kid/:kidId" element={<KidHome />} />
      <Route path="/kid/:kidId/tasks" element={<KidTasks />} />
      <Route path="/kid/:kidId/task/:choreId" element={<TaskConfirm />} />
      <Route path="/kid/:kidId/finish/:choreId" element={<FinishTask />} />
      <Route path="/kid/:kidId/stuff" element={<GoodStuffBrowse />} />
      <Route path="/kid/:kidId/bank" element={<PiggyBank />} />
      <Route path="/kid/:kidId/goals" element={<Goals />} />
      <Route path="/kid/:kidId/history" element={<History />} />
      <Route path="/kid/:kidId/done" element={<Celebration />} />

      {/* Kids reach their own profile; parents reach anyone's from Manage. */}
      <Route path="/profile/:personId" element={<Profile />} />

      <Route path="/parent/pin" element={<ParentPin />} />
      <Route
        path="/parent"
        element={
          <ParentOnly>
            <ParentOverview />
          </ParentOnly>
        }
      />
      <Route
        path="/parent/admin"
        element={
          <ParentOnly>
            <Admin />
          </ParentOnly>
        }
      />
      <Route path="/parent/chores" element={<Navigate to="/parent/admin" replace />} />
      <Route
        path="/parent/approvals"
        element={
          <ParentOnly>
            <Approvals />
          </ParentOnly>
        }
      />
      <Route
        path="/parent/ledger"
        element={
          <ParentOnly>
            <ParentLedger />
          </ParentOnly>
        }
      />
      <Route
        path="/parent/deposit"
        element={
          <ParentOnly>
            <Deposit />
          </ParentOnly>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
