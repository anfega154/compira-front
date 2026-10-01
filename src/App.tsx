import { TeamsPage } from './features/teams/TeamsPage'
import { OrganizationSettingsPage } from './features/organization/OrganizationSettingsPage'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './app/AppShell'
import { ProtectedRoute } from './app/ProtectedRoute'
import { PublicRoute } from './app/PublicRoute'
import { AuthLayout } from './features/auth/AuthLayout'
import { LoginPage } from './features/auth/LoginPage'
import { NewPasswordPage } from './features/auth/NewPasswordPage'
import { OtpVerificationPage } from './features/auth/OtpVerificationPage'
import { PasswordRecoveryPage } from './features/auth/PasswordRecoveryPage'
import { useAuth } from './features/auth/useAuth'
import { AssignedTasksPage } from './features/tasks/AssignedTasksPage'
import { CreateTaskPage } from './features/tasks/CreateTaskPage'
import { ReportsPage } from './features/tasks/ReportsPage'
import { TaskDetailPage } from './features/tasks/TaskDetailPage'
import { TasksPage } from './features/tasks/TasksPage'
import { DeleteUserPage } from './features/users/DeleteUserPage'
import { RegisterUserPage } from './features/users/RegisterUserPage'
import { UsersPage } from './features/users/UsersPage'

function App() {
  const { user } = useAuth()
  const homePath = user?.roles.some(role => role === 'ADMINISTRATOR' || role === 'COORDINATOR')
    ? '/tasks' : '/tasks/assigned'

  return (
    <Routes>
      <Route element={<PublicRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/new-password" element={<NewPasswordPage />} />
          <Route path="/auth/verify" element={<OtpVerificationPage />} />
          <Route path="/auth/password-recovery" element={<PasswordRecoveryPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to={homePath} replace />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/organization/settings" element={<OrganizationSettingsPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/tasks/create" element={<CreateTaskPage />} />
          <Route path="/tasks/assigned" element={<AssignedTasksPage />} />
          <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
          <Route element={<ProtectedRoute allowedRoles={['ADMINISTRATOR']} />}>
            <Route path="/users" element={<UsersPage />} />
            <Route path="/users/register" element={<RegisterUserPage />} />
            <Route path="/users/delete" element={<DeleteUserPage />} />
            <Route path="/reports" element={<ReportsPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
