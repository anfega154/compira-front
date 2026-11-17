const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const origin = process.env.UI_URL || 'http://127.0.0.1:5188';
const output = process.env.QA_OUTPUT_DIR || '/tmp/compira-coordinator-workflows-audit';
(async () => {
  await fs.mkdir(output, { recursive: true });
  const warmup = await fetch(process.env.MOCK_URL || 'http://127.0.0.1:4951/api/v1/tasks/task-1');
  assert(warmup.ok);
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const requests = [];
  const failures = [];
  async function session(role) {
    const context = await browser.newContext();
    await context.addInitScript(role => {
      const collaborator = role === 'COLLABORATOR';
      const user = { id: collaborator ? 'user-1' : 'coordinator-1', email: collaborator ? 'member@example.test' : 'coordinator@example.test', firstName: collaborator ? 'Ana' : 'Carolina', lastName: collaborator ? 'García' : 'López', roles: [role], status: 'ACTIVE', cognitoSub: 'fixture' };
      sessionStorage.setItem('compira_user', JSON.stringify(user));
      sessionStorage.setItem('compira_access_token', collaborator ? 'fixture-collaborator-token' : 'fixture-coordinator-token');
      sessionStorage.setItem('compira_id_token', 'fixture');
      sessionStorage.setItem('compira_expires_at', String(Date.now() + 3600000));
    }, role);
    const page = await context.newPage();
    page.on('request', request => { if (request.url().includes('/api/v1/')) requests.push({ method: request.method(), url: request.url() }); });
    page.on('response', response => { if (response.url().includes('/api/v1/') && response.status() >= 400) failures.push({ status: response.status(), url: response.url() }); });
    return { context, page };
  }
  try {
    const worker = await session('COLLABORATOR');
    await worker.page.goto(origin + '/tasks/assigned');
    await worker.page.getByRole('button', { name: 'Completar', exact: true }).click();
    await worker.page.getByRole('button', { name: 'Reabrir', exact: true }).waitFor();
    await worker.context.close();

    const coordinator = await session('COORDINATOR');
    const page = coordinator.page;
    await page.goto(origin + '/tasks/task-1');
    await page.getByText('IN_PROGRESS → COMPLETED', { exact: true }).waitFor();
    assert(await page.getByText('Por: Ana García (member@example.test)', { exact: true }).count() >= 1);
    await page.getByText('Por: Sistema (automático)', { exact: true }).waitFor();
    await page.locator('.notification-center summary').click();
    await page.getByText('Próxima a vencer', { exact: true }).waitFor();
    await page.getByText('Tarea completada por el colaborador', { exact: true }).waitFor();
    await page.locator('.notification-center summary').click();
    await page.getByRole('button', { name: 'Agregar observación', exact: true }).click();
    await page.getByLabel('Observación', { exact: true }).fill('Revisión de entrega por coordinación');
    await page.getByRole('button', { name: 'Guardar observación', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('.observation-list').getByText('Por: Carolina López (coordinator@example.test)', { exact: true }).count(), 1);
    assert(await page.locator('.task-timeline').getByText('Por: Carolina López (coordinator@example.test)', { exact: true }).count() >= 2);
    await page.reload();
    await page.getByText('IN_PROGRESS → COMPLETED', { exact: true }).waitFor();
    await page.locator('.notification-center summary').click();
    await page.getByText('Nueva observación en la tarea', { exact: true }).waitFor();
    await page.getByText('Tarea completada por el colaborador', { exact: true }).waitFor();
    await page.screenshot({ path: `${output}/coordinator-desktop.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${output}/coordinator-mobile.png`, fullPage: true });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow with visible names/emails');
    await coordinator.context.close();

    const admin = await session('ADMINISTRATOR');
    await admin.page.goto(origin + '/users');
    await admin.page.getByText('coordinator@example.test', { exact: true }).waitFor();
    const row = admin.page.getByRole('row').filter({ hasText: 'coordinator@example.test' });
    assert.equal(await row.getByText('Operaciones, Ventas', { exact: true }).count(), 1);
    assert.equal(await row.getByText('Sin equipo', { exact: true }).count(), 0);
    await admin.page.screenshot({ path: `${output}/administrator-teams.png`, fullPage: true });
    await admin.context.close();
    assert.equal(failures.length, 0, JSON.stringify(failures));
    assert(requests.some(request => request.method === 'POST' && request.url.endsWith('/status')));
    assert(requests.some(request => request.method === 'POST' && request.url.endsWith('/observations')));
    assert(requests.every(request => !request.url.includes('/notifications/stream')));
    const result = { passed: ['completion-notice', 'due-soon-notice', 'observation-notice', 'activity-authors', 'automatic-actor', 'administrator-coordinator-teams', 'mobile-layout'], requests, failures, scope: 'Real frontend HTTP to local Postman fixtures; backend delivery/security and AWS are verified separately.' };
    await fs.writeFile(`${output}/results.json`, JSON.stringify(result, null, 2));
    process.stdout.write(JSON.stringify({ passed: result.passed, output }) + '\n');
  } finally { await browser.close(); }
})().catch(error => { process.stderr.write(String(error.stack || error) + '\n'); process.exitCode = 1; });
