const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const output = process.env.QA_OUTPUT_DIR || '/tmp/compira-notifications-polling-audit';
const successOrigin = process.env.UI_URL || 'http://127.0.0.1:5185';
const errorOrigin = process.env.ERROR_UI_URL || 'http://127.0.0.1:5186';
const slowOrigin = process.env.SLOW_UI_URL || 'http://127.0.0.1:5187';

(async () => {
  await fs.mkdir(output, { recursive: true });
  const warmup = await fetch(process.env.MOCK_URL || 'http://127.0.0.1:4947/api/v1/notifications');
  assert(warmup.ok, 'Simulation must be running');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  async function session(origin) {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      const user = { id: 'user-1', email: 'fixture@example.test', cognitoSub: 'fixture', firstName: 'Ana', lastName: 'García', roles: ['COLLABORATOR'], status: 'ACTIVE' };
      sessionStorage.setItem('compira_access_token', 'fixture-token');
      sessionStorage.setItem('compira_id_token', 'fixture-token');
      sessionStorage.setItem('compira_user', JSON.stringify(user));
      sessionStorage.setItem('compira_expires_at', String(Date.now() + 3600000));
    });
    const page = await context.newPage();
    const requests = [];
    const responses = [];
    const failures = [];
    page.on('request', request => {
      if (/\/v1\/notifications(?:\/stream)?$/.test(request.url())) requests.push({ url: request.url(), at: Date.now(), method: request.method() });
    });
    page.on('response', response => {
      if (response.request().method() === 'GET' && /\/v1\/notifications$/.test(response.url())) responses.push({ status: response.status(), at: Date.now() });
    });
    page.on('requestfailed', request => {
      if (/\/v1\/notifications$/.test(request.url())) failures.push({ at: Date.now(), error: request.failure()?.errorText });
    });
    await page.goto(origin + '/tasks/assigned');
    await page.locator('.notification-center summary').click();
    return { context, page, requests, responses, failures };
  }
  try {
    const results = await Promise.all([
      (async () => {
        const { context, page, requests, responses } = await session(successOrigin);
        await page.getByRole('status').filter({ hasText: 'Actualizadas cada 30 segundos' }).waitFor();
        await page.getByText('Se te asignó la tarea', { exact: true }).waitFor();
        await page.waitForTimeout(31_500);
        assert.equal(requests.length, 2, 'Exactly two snapshots after 31.5 seconds');
        assert(requests[1].at - requests[0].at >= 29_900, 'No polling before 30 seconds');
        assert(responses.every(response => response.status === 200));
        await page.getByRole('button', { name: 'Marcar todas como leídas' }).click();
        assert.equal(await page.locator('.notification-count').count(), 0);
        await page.waitForTimeout(31_000);
        assert.equal(requests.length, 3);
        assert.equal(await page.locator('.notification-count').count(), 0, 'Read status survives next JSON snapshot');
        assert(requests.every(request => !request.url.includes('/stream')));
        await page.screenshot({ path: `${output}/notifications-success.png` });
        await context.close();
        return { scenario: 'success', requests, responses, readStatePreserved: true };
      })(),
      (async () => {
        const { context, page, requests, responses } = await session(errorOrigin);
        await page.getByRole('status').filter({ hasText: 'Reintentando en 30 segundos' }).waitFor();
        await page.waitForTimeout(31_500);
        assert.equal(requests.length, 2, '503 retries are bounded at 30 seconds');
        assert(requests[1].at - requests[0].at >= 29_900);
        assert(responses.length === 2 && responses.every(response => response.status === 503));
        await page.screenshot({ path: `${output}/notifications-503.png` });
        await context.close();
        return { scenario: '503', requests, responses };
      })(),
      (async () => {
        const { context, page, requests, failures } = await session(slowOrigin);
        await page.getByRole('status').filter({ hasText: 'Reintentando en 30 segundos' }).waitFor({ timeout: 18_000 });
        assert.equal(requests.length, 1);
        assert.equal(failures.length, 1, 'Slow request is actually cancelled by the browser');
        assert(failures[0].at - requests[0].at >= 14_500);
        assert(failures[0].at - requests[0].at < 18_000);
        await page.waitForTimeout(31_500);
        assert.equal(requests.length, 2);
        assert(requests[1].at - requests[0].at >= 44_500, 'Next request starts 30 seconds after the timeout, without overlap');
        await page.screenshot({ path: `${output}/notifications-timeout.png` });
        await context.close();
        return { scenario: '20-second-latency', requests, failures };
      })(),
    ]);
    await fs.writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
    process.stdout.write(JSON.stringify({ passed: results.map(result => result.scenario), output }) + '\n');
  } finally {
    await browser.close();
  }
})().catch(error => { process.stderr.write(String(error.stack || error) + '\n'); process.exitCode = 1; });
