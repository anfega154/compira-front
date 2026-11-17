import { screen, within, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/render'
import { module3Tokens, module3User } from '../../../test/module3TestData'
import { persistSession } from '../../auth/authStorage'
import { ReportsPage } from '../ReportsPage'
import { getExecutiveReport } from '../../reports/reportApi'
import { getTaskIndicators } from '../tasksApi'
import { getTeams } from '../../teams/teamsApi'
import { reportFixture, metrics } from '../../reports/__tests__/reportFixture'
import * as pdf from '../../reports/reportPdf'
import type { ReportItem } from '../../reports/reportTypes'

vi.mock('../../reports/reportApi',()=>({getExecutiveReport:vi.fn()}))
vi.mock('../tasksApi',async original=>({...await original<typeof import('../tasksApi')>(),getTaskIndicators:vi.fn()}))
vi.mock('../../teams/teamsApi',()=>({getTeams:vi.fn()}))
vi.mock('../../reports/reportPdf',()=>({createExecutivePdf:vi.fn(),loadReportFonts:vi.fn(),reportFilename:vi.fn()}))
const save=vi.fn()
beforeEach(()=>{
 persistSession(module3User('ADMINISTRATOR'),module3Tokens)
 vi.mocked(getExecutiveReport).mockResolvedValue(reportFixture())
 vi.mocked(getTeams).mockResolvedValue([{id:'20000000-0000-0000-0000-000000000001',name:'Operaciones',coordinatorUserId:'coord',coordinatorEmail:'coord@example.test'}])
 vi.mocked(getTaskIndicators).mockResolvedValue({totalTasks:3,overdueCount:1,dueSoonCount:0,closedCount:1,closedOnTimeCount:1,compliancePercentage:100,workloadByAssignee:[],assignees:[{id:'10000000-0000-0000-0000-000000000001',name:'Ana García',email:'ana@example.test'}]})
 vi.mocked(pdf.loadReportFonts).mockResolvedValue({regular:'font',bold:'font'})
 vi.mocked(pdf.createExecutivePdf).mockReturnValue({save} as never)
 vi.mocked(pdf.reportFilename).mockReturnValue('informe.pdf')
})
afterEach(()=>vi.resetAllMocks())
async function ready(){await screen.findByRole('heading',{name:'Resumen ejecutivo'})}
describe('ReportsPage executive workflow',()=>{
 it('renders totals, quality, groups, real closure dates and methodology with the complete authorized cut',async()=>{
  renderWithProviders(<ReportsPage />);await ready()
  expect(screen.getByText('Toda la organización')).toBeVisible();expect(screen.getByRole('heading',{name:'Calidad de datos'})).toBeVisible()
  const region=screen.getByRole('region',{name:'Productividad y cumplimiento por responsable'})
  expect(within(region).getByRole('row',{name:/Ana García/})).toHaveTextContent('100%')
  expect(within(region).getByRole('row',{name:/Sin responsable/})).toBeVisible()
  expect(screen.getByRole('heading',{name:'Metodología y límites de interpretación'})).toBeVisible()
  expect(screen.getByRole('button',{name:'Exportar PDF'})).toBeEnabled()
 })
 it('uses coordinator scope and the same available reporting controls',async()=>{
  persistSession(module3User('COORDINATOR'),module3Tokens);vi.mocked(getExecutiveReport).mockResolvedValue(reportFixture({scope:'COORDINATED_TEAMS'}))
  renderWithProviders(<ReportsPage />);await ready();expect(screen.getByText('Tus equipos coordinados actualmente')).toBeVisible()
  expect(screen.getByLabelText('Responsable')).toHaveTextContent('Ana García');expect(screen.getByRole('button',{name:'Exportar PDF'})).toBeEnabled()
 })
 it('prevents exporting stale filter selections and generates all filter dimensions explicitly',async()=>{
  const {user}=renderWithProviders(<ReportsPage />);await ready()
  await user.selectOptions(screen.getByLabelText('Base del periodo'),'CLOSED')
  await user.type(screen.getByLabelText('Desde'),'2026-10-01');await user.type(screen.getByLabelText('Hasta'),'2026-10-31')
  await user.selectOptions(screen.getByLabelText('Equipo'),'20000000-0000-0000-0000-000000000001')
  await user.selectOptions(screen.getByLabelText('Responsable'),'UNASSIGNED');await user.selectOptions(screen.getByLabelText('Estado'),'CLOSED')
  expect(screen.getByRole('button',{name:'Exportar PDF'})).toBeDisabled();expect(screen.getByText(/Hay filtros modificados/)).toBeVisible()
  await user.click(screen.getByRole('button',{name:'Generar informe'}));await waitFor(()=>expect(getExecutiveReport).toHaveBeenCalledTimes(2))
  expect(vi.mocked(getExecutiveReport).mock.calls[1][0]).toMatchObject({dateBasis:'CLOSED',from:'2026-10-01',to:'2026-10-31',responsibleId:'UNASSIGNED',status:'CLOSED'})
  expect(await screen.findByRole('button',{name:'Exportar PDF'})).toBeEnabled()
 })
 it('rejects a reversed date range without an API call',async()=>{
  const {user}=renderWithProviders(<ReportsPage />);await ready();await user.type(screen.getByLabelText('Desde'),'2026-11-02');await user.type(screen.getByLabelText('Hasta'),'2026-11-01')
  expect(screen.getByRole('alert')).toHaveTextContent('no puede superar');expect(screen.getByRole('button',{name:'Generar informe'})).toBeDisabled();expect(getExecutiveReport).toHaveBeenCalledTimes(1)
 })
 it('clears filters and requires generation before exporting the cleared selection',async()=>{
  const {user}=renderWithProviders(<ReportsPage />);await ready();await user.selectOptions(screen.getByLabelText('Estado'),'PENDING');await user.click(screen.getByRole('button',{name:'Limpiar filtros'}))
  expect(screen.getByLabelText('Estado')).toHaveValue('');expect(screen.getByRole('button',{name:'Exportar PDF'})).toBeEnabled()
 })
 it('exports the exact loaded snapshot, not a new request or searched subset',async()=>{
  const {user}=renderWithProviders(<ReportsPage />);await ready();await user.type(screen.getByLabelText('Buscar en el detalle'),'inexistente')
  expect(screen.getByText('No hay tareas que coincidan.')).toBeVisible();await user.click(screen.getByRole('button',{name:'Exportar PDF'}))
  await waitFor(()=>expect(save).toHaveBeenCalledWith('informe.pdf'));expect(getExecutiveReport).toHaveBeenCalledTimes(1)
  expect(vi.mocked(pdf.createExecutivePdf).mock.calls[0][0].tasks).toHaveLength(3)
 })
 it('shows export failure and allows a retry without losing the report',async()=>{
  vi.mocked(pdf.loadReportFonts).mockRejectedValueOnce(new Error('Fuentes no disponibles'))
  const {user}=renderWithProviders(<ReportsPage />);await ready();await user.click(screen.getByRole('button',{name:'Exportar PDF'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('Fuentes no disponibles');await user.click(screen.getByRole('button',{name:'Exportar PDF'}));await waitFor(()=>expect(save).toHaveBeenCalledTimes(1))
 })
 it('does not present a failed new generation as a valid old report',async()=>{
  const {user}=renderWithProviders(<ReportsPage />);await ready();vi.mocked(getExecutiveReport).mockRejectedValueOnce(new Error('Reduzca el periodo; más de 5000 tareas'))
  await user.click(screen.getByRole('button',{name:'Generar informe'}));expect(await screen.findByRole('alert')).toHaveTextContent('5000')
  expect(screen.queryByRole('heading',{name:'Resumen ejecutivo'})).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Exportar PDF'})).toBeDisabled()
 })
 it('handles an empty authorized cut with explicit not-evaluable metrics',async()=>{
  vi.mocked(getExecutiveReport).mockResolvedValue(reportFixture({summary:{...metrics,total:0,compliancePercentage:null},tasks:[],teams:[],assignees:[],monthlyCohorts:[]}))
  renderWithProviders(<ReportsPage />);await ready();expect(screen.getByText(/No hay tareas para el periodo/)).toBeVisible();expect(screen.getByRole('button',{name:'Exportar PDF'})).toBeEnabled();expect(screen.getAllByText('N/D').length).toBeGreaterThan(0)
 })
 it('tolerates option lookup failure without granting access or hiding generated data',async()=>{
  vi.mocked(getTeams).mockRejectedValueOnce(new Error('Equipos no disponibles'));vi.mocked(getTaskIndicators).mockRejectedValueOnce(new Error('Indicadores no disponibles'))
  renderWithProviders(<ReportsPage />);await ready();expect(screen.getByText(/Algunas opciones de filtro/)).toBeVisible();expect(screen.getByLabelText('Equipo')).toHaveTextContent('Operaciones')
 })
 it('paginates the screen without dropping rows from the export snapshot',async()=>{
  const items:ReportItem[]=Array.from({length:27},(_,i)=>({...reportFixture().tasks[0],id:`t-${i}`,title:`Tarea ${i}`}))
  vi.mocked(getExecutiveReport).mockResolvedValue(reportFixture({tasks:items,summary:{...metrics,total:27}}))
  const {user}=renderWithProviders(<ReportsPage />);await ready();const region=screen.getByRole('region',{name:'Detalle de tareas del informe'})
  expect(within(region).getAllByRole('row')).toHaveLength(26);await user.click(screen.getByRole('button',{name:'Siguiente'}));expect(within(region).getAllByRole('row')).toHaveLength(3)
  await user.click(screen.getByRole('button',{name:'Anterior'}));expect(within(region).getAllByRole('row')).toHaveLength(26)
 })
 it('aborts pending generation on unmount and never saves a cancelled export',async()=>{
  let resolveFonts:(v:{regular:string;bold:string})=>void=()=>{};vi.mocked(pdf.loadReportFonts).mockImplementationOnce(()=>new Promise(resolve=>{resolveFonts=resolve}))
  const {user,unmount}=renderWithProviders(<ReportsPage />);await ready();const signal=vi.mocked(getExecutiveReport).mock.calls[0][1]
  await user.click(screen.getByRole('button',{name:'Exportar PDF'}));unmount();resolveFonts({regular:'font',bold:'font'});await new Promise(resolve=>setTimeout(resolve,5));expect(signal.aborted).toBe(true);expect(save).not.toHaveBeenCalled()
 })
})
