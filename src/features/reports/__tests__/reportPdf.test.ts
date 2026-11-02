import { describe, expect, it, vi, afterEach } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { createExecutivePdf, loadReportFonts, pdfText, reportFilename } from '../reportPdf'
import { reportFixture, metrics } from './reportFixture'
const fonts={regular:readFileSync('src/features/reports/fonts/NotoSans-Regular.ttf').toString('base64'),bold:readFileSync('src/features/reports/fonts/NotoSans-Bold.ttf').toString('base64')}
afterEach(()=>vi.unstubAllGlobals())
describe('complete local management PDF',()=>{
 it('generates a real vector PDF with embedded Unicode fonts, metadata and full appendix',()=>{
  const report=reportFixture();const pdf=createExecutivePdf(report,fonts)
  const buffer=pdf.output('arraybuffer');expect(new TextDecoder().decode(buffer.slice(0,5))).toBe('%PDF-');expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(9)
  expect(pdf.getFontList().NotoSans).toEqual(expect.arrayContaining(['normal','bold']))
  expect(pdf.output()).toContain('Informe gerencial de tareas COMPIRA')
  if(process.env.REPORT_PDF_EVIDENCE) writeFileSync(process.env.REPORT_PDF_EVIDENCE,new Uint8Array(buffer))
 })
 it('handles no data, coordinator scope, explicit filters and missing identifiers without invented percentages',()=>{
  const report=reportFixture({scope:'COORDINATED_TEAMS',generatedBy:'',filters:{from:'2026-10-01',to:'2026-10-31',dateBasis:'CLOSED',teamId:'foreign-empty',responsibleId:'foreign-empty',unassigned:false,status:'CLOSED'},summary:{...metrics,total:0,active:0,closed:0,evaluableClosed:0,progressPercentage:null,compliancePercentage:null,averageClosureHours:null,medianClosureHours:null},tasks:[],teams:[],assignees:[],monthlyCohorts:[]})
  const pdf=createExecutivePdf(report,fonts);expect(pdf.output('arraybuffer').byteLength).toBeGreaterThan(1000)
  expect(createExecutivePdf({...report,filters:{...report.filters,unassigned:true}},fonts).getNumberOfPages()).toBeGreaterThan(8)
 })
 it('repeats headers across long data and does not truncate the appendix',()=>{
  const report=reportFixture();const items=Array.from({length:65},(_,i)=>({...report.tasks[i%3],id:`tarea-${i}`,title:`${i} Revisión crítica con título extenso y tildes ${'operación '.repeat(12)}`}))
  const pdf=createExecutivePdf({...report,tasks:items,summary:{...metrics,total:65}},fonts)
  expect(pdf.getNumberOfPages()).toBeGreaterThan(12)
 })
 it('exports the maximum accepted 5000 rows without truncating the appendix',()=>{
  const report=reportFixture();const items=Array.from({length:5000},(_,i)=>({...report.tasks[i%3],id:`limite-tarea-${i}`,title:`Tarea ${i} de validación del límite completo`}));
  const pdf=createExecutivePdf({...report,tasks:items,summary:{...metrics,total:5000}},fonts);
  expect(pdf.getNumberOfPages()).toBeGreaterThan(100);
  if(process.env.REPORT_PDF_STRESS) writeFileSync(process.env.REPORT_PDF_STRESS,new Uint8Array(pdf.output('arraybuffer')));
 },60_000)
 it('cleans control characters without interpreting markup and generates a safe filename',()=>{
  expect(pdfText('<script>áñ</script>\u0000\u0007')).toBe('<script>áñ</script>');expect(pdfText(null)).toBe('N/D')
  expect(reportFilename(reportFixture({reportId:'../bad/name<script>'}))).toMatch(/^COMPIRA-informe-gerencial-2026-11-01-[a-zA-Z0-9-]+\.pdf$/)
 })
 it('loads only packaged local fonts and fails cleanly when they are unavailable',async()=>{
  const fetch=vi.fn().mockResolvedValue({ok:true,arrayBuffer:async()=>new Uint8Array([65,66]).buffer});vi.stubGlobal('fetch',fetch)
  expect(await loadReportFonts(new AbortController().signal)).toEqual({regular:'QUI=',bold:'QUI='})
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('NotoSans-'),expect.objectContaining({credentials:'omit'}))
  fetch.mockResolvedValue({ok:false});await expect(loadReportFonts(new AbortController().signal)).rejects.toThrow('fuentes')
 })
})
