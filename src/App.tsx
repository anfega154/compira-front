import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './app/AppShell'
import { ProtectedRoute } from './app/ProtectedRoute'
import { PublicRoute } from './app/PublicRoute'
import { AuthLayout } from './features/auth/AuthLayout'
import { LoginPage } from './features/auth/LoginPage'
import { NewPasswordPage } from './features/auth/NewPasswordPage'
import { OtpVerificationPage } from './features/auth/OtpVerificationPage'
import { PasswordRecoveryPage } from './features/auth/PasswordRecoveryPage'
import { CompaniesPage } from './features/companies/CompaniesPage'
import { DeleteUserPage } from './features/users/DeleteUserPage'
import { RegisterUserPage } from './features/users/RegisterUserPage'

function App() {
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
          <Route path="/" element={<CompaniesPage />} />
          <Route path="/users/register" element={<RegisterUserPage />} />
          <Route path="/users/delete" element={<DeleteUserPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
