import { jsPDF } from 'jspdf'
import { autoTable, type UserOptions } from 'jspdf-autotable'
import { TASK_STATUS_LABELS } from '../tasks/taskLabels'
import { DATE_BASIS_LABELS, REPORT_METHODOLOGY, hours, percent, reportDate } from './reportTypes'
import type { ExecutiveReport, ReportGroup } from './reportTypes'

export type ReportFonts = { regular: string; bold: string }
const regularUrl = new URL('./fonts/NotoSans-Regular.ttf', import.meta.url).href
const boldUrl = new URL('./fonts/NotoSans-Bold.ttf', import.meta.url).href
function base64(bytes: Uint8Array): string {
  let text = ''
  for (let i = 0; i < bytes.length; i += 32768) text += String.fromCharCode(...bytes.subarray(i, i + 32768))
  return btoa(text)
}
export async function loadReportFonts(signal: AbortSignal): Promise<ReportFonts> {
  const fonts = await Promise.all([regularUrl, boldUrl].map(async url => {
    const response = await fetch(url, { signal, credentials: 'omit' })
    if (!response.ok) throw new Error('No se pudieron cargar las fuentes del PDF. Vuelve a intentar la exportación.')
    return base64(new Uint8Array(await response.arrayBuffer()))
  }))
  return { regular: fonts[0], bold: fonts[1] }
}
// Sólo texto: no HTML, URLs remotas, evaluaciones, imágenes de datos ni acciones JavaScript en el PDF.
export function pdfText(value: unknown): string {
  // eslint-disable-next-line no-control-regex -- eliminar controles de datos, conservar texto Unicode
  return String(value ?? 'N/D').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').normalize('NFC')
}
export function reportFilename(report: ExecutiveReport): string {
  return `COMPIRA-informe-gerencial-${report.generatedAt.slice(0, 10)}-${report.reportId.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 36)}.pdf`
}
export function createExecutivePdf(report: ExecutiveReport, fonts: ReportFonts): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true })
  doc.addFileToVFS('NotoSans-Regular.ttf', fonts.regular)
  doc.addFileToVFS('NotoSans-Bold.ttf', fonts.bold)
  doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal')
  doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold')
  doc.setFont('NotoSans', 'normal')
  doc.setLanguage('es-CO')
  doc.setProperties({ title: 'Informe gerencial de tareas COMPIRA', subject: `Corte ${report.reportId}`, author: 'COMPIRA', creator: 'COMPIRA', keywords: 'gestión de tareas, gerencia, seguimiento, uso interno' })
  doc.viewerPreferences({ DisplayDocTitle: true })
  const margin = 14
  let y = 24
  const width = () => doc.internal.pageSize.getWidth()
  const height = () => doc.internal.pageSize.getHeight()
  const clean = (v: unknown) => pdfText(v)
  const date = (v: string | null) => reportDate(v, report.timeZone)
  function page(landscape = false) { doc.addPage('a4', landscape ? 'landscape' : 'portrait'); y = 26 }
  function room(mm: number) { if (y + mm > height() - 22) page(width() > height()) }
  function paragraph(text: string, size = 9.2) {
    doc.setFont('NotoSans', 'normal'); doc.setFontSize(size); doc.setTextColor(35, 43, 55)
    const lines = doc.splitTextToSize(clean(text), width() - margin * 2) as string[]
    for (const line of lines) { room(5.2); doc.text(line, margin, y); y += 4.8 }
    y += 2.5
  }
  function heading(title: string, fresh = false, landscape = false) {
    if (fresh) page(landscape)
    room(22); doc.setFont('NotoSans', 'bold'); doc.setFontSize(14); doc.setTextColor(0, 0, 0)
    const lines = doc.splitTextToSize(title, width() - margin * 2) as string[]
    doc.text(lines, margin, y); y += lines.length * 6 + 4
    doc.outline.add(undefined, title, { pageNumber: doc.getNumberOfPages() })
  }
  function table(head: string[], body: (string | number)[][], options: Partial<UserOptions> = {}) {
    room(22)
    autoTable(doc, { startY: y, margin: { top: 26, right: margin, bottom: 22, left: margin },
      head: [head.map(clean)], body: body.map(row => row.map(clean)), theme: 'grid',
      styles: { font: 'NotoSans', fontSize: 8, cellPadding: 2.3, overflow: 'linebreak', lineColor: [217, 221, 225], lineWidth: 0.15, textColor: [35, 43, 55] },
      headStyles: { fillColor: [232, 240, 241], textColor: [10, 40, 45], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 251] }, rowPageBreak: 'avoid', showHead: 'everyPage', ...options })
    y = ((doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY) + 8
  }
  const s = report.summary
  heading('Informe gerencial de tareas')
  paragraph('COMPIRA | Seguimiento operativo y cumplimiento de compromisos')
  table(['Control del informe', 'Detalle'], [
    ['Identificador', report.reportId], ['Versión de metodología', report.version],
    ['Generado', `${date(report.generatedAt)} | ${report.timeZone}`], ['Generado por', report.generatedBy || 'Usuario autorizado'],
    ['Alcance', report.scope === 'ORGANIZATION' ? 'Toda la organización' : 'Equipos coordinados actualmente por el usuario'],
    ['Selección temporal', `${DATE_BASIS_LABELS[report.filters.dateBasis]} | ${report.filters.from || 'Sin límite inicial'} a ${report.filters.to || 'Sin límite final'} (fechas inclusivas)`],
    ['Equipo', report.filters.teamId ? (report.teams.find(t => t.id === report.filters.teamId)?.name || report.filters.teamId) : 'Todos dentro del alcance'],
    ['Responsable', report.filters.unassigned ? 'Sin responsable' : report.filters.responsibleId ? (report.assignees.find(a => a.id === report.filters.responsibleId)?.name || report.filters.responsibleId) : 'Todos, incluidos sin responsable'],
    ['Estado seleccionado', report.filters.status ? TASK_STATUS_LABELS[report.filters.status] : 'Todos los estados'],
    ['Cobertura', `${s.total} tareas completas en este corte. No se limita a la página o búsqueda de la pantalla.`],
  ], { columnStyles: { 0: { cellWidth: 45 } } })
  paragraph('USO INTERNO - CONFIDENCIAL. Contiene información operativa y de responsables. Compartir únicamente con personas autorizadas. Conservar el archivo según la política de la organización.')
  paragraph('Lectura: el periodo selecciona tareas por la fecha indicada, pero sus estados, equipos y responsables son los vigentes al consultar. No es una reconstrucción de cómo estaba la organización en una fecha pasada.')

  heading('1 Resumen ejecutivo', true)
  if (s.total === 0) paragraph('No se encontraron tareas para los filtros y el alcance seleccionados. No se infiere ausencia de trabajo fuera de este corte.')
  for (const finding of report.findings) paragraph(finding)
  table(['Indicador', 'Resultado', 'Lectura'], [
    ['Tareas totales', s.total, 'Incluye tareas sin responsable y canceladas.'],
    ['Activas / completadas / cerradas', `${s.active} / ${s.completed} / ${s.closed}`, 'Completadas pendientes de aprobación no son cerradas.'],
    ['Vencidas / vencen en 24 h', `${s.overdue} / ${s.dueSoon}`, 'Sólo tareas activas.'],
    ['Sin responsable', s.unassigned, 'Incluidas en el total y desgloses.'],
    ['Avance de tareas', percent(s.progressPercentage), 'Completadas o cerradas sobre total sin canceladas.'],
    ['Cumplimiento a tiempo', percent(s.compliancePercentage), `${s.closedOnTime} cierres a tiempo / ${s.evaluableClosed} cierres evaluables.`],
    ['Cierre promedio / mediana', `${hours(s.averageClosureHours)} / ${hours(s.medianClosureHours)}`, 'Horas calendario; no esfuerzo trabajado.'],
    ['Antigüedad activa promedio / máxima', `${hours(s.averageActiveAgeHours)} / ${hours(s.oldestActiveAgeHours)}`, 'Desde la creación hasta el corte.'],
    ['Retraso activo máximo', hours(s.maximumOverdueHours), 'Tiempo calendario después de la fecha límite.'],
  ], { columnStyles: { 0: { cellWidth: 52 }, 1: { cellWidth: 40 } } })
  heading('Acciones sugeridas')
  report.recommendations.forEach((v, i) => paragraph(`${i + 1}. ${v}`))

  heading('2 Distribución y calidad de los datos', true)
  table(['Estado actual', 'Tareas', 'Porcentaje del total'], report.distribution.map(d => [TASK_STATUS_LABELS[d.status], d.count, s.total ? `${Math.round(1000 * d.count / s.total) / 10}%` : 'N/D']))
  const q = report.quality
  table(['Control de calidad', 'Tareas', 'Consecuencia'], [
    ['Sin fecha límite', q.missingDueDate, 'No permiten evaluar vencimiento o puntualidad.'],
    ['Sin equipo', q.missingTeam, 'Se agrupan en Sin equipo; no se inventa una asociación.'],
    ['Cerradas sin evento de cierre', q.closedWithoutHistory, 'No se usa la última actualización como sustituto. Se excluyen de duración y puntualidad.'],
    ['Fechas de cierre inconsistentes', q.invalidClosureDates, 'Se excluyen del cálculo de duración y puntualidad.'],
  ])
  paragraph('Los controles pueden coincidir en una misma tarea y no se suman como tareas únicas. N/D representa información no evaluable, no un valor cero ni aprobación automática.')

  function groupTable(groups: ReportGroup[]) {
    table(['Equipo o responsable', 'Total', 'Activas', 'Vencidas', '24 h', 'Complet.', 'Cerradas', 'A tiempo / evaluables', 'Puntualidad', 'Cierre promedio'],
      groups.map(g => [g.email ? `${g.name}\n${g.email}` : g.name, g.metrics.total, g.metrics.active, g.metrics.overdue, g.metrics.dueSoon, g.metrics.completed, g.metrics.closed, `${g.metrics.closedOnTime}/${g.metrics.evaluableClosed}`, percent(g.metrics.compliancePercentage), hours(g.metrics.averageClosureHours)]),
      { styles: { font: 'NotoSans', fontSize: 7.5, cellPadding: 2, lineColor: [217, 221, 225], lineWidth: 0.15 }, columnStyles: { 0: { cellWidth: 59 } } })
  }
  heading('3 Desglose por equipo', true, true)
  paragraph('Equipos actuales ordenados por tareas vencidas. No es un ranking de desempeño cualitativo ni de capacidad; el volumen y la mezcla de trabajo son distintos.')
  groupTable(report.teams)
  heading('4 Desglose por responsable', true, true)
  paragraph('Incluye el grupo Sin responsable para conciliar los totales. Los nombres corresponden al perfil actual. No comparar porcentajes sin revisar el tamaño de la base evaluable.')
  groupTable(report.assignees)
  heading('5 Cohortes mensuales del conjunto seleccionado', true)
  paragraph('Creaciones y cierres conocidos dentro de las tareas seleccionadas, agrupados en la zona del informe. Las columnas pueden pertenecer a meses diferentes. No representan todos los eventos de la organización ni un backlog histórico.')
  table(['Mes', 'Tareas creadas', 'Cierres verificables'], report.monthlyCohorts.map(m => [m.month, m.created, m.closed]))

  heading('6 Tareas que requieren atención', true, true)
  paragraph('Primero vencidas por mayor retraso, luego activas sin responsable y próximos vencimientos. Se conserva el detalle completo en el anexo, sin omitir tareas por la búsqueda o paginación de pantalla.')
  const priorities = report.tasks.filter(t => t.status === 'DELAYED' || ((t.status === 'PENDING' || t.status === 'IN_PROGRESS') && (t.responsibleId === null || (t.dueDate !== null && Date.parse(t.dueDate) - Date.parse(report.generatedAt) <= 86400000))))
    .sort((a, b) => (b.overdueHours ?? -1) - (a.overdueHours ?? -1) || Number(a.responsibleId !== null) - Number(b.responsibleId !== null) || a.id.localeCompare(b.id))
  table(['Tarea e identificador', 'Equipo', 'Responsable', 'Estado', 'Vencimiento', 'Retraso', 'Antigüedad'], priorities.slice(0, 30).map(t => [
    `${t.title}\n${t.id}`, t.teamName || 'Sin equipo', t.responsibleName || t.responsibleEmail || 'Sin responsable', TASK_STATUS_LABELS[t.status], date(t.dueDate), hours(t.overdueHours), hours(t.ageHours)]),
    { columnStyles: { 0: { cellWidth: 71 } } })
  paragraph(`Esta priorización muestra ${Math.min(30, priorities.length)} de ${priorities.length} tareas que requieren atención. El anexo contiene las ${report.tasks.length} tareas del corte.`)

  heading('7 Metodología y límites', true)
  REPORT_METHODOLOGY.forEach((v, i) => paragraph(`${i + 1}. ${v}`))
  paragraph('Fuente: API autenticada de COMPIRA y PostgreSQL. Equipo, responsable, estado y eventos se consultan en una misma sentencia del reporte. El identificador vincula este PDF con el corte mostrado en pantalla, no es una firma digital ni un sello de auditoría inmutable.')
  paragraph('El PDF incorpora texto seleccionable, fuentes locales, título, idioma, marcadores y tablas con cabeceras repetidas. No se declara certificación PDF/UA, PDF/A o normativa sectorial. La vista HTML es la alternativa de consulta accesible.')

  heading('Anexo A Inventario completo de tareas', true, true)
  paragraph(`${report.tasks.length} tareas del corte autorizado. Sin descripciones ni contenido de observaciones para minimizar la exposición de información; se conserva la cantidad de observaciones y la última actividad.`)
  table(['Tarea e identificador', 'Equipo / responsable', 'Estado', 'Creación', 'Vencimiento', 'Cierre real', 'A tiempo', 'Retraso / duración cierre', 'Última actividad / observaciones'], report.tasks.map(t => [
    `${t.title}\n${t.id}`, `${t.teamName || 'Sin equipo'}\n${t.responsibleName || t.responsibleEmail || 'Sin responsable'}`, TASK_STATUS_LABELS[t.status],
    date(t.createdAt), date(t.dueDate), date(t.closedAt), t.closedOnTime === null ? 'N/D' : t.closedOnTime ? 'Sí' : 'No',
    `${hours(t.overdueHours)} / ${hours(t.closureHours)}`, `${date(t.lastActivityAt)}\n${t.observations} observaciones`,
  ]), { styles: { font: 'NotoSans', fontSize: 7.3, cellPadding: 1.8, lineColor: [217, 221, 225], lineWidth: 0.15 }, columnStyles: { 0: { cellWidth: 62 }, 1: { cellWidth: 38 } } })

  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFont('NotoSans', 'normal'); doc.setFontSize(7.5); doc.setTextColor(75, 85, 95)
    if (i > 1) { doc.text('COMPIRA | Informe gerencial de tareas', margin, 13); doc.text('Uso interno - Confidencial', width() - margin, 13, { align: 'right' }) }
    doc.setDrawColor(217, 221, 225); doc.line(margin, height() - 17, width() - margin, height() - 17)
    doc.text(`Corte ${report.reportId.slice(0, 8)} | ${date(report.generatedAt)}`, margin, height() - 11)
    doc.text(`Página ${i} de ${pages}`, width() - margin, height() - 11, { align: 'right' })
  }
  return doc
}
