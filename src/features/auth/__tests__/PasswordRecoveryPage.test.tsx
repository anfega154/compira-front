import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/render'
import { PasswordRecoveryPage } from '../PasswordRecoveryPage'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../authApi', () => ({
  requestPasswordRecovery: vi.fn(),
  confirmPasswordRecovery: vi.fn(),
  AuthRequestError: class AuthRequestError extends Error {
    code: string
    category: string
    constructor(apiError: { code: string; message: string; category: string }) {
      super(apiError.message)
      this.code = apiError.code
      this.category = apiError.category
    }
  },
}))

import { confirmPasswordRecovery, requestPasswordRecovery } from '../authApi'

const mockRequestRecovery = vi.mocked(requestPasswordRecovery)
const mockConfirmRecovery = vi.mocked(confirmPasswordRecovery)

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('PasswordRecoveryPage', () => {
  describe('request step', () => {
    it('renders email input and submit button', () => {
      renderWithProviders(<PasswordRecoveryPage />)

      expect(screen.getByRole('heading', { name: /recuperar contrasena/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/correo electronico/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /enviar codigo/i })).toBeInTheDocument()
    })

    it('has a link back to login', () => {
      renderWithProviders(<PasswordRecoveryPage />)

      expect(screen.getByRole('link', { name: /volver al inicio de sesion/i })).toBeInTheDocument()
    })

    it('disables submit when email is empty', () => {
      renderWithProviders(<PasswordRecoveryPage />)

      expect(screen.getByRole('button', { name: /enviar codigo/i })).toBeDisabled()
    })

    it('sends recovery request and advances to confirm step', async () => {
      mockRequestRecovery.mockResolvedValueOnce({ codeDeliveryDetails: { destination: 'u***@test.com', deliveryMedium: 'EMAIL', attributeName: 'email' } })

      const { user } = renderWithProviders(<PasswordRecoveryPage />)

      await user.type(screen.getByLabelText(/correo electronico/i), 'user@test.com')
      await user.click(screen.getByRole('button', { name: /enviar codigo/i }))

      expect(mockRequestRecovery).toHaveBeenCalledWith({ email: 'user@test.com' })
      expect(await screen.findByRole('heading', { name: /restablece tu contrasena/i })).toBeInTheDocument()
      expect(screen.getByText(/u\*\*\*@test\.com/)).toBeInTheDocument()
    })

    it('displays error on API failure', async () => {
      const { AuthRequestError } = await import('../authApi')
      mockRequestRecovery.mockRejectedValueOnce(new AuthRequestError({ code: 'AUTH_007', message: 'No se encontro una cuenta', category: 'NOT_FOUND' }))

      const { user } = renderWithProviders(<PasswordRecoveryPage />)

      await user.type(screen.getByLabelText(/correo electronico/i), 'nobody@test.com')
      await user.click(screen.getByRole('button', { name: /enviar codigo/i }))

      expect(await screen.findByRole('alert')).toHaveTextContent('No se encontro una cuenta')
    })
  })

  describe('confirm step', () => {
    async function advanceToConfirmStep() {
      mockRequestRecovery.mockResolvedValueOnce({ codeDeliveryDetails: { destination: 'u***@test.com', deliveryMedium: 'EMAIL', attributeName: 'email' } })

      const rendered = renderWithProviders(<PasswordRecoveryPage />)

      await rendered.user.type(screen.getByLabelText(/correo electronico/i), 'user@test.com')
      await rendered.user.click(screen.getByRole('button', { name: /enviar codigo/i }))

      await screen.findByRole('heading', { name: /restablece tu contrasena/i })

      return rendered
    }

    it('renders code, new password, and confirm password fields', async () => {
      await advanceToConfirmStep()

      expect(screen.getByLabelText(/codigo de verificacion/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/nueva contrasena/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/confirmar contrasena/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /restablecer contrasena/i })).toBeInTheDocument()
    })

    it('shows password criteria tooltip on new password focus', async () => {
      const { user } = await advanceToConfirmStep()

      await user.click(screen.getByLabelText(/nueva contrasena/i))

      expect(screen.getByRole('tooltip')).toBeInTheDocument()
    })

    it('confirms recovery and shows success', async () => {
      mockConfirmRecovery.mockResolvedValueOnce(undefined)

      const { user } = await advanceToConfirmStep()

      await user.type(screen.getByLabelText(/codigo de verificacion/i), '847291')
      await user.type(screen.getByLabelText(/nueva contrasena/i), 'NewSecure12!')
      await user.type(screen.getByLabelText(/confirmar contrasena/i), 'NewSecure12!')
      await user.click(screen.getByRole('button', { name: /restablecer contrasena/i }))

      expect(mockConfirmRecovery).toHaveBeenCalledWith({
        email: 'user@test.com',
        confirmationCode: '847291',
        newPassword: 'NewSecure12!',
      })

      expect(await screen.findByRole('heading', { name: /contrasena actualizada/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /ir a iniciar sesion/i })).toBeInTheDocument()
    })

    it('displays error on invalid code', async () => {
      const { AuthRequestError } = await import('../authApi')
      mockConfirmRecovery.mockRejectedValueOnce(new AuthRequestError({ code: 'AUTH_003', message: 'El codigo de confirmacion es invalido', category: 'BAD_REQUEST' }))

      const { user } = await advanceToConfirmStep()

      await user.type(screen.getByLabelText(/codigo de verificacion/i), '000000')
      await user.type(screen.getByLabelText(/nueva contrasena/i), 'NewSecure12!')
      await user.type(screen.getByLabelText(/confirmar contrasena/i), 'NewSecure12!')
      await user.click(screen.getByRole('button', { name: /restablecer contrasena/i }))

      expect(await screen.findByRole('alert')).toHaveTextContent('El codigo de confirmacion es invalido')
    })
  })
})
