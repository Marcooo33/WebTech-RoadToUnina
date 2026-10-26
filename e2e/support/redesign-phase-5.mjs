/**
 * Presentation-only redesign phase 5 harness. Run ONLY after implementation handoff:
 *   node e2e/support/redesign-phase-5.mjs --run
 * Optional REDESIGN_BASE_URL (localhost only), REDESIGN_OUTPUT_DIR.
 * Every API is fulfilled in-browser; this script never contacts a backend/DB.
 * Data is generated from existing DTOs and the deterministic E2E article graph.
 * It is a declared replacement for the lost /tmp audit sample, not pixel-identical.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const origin = new URL(process.env.REDESIGN_BASE_URL ?? 'http://127.0.0.1:4400').origin;
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const output = path.resolve(process.env.REDESIGN_OUTPUT_DIR ?? path.join(root, 'docs/redesign-evidence/phase-5'));
const widths = [1440, 768, 390, 320];
const gameId = '00000000-0000-4000-8000-000000000101';
const userId = '00000000-0000-4000-8000-000000000001';
const target = { pageId: 2930935, title: 'Università degli Studi di Napoli Federico II' };
const pages = {
  4100: 'Partenope (sirena)', 4101: 'Golfo di Napoli', 4102: 'Storia di Napoli',
  4104: 'Napoli', 4105: 'Campania', [target.pageId]: target.title,
};
const originalUser = {
  id: userId, username: 'navigatore_e2e', email: 'navigatore.partenope@example.test',
  createdAt: '2026-10-25T12:00:00.000Z',
};
const records = [];
const requests = [];
const failures = [];
const deferred = () => {
  let release;
  const promise = new Promise(resolve => { release = resolve; });
  return { promise, release };
};

function completed(mode = 'CLICK', long = false, id = gameId, difficulty = 'EASY') {
  const route = [{ pageId: 4100, title: pages[4100] }];
  const moves = [];
  let clicks = 0;
  const move = (pageId, type = 'NAVIGATION') => {
    const from = route.at(-1);
    const to = { pageId, title: pages[pageId] };
    moves.push({ sequence: moves.length + 1, type, fromPageId: from.pageId,
      fromPageTitle: from.title, toPageId: to.pageId, toPageTitle: to.title,
      createdAt: new Date(Date.parse('2026-10-25T12:00:00Z') + (moves.length + 1) * 5000).toISOString() });
    if (type === 'BACKTRACK') route.pop();
    else { route.push(to); clicks++; }
  };
  move(4101);
  if (difficulty !== 'HARD') { move(4102); move(4101, 'BACKTRACK'); }
  if (long) for (let i = 0; i < 7; i++) for (const id of [4102, 4104, 4105, 4101]) move(id);
  move(4104); move(target.pageId);
  return { id, mode, difficulty, status: 'COMPLETED',
    startPageId: 4100, startPageTitle: pages[4100], currentPageId: target.pageId,
    currentPageTitle: target.title, clickCount: clicks, backtrackCount: difficulty === 'HARD' ? 0 : 1,
    effectivePlayTimeMs: 190000, startedAt: '2026-10-25T12:00:00.000Z',
    completedAt: '2026-10-25T12:03:10.000Z', createdAt: '2026-10-25T12:00:00.000Z',
    path: route, moves };
}

function historyList(url, empty = false) {
  const mode = url.pathname.endsWith('/time') ? 'TIME' : 'CLICK';
  const difficulty = url.searchParams.get('difficulty') ?? 'EASY';
  const page = Number(url.searchParams.get('page') ?? 1);
  const limit = Number(url.searchParams.get('limit') ?? 20);
  const total = empty ? 0 : 41;
  const start = (page - 1) * limit;
  const items = Array.from({ length: Math.max(0, Math.min(limit, total - start)) }, (_, offset) => {
    const i = start + offset;
    return { rank: i + 1,
      gameId: `00000000-0000-4000-8000-${String(101 + i).padStart(12, '0')}`,
      username: i === 0 ? originalUser.username : i === 1 ? 'esploratore_con_nome_lungo' : `partenope_${String(i).padStart(2, '0')}`,
      clickCount: (difficulty === 'HARD' ? 3 : 4) + i, effectivePlayTimeMs: 190000 + i * 1000,
      completedAt: new Date(Date.parse('2026-10-25T12:03:10Z') + i * 60000).toISOString() };
  });
  return { mode, difficulty, items, page, limit, total, totalPages: Math.ceil(total / limit) };
}

async function session(browser, width, overrides = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const control = { authenticated: true, guest: false, mode: 'CLICK', difficulty: 'EASY', long: false,
    history: 'ready', detail: 'ready', deletedPlayer: false, gates: {},
    profile: 'success', password: 'success', deletion: 'error', user: { ...originalUser },
    mutationCount: 0, ...overrides };
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) return route.abort();
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const method = request.method();
    const data = request.postDataJSON();
    requests.push({ width, method, path: url.pathname,
      data: url.pathname.endsWith('/password') ? { fields: Object.keys(data ?? {}) } : data });
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }).catch(() => {});
    const error = (code, message, status = 503) => json({ error: { code, message } }, status);
    if (url.pathname === '/api/auth/me' && method === 'GET') return control.authenticated
      ? json(control.user) : error('UNAUTHORIZED', 'Not authenticated.', 401);
    if (url.pathname === '/api/guest-games') return json({
      game: control.guest ? completed(control.mode, control.long) : null,
      revision: control.guest ? 3 : null, expiresAt: control.guest ? '2026-10-27T12:00:00Z' : null,
    });
    if (/^\/api\/(guest-games|games)\//.test(url.pathname)) return json({
      game: completed(control.mode, control.long), article: null,
      revision: 3, expiresAt: '2026-10-27T12:00:00Z',
    });
    if (['/api/history/click', '/api/history/time'].includes(url.pathname)) {
      if (control.gates.history) await control.gates.history.promise;
      if (control.history === 'error') return error('INTERNAL_ERROR', 'History is temporarily unavailable.');
      control.mode = url.pathname.endsWith('/time') ? 'TIME' : 'CLICK';
      control.difficulty = url.searchParams.get('difficulty') ?? 'EASY';
      return json(historyList(url, control.history === 'empty'));
    }
    if (url.pathname.startsWith('/api/history/')) {
      if (control.gates.detail) await control.gates.detail.promise;
      if (control.detail === 'error') return error('GAME_NOT_FOUND', 'This completed game is no longer available.', 404);
      const game = completed(control.mode, control.long, url.pathname.split('/').at(-1), control.difficulty);
      return json({ gameId: game.id, mode: game.mode, difficulty: game.difficulty,
        clickCount: game.clickCount, backtrackCount: game.backtrackCount,
        effectivePlayTimeMs: game.effectivePlayTimeMs, startPageId: game.startPageId,
        startPageTitle: game.startPageTitle, completedAt: game.completedAt,
        path: game.path, moves: game.moves,
        player: control.deletedPlayer ? null : { id: control.user.id, username: control.user.username } });
    }
    if (url.pathname === '/api/auth/me' && method === 'PATCH') {
      control.mutationCount++;
      if (control.gates.profile) await control.gates.profile.promise;
      if (control.profile === 'error') return error('PROFILE_CONFLICT', 'These account details are already in use.', 409);
      control.user = { ...control.user, ...data };
      return json(control.user);
    }
    if (url.pathname === '/api/auth/me/password' && method === 'PATCH') {
      control.mutationCount++;
      assert.deepEqual(Object.keys(data).sort(), ['currentPassword', 'newPassword']);
      if (control.gates.password) await control.gates.password.promise;
      if (control.password === 'error') return error('INVALID_CURRENT_PASSWORD', 'The current password is incorrect.', 400);
      return route.fulfill({ status: 204 });
    }
    if (url.pathname === '/api/auth/me' && method === 'DELETE') {
      control.mutationCount++;
      if (control.gates.deletion) await control.gates.deletion.promise;
      return error('INTERNAL_ERROR', 'Your account could not be deleted right now.');
    }
    return error('PRESENTATION_REQUEST_BLOCKED', 'Unexpected API request blocked by the isolated presentation harness.');
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  return { context, page, control, width };
}

function luminance(color) {
  return color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255)
    .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
    .reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
}
function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }

async function snapshot(t, name, { fullPage = true } = {}) {
  await t.page.screenshot({ path: path.join(output, `${name}-${t.width}.png`), fullPage });
  const measurement = await t.page.evaluate(() => ({ width: innerWidth, height: innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    focus: { tag: document.activeElement?.tagName, id: document.activeElement?.id },
    alerts: document.querySelectorAll('[role="alert"]').length,
    statuses: document.querySelectorAll('[role="status"]').length,
    text: document.body.innerText,
  }));
  assert.equal(measurement.scrollWidth, measurement.width, `${name}: horizontal page overflow`);
  records.push({ name, ...measurement });
}

async function semantics(t, scope = 'body') {
  const data = await t.page.locator(scope).evaluate(element => {
    const background = node => {
      for (let e = node; e; e = e.parentElement) {
        const color = getComputedStyle(e).backgroundColor;
        if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') return color;
      }
      return 'rgb(255, 255, 255)';
    };
    return {
      targets: [...element.querySelectorAll('.btn, .tab, .chip, .view a, summary')]
        .filter(e => e.getBoundingClientRect().height > 0 && !e.closest('dialog:not([open]),details:not([open]) :not(summary)'))
        .map(e => ({ label: e.textContent.trim(), width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height })),
      messages: [...element.querySelectorAll('.status, app-error-banner [role="alert"]')]
        .filter(e => e.getBoundingClientRect().height > 0)
        .map(e => ({ text: e.textContent.trim(), color: getComputedStyle(e).color, background: background(e) })),
    };
  });
  for (const target of data.targets) assert(target.width >= 44 && target.height >= 44, `Small target: ${target.label}`);
  for (const message of data.messages) {
    message.contrast = contrast(message.color, message.background);
    assert(message.contrast >= 4.5, `Low text contrast: ${message.text}`);
  }
  records.push({ name: 'semantics', width: t.width, scope, ...data });
}

async function errorAssociations(t) {
  const errors = await t.page.locator('input[aria-invalid="true"]').evaluateAll(elements => elements.map(e => ({
    id: e.id, descriptions: (e.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean)
      .map(id => ({ id, exists: !!document.getElementById(id) })),
  })));
  assert(errors.length > 0);
  assert(errors.every(e => e.descriptions.length > 0 && e.descriptions.every(d => d.exists)));
  records.push({ name: 'error-associations', width: t.width, errors });
}

async function resultCases(browser, width) {
  for (const guest of [false, true]) for (const mode of (guest ? ['CLICK'] : ['CLICK', 'TIME'])) {
    const t = await session(browser, width, { guest, authenticated: !guest, mode });
    try {
      await t.page.goto(`${origin}/${guest ? 'guest/game' : 'game'}/${gameId}`);
      await t.page.getByTestId('game-result').waitFor();
      assert.equal(await t.page.locator('.result__primary dt').innerText(), mode === 'CLICK' ? 'Navigation clicks' : 'Effective time');
      if (guest) {
        assert.equal(await t.page.getByRole('link', { name: 'Register to save result' }).getAttribute('href'), '/register');
        assert.equal(await t.page.getByRole('link', { name: 'Log in to save result' }).getAttribute('href'), '/login');
      } else assert.equal(await t.page.getByRole('link', { name: /View public game/ }).getAttribute('href'), `/history/${gameId}`);
      assert.equal(await t.page.evaluate(() => !!(document.querySelector('.result .actions').compareDocumentPosition(document.querySelector('.result__path')) & Node.DOCUMENT_POSITION_FOLLOWING)), true);
      await snapshot(t, `result-${guest ? 'guest' : 'auth'}-${mode.toLowerCase()}`);
      await semantics(t, '.result');
      t.control.long = true;
      await t.page.reload(); await t.page.getByTestId('game-result').waitFor();
      assert.equal(await t.page.locator('.result .path__item').count(), completed(mode, true).path.length);
      await snapshot(t, `result-${guest ? 'guest' : 'auth'}-${mode.toLowerCase()}-long-path`);
    } finally { await t.context.close(); }
  }
}

async function historyCases(browser, width) {
  const t = await session(browser, width);
  try {
    await t.page.goto(`${origin}/history`); await t.page.locator('tbody tr').first().waitFor();
    await snapshot(t, 'history'); await semantics(t, '.history');
    const click = t.page.getByRole('tab', { name: 'CLICK', exact: true });
    const time = t.page.getByRole('tab', { name: 'TIME', exact: true });
    await click.focus(); await t.page.keyboard.press('ArrowRight');
    await t.page.waitForURL(url => url.searchParams.get('mode') === 'TIME');
    await t.page.waitForFunction(() => document.querySelector('#history-mode-TIME')?.getAttribute('aria-selected') === 'true');
    assert.equal(await time.getAttribute('aria-selected'), 'true');
    assert.equal(await time.evaluate(e => e === document.activeElement), true);
    await t.page.keyboard.press('Home'); await t.page.waitForURL(url => url.searchParams.get('mode') === 'CLICK');
    await t.page.waitForFunction(() => document.querySelector('#history-mode-CLICK')?.getAttribute('aria-selected') === 'true');
    await t.page.keyboard.press('End'); await t.page.waitForURL(url => url.searchParams.get('mode') === 'TIME');
    await t.page.waitForFunction(() => document.querySelector('#history-mode-TIME')?.getAttribute('aria-selected') === 'true');
    await t.page.keyboard.press('ArrowLeft');
    await t.page.waitForFunction(() => document.querySelector('#history-mode-CLICK')?.getAttribute('aria-selected') === 'true');
    await t.page.keyboard.press('ArrowRight');
    await t.page.waitForFunction(() => document.querySelector('#history-mode-TIME')?.getAttribute('aria-selected') === 'true');
    assert.equal(await t.page.locator('[role="tab"][tabindex="0"]').count(), 1);
    const panelId = await time.getAttribute('aria-controls');
    assert.equal(await t.page.locator(`#${panelId}`).getAttribute('role'), 'tabpanel');
    assert.equal(await t.page.locator(`#${panelId}`).getAttribute('aria-labelledby'), await time.getAttribute('id'));
    records.push({ name: 'history-keyboard-panel', width, panelId, mode: 'TIME', roving: true });
    await t.page.getByRole('button', { name: 'HARD', exact: true }).click();
    await t.page.waitForURL(url => url.searchParams.get('difficulty') === 'HARD');
    await t.page.locator('tbody tr').first().waitFor(); await snapshot(t, 'history-time-hard');
    await t.page.getByRole('button', { name: 'Next', exact: true }).click();
    await t.page.waitForURL(url => url.searchParams.get('page') === '2');
    await t.page.waitForFunction(() => document.querySelector('tbody tr:first-child .rank')?.textContent.trim() === '21');
    await snapshot(t, 'history-page-2');
    await t.page.getByRole('button', { name: 'Previous', exact: true }).click();
    await t.page.waitForURL(url => !url.searchParams.get('page'));
    await t.page.waitForFunction(() => document.querySelector('tbody tr:first-child .rank')?.textContent.trim() === '1');
    t.control.history = 'empty'; await t.page.reload(); await t.page.locator('.empty-state').waitFor();
    await snapshot(t, 'history-empty');
    t.control.history = 'error'; await t.page.reload(); await t.page.getByRole('alert').waitFor();
    assert.equal(await t.page.locator('tbody tr').count(), 0); await snapshot(t, 'history-error');
    t.control.history = 'ready'; t.control.gates.history = deferred();
    await t.page.reload(); await t.page.locator('app-loading-spinner [role="status"]').waitFor();
    await snapshot(t, 'history-loading'); t.control.gates.history.release(); delete t.control.gates.history;
    await t.page.locator('tbody tr').first().waitFor();
    for (const long of [false, true]) {
      t.control.long = long;
      await t.page.goto(`${origin}/history/${gameId}`); await t.page.locator('.route-summary').waitFor();
      await snapshot(t, long ? 'detail-long-path' : 'detail');
      assert.equal(await t.page.locator('.path__item').count(), completed(t.control.mode, long, gameId, t.control.difficulty).path.length);
      await t.page.locator('.moves-section summary').click();
      assert.equal(await t.page.locator('.moves tbody tr').count(), completed(t.control.mode, long, gameId, t.control.difficulty).moves.length);
      const region = t.page.locator('.moves-wrap');
      const scroll = await region.evaluate(e => ({ width: e.clientWidth, content: e.scrollWidth, tabindex: e.tabIndex }));
      if (scroll.content > scroll.width + 1) {
        await region.focus(); await t.page.keyboard.press('ArrowRight');
        await t.page.waitForFunction(() => document.querySelector('.moves-wrap').scrollLeft > 0);
      }
      records.push({ name: 'moves-local-scroll', width, long, clientWidth: scroll.width, content: scroll.content, tabindex: scroll.tabindex });
      await snapshot(t, long ? 'detail-long-moves' : 'detail-moves');
    }
    t.control.deletedPlayer = true; await t.page.reload(); await t.page.getByRole('heading', { name: 'Deleted user' }).waitFor();
    await snapshot(t, 'detail-deleted-player');
    t.control.detail = 'error'; await t.page.reload(); await t.page.getByRole('alert').waitFor();
    await snapshot(t, 'detail-error');
  } finally { await t.context.close(); }
}

async function profileCases(browser, width) {
  const t = await session(browser, width);
  try {
    await t.page.goto(`${origin}/profile`); await t.page.locator('#profile-username').waitFor();
    await snapshot(t, 'profile'); await semantics(t, '.profile');
    assert.equal(await t.page.locator('#profile-username-hint').isVisible(), true);
    assert.equal(await t.page.locator('#new-password-hint').isVisible(), true);
    assert((await t.page.locator('#profile-username').getAttribute('aria-describedby')).includes('profile-username-hint'));
    assert((await t.page.locator('#new-password').getAttribute('aria-describedby')).includes('new-password-hint'));
    await t.page.locator('#profile-username').fill('a');
    await t.page.getByRole('button', { name: 'Change username', exact: true }).click();
    await t.page.waitForFunction(() => document.activeElement.id === 'profile-username');
    await t.page.locator('#profile-email').fill('invalid-address');
    await t.page.getByRole('button', { name: 'Change email', exact: true }).click();
    await t.page.waitForFunction(() => document.activeElement.id === 'profile-email');
    await t.page.getByRole('button', { name: 'Change password', exact: true }).click();
    assert.equal(t.control.mutationCount, 0);
    await t.page.waitForFunction(() => document.activeElement.id === 'current-password');
    await errorAssociations(t); await snapshot(t, 'profile-validation');
    await t.page.locator('#current-password').fill('Old-test-password-1');
    await t.page.locator('#new-password').fill('New-test-password-2');
    await t.page.locator('#confirm-password').fill('Different-test-password');
    await t.page.getByRole('button', { name: 'Change password', exact: true }).click();
    assert.equal(t.control.mutationCount, 0);
    assert.equal(await t.page.locator('#confirm-password').getAttribute('aria-invalid'), 'true');
    await t.page.waitForFunction(() => document.activeElement.id === 'confirm-password');
    await errorAssociations(t); await snapshot(t, 'profile-password-mismatch');
    await t.page.locator('#confirm-password').fill('New-test-password-2');
    t.control.gates.password = deferred();
    await t.page.getByRole('button', { name: 'Change password', exact: true }).click();
    await t.page.waitForFunction(() => document.querySelector('.password-form button[type="submit"]').disabled);
    await snapshot(t, 'profile-password-busy');
    t.control.gates.password.release(); delete t.control.gates.password;
    await t.page.locator('.password-form [role="status"]').waitFor();
    await snapshot(t, 'profile-password-success'); await semantics(t, '.password-form');
    for (const id of ['current-password', 'new-password', 'confirm-password']) assert.equal(await t.page.locator(`#${id}`).inputValue(), '');
    t.control.password = 'error';
    await t.page.locator('#current-password').fill('Wrong-test-password');
    await t.page.locator('#new-password').fill('New-test-password-3');
    await t.page.locator('#confirm-password').fill('New-test-password-3');
    await t.page.getByRole('button', { name: 'Change password', exact: true }).click();
    await t.page.locator('.password-form [role="alert"]').waitFor(); await snapshot(t, 'profile-password-api-error');
    await t.page.locator('#profile-username').fill('esploratore_napoli');
    t.control.gates.profile = deferred();
    await t.page.getByRole('button', { name: 'Change username', exact: true }).click();
    await t.page.getByRole('button', { name: 'Saving…', exact: true }).waitFor();
    await snapshot(t, 'profile-account-busy'); t.control.gates.profile.release(); delete t.control.gates.profile;
    await t.page.getByText('Username updated.', { exact: true }).waitFor();
    await snapshot(t, 'profile-account-success');
    t.control.profile = 'error'; await t.page.locator('#profile-email').fill('altro.esploratore@example.test');
    await t.page.getByRole('button', { name: 'Change email', exact: true }).click();
    await t.page.getByText('These account details are already in use.', { exact: true }).waitFor();
    await snapshot(t, 'profile-account-api-error');
    const open = t.page.locator('.danger-zone button');
    const before = t.control.mutationCount;
    await open.click(); await t.page.locator('dialog[open]').waitFor();
    const cancel = t.page.locator('dialog[open]').getByRole('button', { name: 'Cancel', exact: true });
    assert.equal(await cancel.evaluate(e => e === document.activeElement), true);
    await t.page.keyboard.press('Shift+Tab');
    assert.equal(await t.page.evaluate(() => document.activeElement === document.body || !!document.activeElement.closest('dialog')), true);
    await t.page.keyboard.press('Escape'); await t.page.locator('dialog[open]').waitFor({ state: 'hidden' });
    assert.equal(await open.evaluate(e => e === document.activeElement), true);
    assert.equal(t.control.mutationCount, before);
    await open.click(); await cancel.click(); assert.equal(t.control.mutationCount, before);
    await open.click(); await t.page.locator('dialog[open]').waitFor(); await snapshot(t, 'profile-delete-dialog', { fullPage: false });
    t.control.gates.deletion = deferred();
    await t.page.locator('dialog[open]').getByRole('button', { name: 'Delete account', exact: true }).click();
    await t.page.getByRole('button', { name: 'Deleting…', exact: true }).waitFor();
    await t.page.keyboard.press('Escape'); assert.equal(await t.page.locator('dialog[open]').count(), 1);
    await snapshot(t, 'profile-delete-busy', { fullPage: false });
    t.control.gates.deletion.release(); delete t.control.gates.deletion;
    await t.page.locator('dialog[open] [role="alert"]').waitFor();
    await snapshot(t, 'profile-delete-error', { fullPage: false }); await semantics(t, 'dialog[open]');
    await t.page.locator('dialog[open]').getByRole('button', { name: 'Cancel', exact: true }).click();
    t.control.user = { ...originalUser, username: 'esploratore_con_nome_molto_lungo'.slice(0, 30), email: 'esploratore.partenope.con.indirizzo.lungo@example.test' };
    await t.page.reload(); await t.page.locator('#profile-username').waitFor(); await snapshot(t, 'profile-long-identity');
  } finally { await t.context.close(); }
}

async function run() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of widths) for (const [name, action] of [['result', resultCases], ['history', historyCases], ['profile', profileCases]]) {
      try { await action(browser, width); }
      catch (error) { failures.push({ group: name, width, message: error.stack ?? String(error) }); }
    }
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify(records, null, 2) + '\n');
    fs.writeFileSync(path.join(output, 'requests.json'), JSON.stringify(requests, null, 2) + '\n');
    fs.writeFileSync(path.join(output, 'failures.json'), JSON.stringify(failures, null, 2) + '\n');
  }
  console.log(JSON.stringify({ records: records.length, screenshots: records.filter(r => r.text !== undefined).length, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
}


async function keyboardOnly() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const checks = [];
  try {
    for (const width of widths) {
      const t = await session(browser, width);
      try {
        await t.page.goto(`${origin}/history?mode=CLICK&difficulty=EASY`);
        await t.page.locator('tbody tr').first().waitFor();
        await t.page.getByRole('tab', { name: 'CLICK', exact: true }).focus();
        const steps = [];
        for (const [key, mode] of [['ArrowRight', 'TIME'], ['ArrowLeft', 'CLICK'], ['ArrowLeft', 'TIME'], ['Home', 'CLICK'], ['End', 'TIME']]) {
          await t.page.keyboard.press(key);
          await t.page.waitForFunction(expected => document.querySelector(`#history-mode-${expected}`)?.getAttribute('aria-selected') === 'true', mode);
          await t.page.waitForURL(url => url.searchParams.get('mode') === mode);
          const current = t.page.getByRole('tab', { name: mode, exact: true });
          assert.equal(await current.evaluate(e => e === document.activeElement), true);
          assert.equal(await t.page.locator('[role="tab"][tabindex="0"]').count(), 1);
          const tabId = await current.getAttribute('id');
          const panelId = await current.getAttribute('aria-controls');
          assert.equal(await t.page.locator(`#${panelId}`).getAttribute('aria-labelledby'), tabId);
          steps.push({ key, mode, tabId, panelId, url: t.page.url() });
        }
        await snapshot(t, 'history-keyboard-focus');
        checks.push({ width, steps, pass: true });
      } finally { await t.context.close(); }
    }
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(output, 'keyboard.json'), JSON.stringify(checks, null, 2) + '\n');
  console.log(JSON.stringify({ pass: true, keyboardWidths: checks.length, keys: ['ArrowRight', 'ArrowLeft', 'Home', 'End'] }));
}

export { completed, historyList, originalUser, gameId, target };
const isEntryPoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntryPoint && process.argv.includes('--run')) await run();
else if (isEntryPoint && process.argv.includes('--keyboard-only')) await keyboardOnly();
