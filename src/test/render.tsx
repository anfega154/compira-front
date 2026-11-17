import { render } from '@testing-library/react'
import type { RenderOptions } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../features/auth/AuthContext'

type WrapperProps = {
  children: ReactNode
}

function AllProviders({ children }: WrapperProps) {
  return (
    <MemoryRouter>
      <AuthProvider>{children}</AuthProvider>
    </MemoryRouter>
  )
}

type CustomRenderOptions = Omit<RenderOptions, 'wrapper'> & {
  initialEntries?: string[]
}

function renderWithProviders(ui: ReactNode, options: CustomRenderOptions = {}) {
  const { initialEntries, ...renderOptions } = options

  function Wrapper({ children }: WrapperProps) {
    return (
      <MemoryRouter initialEntries={initialEntries}>
        <AuthProvider>{children}</AuthProvider>
      </MemoryRouter>
    )
  }

  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: initialEntries ? Wrapper : AllProviders, ...renderOptions }),
  }
}

export { renderWithProviders }
