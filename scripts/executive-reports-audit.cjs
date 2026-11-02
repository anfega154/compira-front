// UI integration against the versioned Postman stand-in; not proof of AWS auth.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const origin=process.env.UI_URL || 'http://127.0.0.1:5186';
const output=process.env.QA_OUTPUT_DIR || '/tmp/compira-executive-reports-audit';
(async()=>{
 await fs.mkdir(output,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const evidence=[];
 try {
  for(const role of ['ADMINISTRATOR','COORDINATOR']) {
   const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
   await context.addInitScript(role=>{
    sessionStorage.setItem('compira_user',JSON.stringify({id:'coordinator-1',email:'coordinator@example.test',firstName:'Carolina',lastName:'López',roles:[role],status:'ACTIVE',cognitoSub:'fixture'}));
    sessionStorage.setItem('compira_access_token',role==='COORDINATOR'?'fixture-coordinator-token':'fixture-administrator-token');
    sessionStorage.setItem('compira_expires_at',String(Date.now()+3600000));
   },role);
   const page=await context.newPage();const requests=[];const errors=[];
   page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
   await page.goto(origin+'/reports');
   await page.getByRole('heading',{name:'Reportes gerenciales',exact:true}).waitFor();
   await page.getByText(role==='COORDINATOR'?'Tus equipos coordinados actualmente':'Toda la organización',{exact:true}).waitFor();
   const exportButton=page.getByRole('button',{name:'Exportar PDF',exact:true});await exportButton.waitFor();
   await page.getByLabel('Buscar en el detalle').fill('Entrega vencida');
   await page.getByText('1 resultados de 3 tareas.',{exact:false}).waitFor();
   const generationCalls=requests.filter(u=>u.includes('/tasks/reports/executive')).length;
   const downloaded=page.waitForEvent('download');await exportButton.click();
   const file=await downloaded;assert.equal(await file.failure(),null);await file.saveAs(`${output}/${role}.pdf`);
   assert.equal(requests.filter(u=>u.includes('/tasks/reports/executive')).length,generationCalls,'PDF must reuse the snapshot');
   assert.equal(requests.filter(u=>u.includes('/v1/users')).length,0,'Reports must not call administrator directory');
   await page.getByLabel('Desde',{exact:true}).fill('2026-10-01');
   assert(await exportButton.isDisabled());await page.getByText('Hay filtros modificados.',{exact:false}).waitFor();
   await page.getByRole('button',{name:'Limpiar filtros',exact:true}).click();
   await page.getByLabel('Buscar en el detalle').fill('');
   for(const width of [1440,390,320]) {
    await page.setViewportSize({width,height:1000});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Horizontal page overflow ${role} ${width}`);
    await page.screenshot({path:`${output}/${role}-${width}.png`,fullPage:true});
   }
   await page.getByLabel('Desde',{exact:true}).fill('1900-01-01');
   await page.getByRole('button',{name:'Generar informe',exact:true}).click();
   await page.getByRole('alert').filter({hasText:'La consulta superó'}).waitFor();
   assert(await exportButton.isDisabled());assert.equal(await page.getByRole('heading',{name:'Control del corte',exact:true}).count(),0,'Failed generation cannot leave an old export');
   assert.deepEqual(errors,[]);evidence.push({role,viewports:[1440,390,320],pdf:file.suggestedFilename(),generationCalls,noAdminDirectory:true,expected503Handled:true,noPageErrors:true});
   await context.close();
  }
  await fs.writeFile(`${output}/result.json`,JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
