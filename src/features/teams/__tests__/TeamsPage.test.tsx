import { screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/render'
import { module3Team, module3Tokens, module3User } from '../../../test/module3TestData'
import { persistSession } from '../../auth/authStorage'
import { TeamsPage } from '../TeamsPage'

const fetchMock = vi.fn()
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); persistSession(module3User('ADMINISTRATOR'), module3Tokens) })
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks() })

it('creates a team and changes its current coordinator', async () => {
  fetchMock.mockResolvedValueOnce(Response.json([])).mockResolvedValueOnce(Response.json(module3Team))
    .mockResolvedValueOnce(Response.json({ ...module3Team, coordinatorEmail: 'next@compira.co' }))
  const { user } = renderWithProviders(<TeamsPage />)
  await screen.findByText('No hay equipos. Crea el primero para habilitar las tareas y alertas.')
  await user.type(screen.getByLabelText('Nombre del equipo'), module3Team.name)
  await user.type(screen.getByLabelText('Correo del coordinador inicial'), module3Team.coordinatorEmail)
  await user.click(screen.getByRole('button', { name: 'Crear equipo' }))
  await screen.findByText('Equipo creado.')
  await user.type(screen.getByLabelText('Correo del usuario'), 'next@compira.co')
  await user.click(screen.getByRole('button', { name: 'Guardar cambio' }))
  expect(await screen.findByText('next@compira.co')).toBeInTheDocument()
})

it('links legacy collaborators and tasks explicitly to a selected team', async () => {
  fetchMock.mockResolvedValueOnce(Response.json([module3Team])).mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(new Response(null, { status: 204 }))
  const { user } = renderWithProviders(<TeamsPage />)
  await user.selectOptions(await screen.findByLabelText('Equipo'), module3Team.id)
  await user.selectOptions(screen.getByLabelText('Acción'), 'member')
  await user.type(screen.getByLabelText('Correo del usuario'), 'member@compira.co')
  await user.click(screen.getByRole('button', { name: 'Guardar cambio' }))
  await screen.findByText('Cambio guardado.')
  expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining('/teams/team-1/members'), expect.objectContaining({ method: 'POST' }))
  await user.selectOptions(screen.getByLabelText('Acción'), 'task')
  await user.type(screen.getByLabelText('Identificador de la tarea'), '11111111-1111-1111-1111-111111111111')
  await user.click(screen.getByRole('button', { name: 'Guardar cambio' }))
  await screen.findByText('Cambio guardado.')
  expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining('/teams/team-1/tasks'), expect.objectContaining({ method: 'POST' }))
})
