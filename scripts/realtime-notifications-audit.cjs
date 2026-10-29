// Real Chrome + real HTTP Postman fixtures + real local WebSocket.
// The audit emits invalidations; it does not claim provider generation/security.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { WebSocketServer, WebSocket } = require('ws');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const origin = process.env.UI_URL || 'http://127.0.0.1:5189';
const api = process.env.MOCK_URL || 'http://127.0.0.1:4954/api/v1';
const output = process.env.QA_OUTPUT_DIR || '/tmp/compira-ws-browser-audit';
(async () => {
  await fs.mkdir(output, { recursive: true });
  const server = new WebSocketServer({ host: '127.0.0.1', port: 4953 });
  await new Promise(resolve => server.once('listening', resolve));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const checks = [], requests = [], failures = [];
  let connections = 0;
  server.on('connection', socket => {
    connections++;
    socket.on('message', message => { if (JSON.parse(message).action === 'ping') socket.send('{"type":"pong"}'); });
  });
  function emit() { for (const client of server.clients) if (client.readyState === WebSocket.OPEN) client.send('{"type":"notifications.changed","notificationId":"fixture"}'); }
  try {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      sessionStorage.setItem('compira_user', JSON.stringify({ id:'coordinator-1',email:'coordinator@example.test',firstName:'Carolina',lastName:'López',roles:['COORDINATOR'],status:'ACTIVE',cognitoSub:'fixture' }));
      sessionStorage.setItem('compira_access_token','fixture-coordinator-token');
      sessionStorage.setItem('compira_id_token','fixture');
      sessionStorage.setItem('compira_expires_at',String(Date.now()+3600000));
    });
    const page = await context.newPage();
    page.on('request', r => { if (r.url().includes('/api/v1/notifications')) requests.push({ method:r.method(),path:new URL(r.url()).pathname,at:Date.now() }); });
    page.on('response', r => { if (r.url().includes('/api/v1/') && r.status() >= 400) failures.push({ path:new URL(r.url()).pathname,status:r.status() }); });
    await page.goto(origin + '/tasks/task-1');
    await page.locator('.notification-center summary').click();
    await page.getByText('Notificaciones en tiempo real',{exact:true}).waitFor();
    checks.push('socket-connected');
    // The provider state changes without any navigation/reload in this browser.
    const completed = await fetch(api+'/tasks/task-1/status',{ method:'POST',headers:{'content-type':'application/json',authorization:'Bearer fixture-collaborator-token'},body:JSON.stringify({status:'COMPLETED'}) });
    assert.equal(completed.status,200);
    const begin = Date.now(); emit();
    await page.getByText('Tarea completada por el colaborador',{exact:true}).waitFor();
    const latency = Date.now()-begin; assert(latency < 5000);
    checks.push('invalidation-refresh-under-five-seconds');
    await page.waitForTimeout(500);
    const count = requests.filter(r=>r.method==='GET' && r.path.endsWith('/notifications')).length;
    await page.waitForTimeout(31_000);
    assert.equal(requests.filter(r=>r.method==='GET' && r.path.endsWith('/notifications')).length,count);
    checks.push('no-thirty-second-poll-while-connected');
    // Make an offline change and close the socket; open recovery must fetch it.
    for (const client of server.clients) client.close();
    const added = await fetch(api+'/tasks/task-1/observations',{ method:'POST',headers:{'content-type':'application/json',authorization:'Bearer fixture-coordinator-token'},body:JSON.stringify({content:'Aviso durante reconexión'}) });
    assert.equal(added.status,201);
    await page.getByText('Nueva observación en la tarea',{exact:true}).waitFor();
    await page.getByText('Notificaciones en tiempo real',{exact:true}).waitFor();
    assert(connections >= 2); checks.push('reconnect-fetches-missed-notice');
    await page.screenshot({path:output+'/realtime-desktop.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:output+'/realtime-mobile.png',fullPage:true}); checks.push('mobile-no-overflow');
    await context.close();
    assert.equal(failures.length,0);
    const result = { passed:checks,notificationLatencyMs:latency,connections,requests,failures,scope:'Real production browser against Postman HTTP + audit-driven WebSocket; no AWS/auth/provider-generation claim.' };
    await fs.writeFile(output+'/results.json',JSON.stringify(result,null,2));
    console.log(JSON.stringify(result,null,2));
  } finally { await browser.close(); for(const c of server.clients)c.terminate(); await new Promise(resolve=>server.close(resolve)); }
})().catch(error=>{console.error(error);process.exitCode=1});
