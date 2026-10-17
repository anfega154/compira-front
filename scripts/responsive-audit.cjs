/* Run against Vite + postman/simulations/ui-audit.sim.yaml; no live accounts. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const output = process.env.QA_OUTPUT_DIR || '/tmp/compira-responsive-audit';
const origin = process.env.UI_URL || 'http://127.0.0.1:5173';
(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const results = [];
  const httpErrors = [];
  // Initialize Postman's local state store once before concurrent browser requests.
  const warmup = await fetch(process.env.MOCK_URL || 'http://127.0.0.1:4946/api/v1/tasks/indicators');
  assert(warmup.ok, 'Local API fixture failed to initialize');
  browser.on('context', context => context.on('page', page => page.on('response', response => {
    if (response.url().includes('/api/v1/') && response.status() >= 400) httpErrors.push(`${response.status()} ${response.url()}`);
  })));
  async function session(role) {
    const context = await browser.newContext();
    await context.addInitScript(role => {
      const user = { id: role === 'COLLABORATOR' ? 'user-1' : 'coordinator-1', email: 'fixture@example.test', cognitoSub: 'fixture', firstName: 'Ana', lastName: 'García', roles: [role], status: 'ACTIVE' };
      sessionStorage.setItem('compira_access_token', 'fixture-token');
      sessionStorage.setItem('compira_id_token', 'fixture-token');
      sessionStorage.setItem('compira_user', JSON.stringify(user));
      sessionStorage.setItem('compira_expires_at', String(Date.now() + 3600000));
    }, role);
    return context;
  }
  async function checkBounds(page, name) {
    const geometry = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    assert(geometry.scrollWidth <= geometry.width + 1, `${name}: horizontal page overflow ${JSON.stringify(geometry)}`);
    results.push({ name, ...geometry });
  }
  try {
    for (const width of [1440, 768, 390, 320]) {
      const context = await session('COORDINATOR');
      const page = await context.newPage();
      await page.setViewportSize({ width, height: width < 500 ? 740 : 900 });
      for (const [route, ready] of [['/tasks', 'Tareas del equipo'], ['/tasks/task-1', 'Informe mensual de operaciones'], ['/tasks/create', 'Crear tarea'], ['/teams', 'Equipos'], ['/reports', 'Reportes'], ['/dashboard', 'Panel de monitoreo']]) {
        await page.goto(origin + route);
        await page.getByRole('heading', { name: ready, exact: true }).waitFor();
        // Wait for the finite API calls; ignore the notification stream.
        await page.waitForFunction(() => !document.body.textContent.includes('Cargando equipos…') && !document.body.textContent.includes('Cargando tarea...'));
        if (route === '/reports') await page.getByRole('heading', { name: 'Productividad y cumplimiento', exact: true }).waitFor();
        if (route === '/dashboard') await page.waitForFunction(() => document.querySelectorAll('main .skeleton').length === 0);
        if (route === '/tasks/create') {
          await page.getByLabel('Equipo', { exact: true }).selectOption('team-1');
          await page.getByLabel('Responsable (opcional)').fill('Ana');
          await page.getByRole('listbox').getByRole('option', { name: /Ana García/ }).waitFor();
        }
        if (route === '/tasks') {
          await page.getByRole('link', { name: 'Informe mensual de operaciones', exact: true }).waitFor();
          for (const button of await page.locator('.task-actions button').all()) {
            const box = await button.boundingBox();
            assert(box && box.width > 0 && box.x >= 0 && box.x + box.width <= width + 1, `Task action inaccessible at ${width}`);
          }
          await page.getByRole('button', { name: 'Observación', exact: true }).click();
          await checkBounds(page, `task-modal-${width}`);
          const box = await page.getByRole('dialog').boundingBox();
          assert(box.x >= 0 && box.x + box.width <= width && box.y >= 0 && box.y + box.height <= (width < 500 ? 740 : 900));
          await page.screenshot({ path: `${output}/task-modal-${width}.png` });
          await page.keyboard.press('Escape');
          await page.getByRole('button', { name: 'Reasignar', exact: true }).click();
          await page.getByRole('dialog').getByRole('combobox').fill('Ana');
          await page.getByRole('listbox').getByRole('option', { name: /Ana García/ }).waitFor();
          await checkBounds(page, `assignment-modal-${width}`);
          await page.keyboard.press('Escape');
          await page.keyboard.press('Escape');
        }
        if (route === '/teams') {
          await page.getByLabel('Equipo', { exact: true }).selectOption('team-1');
          assert.equal(await page.getByRole('option', { name: /tarea.*sin equipo/i }).count(), 0);
        }
        await checkBounds(page, `${route}-${width}`);
        if (route === '/teams' || route === '/tasks') {
          await page.evaluate(() => scrollTo(0, 0));
          await page.screenshot({ path: `${output}/${route.slice(1)}-${width}.png`, fullPage: true });
        }
      }
      if (width <= 768) {
        await page.getByRole('button', { name: 'Abrir menú de navegación' }).click();
        await page.getByRole('link', { name: 'Equipos', exact: true }).click();
        await page.getByRole('heading', { name: 'Equipos', exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Abrir menú de navegación' }).getAttribute('aria-expanded'), 'false');
      }
      await page.getByLabel('Notificaciones', { exact: false }).first().click();
      await checkBounds(page, `notifications-${width}`);
      await context.close();
      const admin = await session('ADMINISTRATOR');
      const adminPage = await admin.newPage();
      await adminPage.setViewportSize({ width, height: 740 });
      for (const route of ['/users', '/users/register', '/organization/settings']) {
        await adminPage.goto(origin + route);
        await adminPage.locator('main h2').waitFor();
        if (route === '/users') {
          await adminPage.getByRole('button', { name: 'Editar', exact: true }).click();
          await adminPage.getByRole('dialog').waitFor();
        }
        if (route === '/organization/settings') await adminPage.getByLabel('Zona horaria', { exact: false }).waitFor();
        await checkBounds(adminPage, `${route}-${width}`);
      }
      await admin.close();
      const collaborator = await session('COLLABORATOR');
      const own = await collaborator.newPage();
      await own.setViewportSize({ width, height: 740 });
      await own.goto(origin + '/tasks/assigned');
      await own.getByRole('button', { name: 'Observacion', exact: true }).waitFor();
      await checkBounds(own, `assigned-${width}`);
      for (const button of await own.locator('.task-actions button').all()) {
        const box = await button.boundingBox();
        assert(box && box.x >= 0 && box.x + box.width <= width + 1, 'Collaborator action outside viewport');
      }
      await collaborator.close();
      const auth = await browser.newContext({ viewport: { width, height: 740 } });
      const login = await auth.newPage();
      await login.goto(origin + '/auth/login');
      await login.getByLabel('Correo electronico', { exact: true }).waitFor();
      await checkBounds(login, `login-${width}`);
      // Drive the real OTP component using React Router's history state, no account request.
      await login.evaluate(() => history.replaceState({ usr: { email: 'fixture@example.test', session: 'fixture', challenge: { challengeName: 'EMAIL_OTP', codeDeliveryDetails: { destination: 'f***@example.test' } } } }, '', '/auth/verify'));
      await login.reload();
      if (await login.locator('.code-input').count() === 6) {
        for (const digit of await login.locator('.code-input').all()) {
          const box = await digit.boundingBox();
          assert(box && box.x >= 0 && box.x + box.width <= width, 'OTP digit clipped');
        }
        await checkBounds(login, `otp-${width}`);
      } else throw new Error('OTP route did not render six digits');
      await login.goto(origin + '/auth/password-recovery');
      await login.getByLabel('Correo electronico', { exact: true }).waitFor();
      await checkBounds(login, `password-recovery-${width}`);
      await login.evaluate(() => history.replaceState({ usr: { email: 'fixture@example.test', session: 'fixture', challenge: { challengeName: 'NEW_PASSWORD_REQUIRED' } } }, '', '/auth/new-password'));
      await login.reload();
      await login.locator('#new-password').fill('Example@12345');
      await login.getByRole('tooltip', { name: 'Criterios de contrasena' }).waitFor();
      await checkBounds(login, `new-password-${width}`);
      await auth.close();
    }
    const context = await session('COORDINATOR');
    const page = await context.newPage();
    await page.goto(origin + '/tasks/task-1');
    await page.getByRole('button', { name: 'Agregar observación', exact: true }).click();
    const content = `Observación QA ${Date.now()}`;
    await page.getByLabel('Observación', { exact: true }).fill(content);
    await page.getByRole('button', { name: 'Guardar observación' }).click();
    await page.getByText(content, { exact: true }).first().waitFor();
    await page.reload();
    await page.getByText(content, { exact: true }).first().waitFor();
    await page.goto(origin + '/tasks');
    await page.getByRole('button', { name: 'Reasignar', exact: true }).click();
    const assignment = page.getByRole('dialog');
    await assignment.getByRole('combobox').fill('Luis');
    await assignment.getByRole('option', { name: /Luis Pérez/ }).click();
    const response = page.waitForResponse(response => response.url().endsWith('/tasks/task-1/reassign') && response.request().method() === 'POST');
    await assignment.getByRole('button', { name: 'Reasignar tarea', exact: true }).click();
    assert.equal((await (await response).json()).responsibleUserId, 'user-2');
    await page.getByText('Tarea reasignada.', { exact: true }).waitFor();
    results.push({ name: 'simulated-observation-persistence-and-collaborator-selection', passed: true });
    await context.close();
    assert.deepEqual(httpErrors, [], 'Unexpected API errors during UI audit');
    await fs.writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ passed: results.length, output }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
