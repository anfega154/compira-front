import { screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/render'
import { module3Tokens, module3User } from '../../../test/module3TestData'
import { persistSession } from '../../auth/authStorage'
import { OrganizationSettingsPage } from '../OrganizationSettingsPage'

const fetchMock = vi.fn()
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); persistSession(module3User('ADMINISTRATOR'), module3Tokens) })
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks() })

it('loads and saves global timezone and notification switch', async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ timeZone: null, notificationsEnabled: false }))
    .mockResolvedValueOnce(Response.json({ timeZone: 'America/Bogota', notificationsEnabled: true }))
  const { user } = renderWithProviders(<OrganizationSettingsPage />)
  expect(screen.getByRole('status')).toHaveTextContent('Cargando')
  const zone = await screen.findByLabelText('Zona horaria global')
  await user.selectOptions(zone, 'America/Bogota')
  await user.click(screen.getByLabelText('Notificaciones activas'))
  await user.click(screen.getByRole('button', { name: 'Guardar configuración' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Configuración guardada')
  expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining('/organization/settings'), expect.objectContaining({ method: 'PUT', body: JSON.stringify({ timeZone: 'America/Bogota', notificationsEnabled: true }) }))
})

it('preserves input on save failure and presents actionable error', async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ timeZone: 'UTC', notificationsEnabled: true })).mockResolvedValueOnce(new Response(null, { status: 500 }))
  const { user } = renderWithProviders(<OrganizationSettingsPage />)
  await screen.findByLabelText('Zona horaria global')
  await user.selectOptions(screen.getByLabelText('Zona horaria global'), 'America/Bogota')
  await user.click(screen.getByRole('button', { name: 'Guardar configuración' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Intenta nuevamente')
  expect(screen.getByLabelText('Zona horaria global')).toHaveValue('America/Bogota')
})

it('does not expose administrator configuration to collaborators', () => {
  persistSession(module3User(), module3Tokens)
  renderWithProviders(<OrganizationSettingsPage />)
  expect(screen.getByRole('alert')).toHaveTextContent('Solo el Administrador')
  expect(fetchMock).not.toHaveBeenCalled()
})
