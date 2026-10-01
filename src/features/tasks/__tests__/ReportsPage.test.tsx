import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/render'
import { module3Tokens, module3User } from '../../../test/module3TestData'
import { persistSession } from '../../auth/authStorage'
import { ReportsPage } from '../ReportsPage'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  persistSession(module3User('ADMINISTRATOR'), module3Tokens)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})

describe('ReportsPage (HU-29 / HU-38)', () => {
  it('renders per-assignee productivity, compliance and closure time', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({
      rows: [{
        assigneeId: 'user-9',
        assigneeName: 'Ana García',
        assigneeEmail: 'ana@compira.co',
        totalTasks: 5,
        activeTasks: 2,
        closedTasks: 3,
        closedOnTimeTasks: 2,
        overdueTasks: 1,
        compliancePercentage: 67,
        averageClosureHours: 12.5,
      }],
    }))

    renderWithProviders(<ReportsPage />)

    const row = await screen.findByRole('row', { name: /Ana García/i })
    expect(within(row).getByText('67%')).toBeInTheDocument()
    expect(within(row).getByText('12.5 h')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/tasks/reports'), expect.objectContaining({ method: 'GET' }))
  })

  it('shows an empty state when there is no data', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ rows: [] }))
    renderWithProviders(<ReportsPage />)
    expect(await screen.findByText('No hay datos suficientes para generar reportes.')).toBeInTheDocument()
  })

  it('shows an error state when the request fails', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ code: 'TASK_001', message: 'Error de reportes' }, { status: 500 }))
    renderWithProviders(<ReportsPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Error de reportes')
  })
})
