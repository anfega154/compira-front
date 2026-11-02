import { afterEach, describe, expect, it, vi } from 'vitest'
import { getExecutiveReport, isExecutiveReport, reportQuery } from '../reportApi'
import { EMPTY_FILTERS, hours, percent, reportDate } from '../reportTypes'
import { reportFixture } from './reportFixture'
import { persistSession } from '../../auth/authStorage'
import { module3Tokens, module3User } from '../../../test/module3TestData'

afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers()})
describe('executive reporting contract',()=>{
 it('serializes only filters, including the exclusive unassigned option',()=>{
  expect(reportQuery(EMPTY_FILTERS)).toBe('dateBasis=CREATED')
  const q=new URLSearchParams(reportQuery({...EMPTY_FILTERS,from:'2026-10-01',to:'2026-10-31',teamId:'team a',responsibleId:'UNASSIGNED',status:'CLOSED',dateBasis:'CLOSED'}))
  expect(q.get('unassigned')).toBe('true');expect(q.has('responsibleId')).toBe(false);expect(q.get('teamId')).toBe('team a');expect(q.get('status')).toBe('CLOSED')
  expect(new URLSearchParams(reportQuery({...EMPTY_FILTERS,responsibleId:'m1'})).get('responsibleId')).toBe('m1')
 })
 it('accepts a complete matching report and rejects malformed and truncated payloads',()=>{
  expect(isExecutiveReport(reportFixture())).toBe(true)
  for(const value of [null,[],{},reportFixture({version:'2'}),reportFixture({timeZone:'Not/AZone'}),reportFixture({generatedAt:'invalid'}),reportFixture({tasks:[]}),reportFixture({findings:[3 as unknown as string]}),reportFixture({summary:{...reportFixture().summary,total:Infinity}}),reportFixture({quality:{...reportFixture().quality,missingTeam:-1}}),reportFixture({distribution:[{status:'BAD' as 'PENDING',count:1}]}),reportFixture({teams:[{id:'a',name:'a',email:null,metrics:{} as never}]})]) expect(isExecutiveReport(value)).toBe(false)
 })
 it('rejects invalid dates, missing nullable fields and impossible percentages',()=>{
  const report=reportFixture()
  expect(isExecutiveReport({...report,tasks:[{...report.tasks[0],dueDate:'not a date'},...report.tasks.slice(1)]})).toBe(false)
  expect(isExecutiveReport({...report,tasks:[{...report.tasks[0],responsibleName:undefined},...report.tasks.slice(1)]})).toBe(false)
  expect(isExecutiveReport({...report,summary:{...report.summary,compliancePercentage:101}})).toBe(false)
 })
 it('fetches with authentication, no-store and cancels listeners',async()=>{
  persistSession(module3User('COORDINATOR'),module3Tokens);const fetch=vi.fn().mockResolvedValue(Response.json(reportFixture()));vi.stubGlobal('fetch',fetch)
  const result=await getExecutiveReport({...EMPTY_FILTERS},new AbortController().signal)
  expect(result.summary.total).toBe(3);expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/tasks/reports/executive?dateBasis=CREATED'),expect.objectContaining({cache:'no-store',method:'GET',signal:expect.any(AbortSignal)}))
 })
 it('does not export malformed responses and reports API validation failures',async()=>{
  persistSession(module3User('ADMINISTRATOR'),module3Tokens);vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json({tasks:[]})).mockResolvedValueOnce(Response.json({message:'Reduzca el periodo'},{status:400})))
  await expect(getExecutiveReport(EMPTY_FILTERS,new AbortController().signal)).rejects.toThrow('formato válido')
  await expect(getExecutiveReport(EMPTY_FILTERS,new AbortController().signal)).rejects.toThrow('Reduzca el periodo')
 })
 it('aborts before sending a cancelled request',async()=>{
  persistSession(module3User('ADMINISTRATOR'),module3Tokens);const c=new AbortController();c.abort();vi.stubGlobal('fetch',vi.fn().mockImplementation((_url,init)=>Promise.reject(init.signal.reason)))
  await expect(getExecutiveReport(EMPTY_FILTERS,c.signal)).rejects.toThrow()
 })
 it('bounds a stalled generation request',async()=>{
  persistSession(module3User('ADMINISTRATOR'),module3Tokens);vi.useFakeTimers();vi.stubGlobal('fetch',vi.fn().mockImplementation((_url,init)=>new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason)))))
  const pending=getExecutiveReport(EMPTY_FILTERS,new AbortController().signal);const assertion=expect(pending).rejects.toThrow('tiempo de espera')
  await vi.advanceTimersByTimeAsync(35_000);await assertion
 })
 it('formats missing values as not evaluable and uses the report zone',()=>{
  expect(percent(null)).toBe('N/D');expect(percent(50)).toBe('50%');expect(hours(null)).toBe('N/D');expect(hours(12.5)).toContain('12,5');expect(reportDate(null,'UTC')).toBe('N/D');expect(reportDate('2026-11-02T01:00:00Z','America/Bogota')).toContain('1')
 })
})
