/** Final production rendering gate. PREPARED ONLY; execute after root's VIA.
 * backend/node_modules/.bin/tsx e2e/support/redesign-phase-6.mts --run
 * No production backend: a local static SPA server and complete API interception.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { chromium, firefox, webkit } from '@playwright/test';
import { startProductionServer } from './redesign-production-server.mjs';
import { completed, historyList, originalUser, gameId, target } from './redesign-phase-5.mjs';
import { normalizeArticle } from '../../backend/src/modules/wikipedia/article-parser.js';
import { createE2EWikipediaService } from '../../backend/src/testing/e2e-wikipedia.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.join(root, 'docs/redesign-evidence/phase-6');
const widths = [1440, 768, 390, 320];
const source = createE2EWikipediaService();
const measurements: any[] = [];
const apiRequests: any[] = [];
const failures: any[] = [];
const limits: any[] = [];
let origin = '';
const deferred = () => { let release!: () => void; const promise = new Promise<void>(resolve => release = resolve); return { promise, release }; };

async function article(pageId = 4101) {
  const identity = await source.getArticle(pageId);
  const linked = identity.links.map(link => link.title);
  const anchor = (title: string) => `<a href="/wiki/${encodeURIComponent(title)}">${title}</a>`;
  const intro = `<p><b>${identity.title}</b> è la pagina campione del grafo E2E. I collegamenti disponibili sono ${linked.map(anchor).join(', ')}.</p>`;
  const facts = `<table class="infobox sinottico"><caption>${identity.title}</caption><tr><th>Collegamento</th><td>${anchor(linked[0])}</td></tr><tr><td colspan="2"><h2 id="scheda-interna">Dettaglio della scheda</h2><p>Contenuto completo, consultabile anche dall'indice.</p></td></tr></table>`;
  const paragraphs = Array.from({ length: 18 }, (_, index) => `<p>La navigazione attraversa articoli e contesti enciclopedici. Il percorso registra soltanto le pagine visitate e non misura una distanza residua. Collegamento ${anchor(linked[index % linked.length])}.</p>`).join('');
  const table = '<table><caption>Tabella completa del campione</caption><thead><tr>' + Array.from({ length: 6 }, (_, i) => `<th>Colonna ${i + 1}</th>`).join('') + '</tr></thead><tbody>' + Array.from({ length: 4 }, (_, i) => '<tr>' + Array.from({ length: 6 }, (_, j) => `<td>Riga ${i + 1}, valore ${j + 1}: ${'Enciclopedia'.repeat(5)}</td>`).join('') + '</tr>').join('') + '</tbody></table>';
  const html = intro + facts + '<h2 id="lettura">Lettura enciclopedica</h2>' + paragraphs + '<h3 id="dati">Dati e collegamenti</h3>' + table + '<h4 id="formula">Formula testuale</h4><p>E = mc<sup>2</sup>, rappresentata nei tag ammessi dal parser.</p><pre>' + 'TokenIndivisibile'.repeat(35) + '</pre>';
  return { ...normalizeArticle(identity, html, linked), gameId };
}

async function playing(atStart = false) {
  const ref = await source.getStartingPage();
  const current = atStart ? ref : { pageId: 4101, title: 'Golfo di Napoli' };
  return { id: gameId, mode: 'CLICK', difficulty: 'EASY', status: 'IN_PROGRESS',
    startPageId: ref.pageId, startPageTitle: ref.title, currentPageId: current.pageId,
    currentPageTitle: current.title, clickCount: atStart ? 0 : 1, backtrackCount: 0,
    effectivePlayTimeMs: 18000, startedAt: '2026-10-25T12:00:00Z', completedAt: null,
    createdAt: '2026-10-25T12:00:00Z', path: atStart ? [ref] : [ref, current],
    moves: atStart ? [] : [{ sequence: 1, type: 'NAVIGATION', fromPageId: ref.pageId,
      fromPageTitle: ref.title, toPageId: current.pageId, toPageTitle: current.title,
      createdAt: '2026-10-25T12:00:05Z' }] };
}

async function install(context: any, overrides: any = {}) {
  const control: any = { authenticated: true, guest: false, user: { ...originalUser },
    game: await playing(), list: 'ready', guestStatus: 'none', createError: null,
    moveError: null, authError: null, gameError: null, gates: {}, ...overrides };
  context.on('page', page => page.on('pageerror', error => failures.push({ group: 'runtime', message: error.message })));
  await context.route('**/*', async (route: any) => {
    const request = route.request(), url = new URL(request.url()), method = request.method();
    if (url.protocol === 'chrome-extension:') return route.continue();
    if (url.origin !== origin) return route.abort();
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const data = request.postDataJSON();
    apiRequests.push({ path: url.pathname, method, fields: data && Object.keys(data) });
    const json = (body: any, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }).catch(() => {});
    const error = (code: string, message: string, status = 503) => json({ error: { code, message } }, status);
    const gate = control.gates[url.pathname]; if (gate) await gate.promise;
    if (url.pathname === '/api/auth/me' && method === 'GET') return control.authenticated ? json(control.user) : error('UNAUTHORIZED', 'Not authenticated.', 401);
    if (url.pathname === '/api/auth/login' || url.pathname === '/api/auth/register') {
      if (control.authError) return error('INVALID_CREDENTIALS', control.authError, 400);
      control.authenticated = true; return json(control.user);
    }
    if (url.pathname === '/api/auth/me' && method === 'PATCH') { control.user = { ...control.user, ...data }; return json(control.user); }
    if (url.pathname === '/api/guest-games' && method === 'GET') return json({ game: control.guestStatus === 'none' ? null : control.guestStatus === 'completed' ? completed() : control.game, revision: 3, expiresAt: '2026-10-27T12:00:00Z' });
    if (url.pathname === '/api/games' && method === 'GET') {
      if (control.list === 'error') return error('INTERNAL_ERROR', 'Your games could not be loaded.');
      const games = url.searchParams.get('status') === 'COMPLETED' ? [completed(), completed('TIME', false, '00000000-0000-4000-8000-000000000102')] : [control.game];
      return json({ items: control.list === 'empty' ? [] : control.list === 'limit' && url.searchParams.get('status') !== 'COMPLETED' ? Array.from({ length: 10 }, (_, i) => ({ ...control.game, id: `00000000-0000-4000-8000-${String(201 + i).padStart(12, '0')}` })) : games });
    }
    if (url.pathname === '/api/me/stats') return json({ completedGames: control.list === 'empty' ? 0 : 2, inProgressGames: control.list === 'empty' ? 0 : control.list === 'limit' ? 10 : 1, bestClick: control.list === 'empty' ? null : { ...completed(), gameId }, bestTime: control.list === 'empty' ? null : { ...completed('TIME'), gameId: '00000000-0000-4000-8000-000000000102' }, averageClicks: control.list === 'empty' ? null : 4, averageEffectiveTimeMs: control.list === 'empty' ? null : 190000 });
    if (['/api/games', '/api/guest-games'].includes(url.pathname) && method === 'POST') {
      if (control.createError) return error(control.createError, control.createError === 'GAME_LIMIT_REACHED' ? 'You already have 10 games in progress.' : 'Wikipedia is temporarily unavailable.', control.createError === 'GAME_LIMIT_REACHED' ? 409 : 503);
      control.game = { ...await playing(true), mode: data?.mode ?? 'CLICK', difficulty: data?.difficulty ?? 'EASY' };
      if (url.pathname.includes('guest')) control.guestStatus = 'playing';
      return url.pathname.includes('guest') ? json({ game: control.game, article: await article(control.game.currentPageId), revision: 3, expiresAt: '2026-10-27T12:00:00Z' }, 201) : json(control.game, 201);
    }
    if (url.pathname.endsWith('/pause')) return route.fulfill({ status: 204 });
    if (/^\/api\/(?:guest-games|games)\//.test(url.pathname)) {
      if (method === 'DELETE') return route.fulfill({ status: 204 });
      if (control.gameError) return error('WIKIPEDIA_UNAVAILABLE', control.gameError);
      if (url.pathname.endsWith('/moves')) {
        if (control.moveError) return error(control.moveError, control.moveError === 'WIKIPEDIA_UNAVAILABLE' ? 'Wikipedia is temporarily unavailable.' : 'An unexpected game error occurred.');
        const next = await source.resolveNavigation(control.game.currentPageId, data.toTitle);
        if (!next) return error('INVALID_MOVE', 'Invalid fixture link.', 400);
        const before = { pageId: control.game.currentPageId, title: control.game.currentPageTitle };
        control.game.path.push(next); control.game.clickCount++;
        control.game.moves.push({ sequence: control.game.moves.length + 1, type: 'NAVIGATION', fromPageId: before.pageId, fromPageTitle: before.title, toPageId: next.pageId, toPageTitle: next.title, createdAt: '2026-10-25T12:00:15Z' });
        control.game.currentPageId = next.pageId; control.game.currentPageTitle = next.title;
        if (next.pageId === target.pageId) { control.game.status = 'COMPLETED'; control.game.completedAt = '2026-10-25T12:03:10Z'; }
      }
      return json({ game: control.game, article: control.game.status === 'COMPLETED' ? null : await article(control.game.currentPageId), revision: 3, expiresAt: '2026-10-27T12:00:00Z' });
    }
    if (['/api/history/click', '/api/history/time'].includes(url.pathname)) return json(historyList(url));
    if (url.pathname.startsWith('/api/history/')) { const game = completed('CLICK', true); return json({ ...game, gameId: game.id, player: { id: control.user.id, username: control.user.username } }); }
    return error('PRESENTATION_BLOCKED', 'Unexpected API blocked by isolated production harness.');
  });
  return control;
}

async function snapshot(page: any, name: string, options: any = {}) {
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: options.fullPage ?? true });
  const result = await page.evaluate(() => {
    const active = document.activeElement as HTMLElement;
    const hud = document.querySelector('.hud') as HTMLElement;
    const animation = [...document.querySelectorAll('*')].filter(element => getComputedStyle(element).animationName !== 'none').map(element => ({ tag: element.tagName, animation: getComputedStyle(element).animationName }));
    return { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollX,
      documentLang: document.documentElement.lang, articleLang: document.querySelector('.wiki')?.getAttribute('lang'),
      mains: document.querySelectorAll('main').length, hud: hud?.getBoundingClientRect().toJSON(),
      focused: { tag: active.tagName, text: active.textContent?.trim().slice(0, 90), rect: active.getBoundingClientRect().toJSON(), outline: getComputedStyle(active).outlineWidth }, animation };
  });
  assert.equal(result.scrollWidth, result.width, `${name}: page overflow`);
  assert.equal(result.scrollX, 0, `${name}: horizontal scroll`);
  assert.equal(result.mains, 1, `${name}: duplicate main`);
  if (options.sticky) assert(result.hud && Math.abs(result.hud.top) < 1);
  if (options.reduced) assert.equal(result.animation.length, 0, `${name}: active animation under reduced motion`);
  measurements.push({ name, ...result });
}

async function axCheck(context: any, page: any, name: string) {
  const cdp = await context.newCDPSession(page);
  const tree = await cdp.send('Accessibility.getFullAXTree');
  const interactive = tree.nodes.filter((node: any) => !node.ignored && ['button', 'link', 'textbox', 'combobox'].includes(node.role?.value));
  const unnamed = interactive.filter((node: any) => !node.name?.value?.trim());
  assert.equal(unnamed.length, 0, `${name}: unnamed accessible control`);
  measurements.push({ name: `${name}-AX`, interactive: interactive.length, unnamed: unnamed.length, method: 'Chromium AX tree; not a screen reader interaction' });
  await cdp.detach();
}

async function pageCase(browser: any, width: number, name: string, url: string, selector: string, overrides: any = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const control = await install(context, overrides);
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  await page.goto(origin + url); await page.locator(selector).first().waitFor();
  return { context, control, page, name, width };
}

async function primaryMatrix(browser: any) {
  const cases = [
    ['home', '/', '#home-title', { authenticated: false }],
    ['login', '/login', 'form', { authenticated: false }],
    ['register', '/register', 'form', { authenticated: false }],
    ['dashboard', '/', '[data-testid="game-row"]', {}],
    ['new-game', '/new-game', 'fieldset', {}],
    ['playing', `/game/${gameId}`, '.wiki__body', {}],
    ['result', `/game/${gameId}`, '[data-testid="game-result"]', { game: completed() }],
    ['history', '/history', 'tbody tr', {}],
    ['detail', `/history/${gameId}`, '.route-summary', {}],
    ['profile', '/profile', '#profile-username', {}],
    ['not-found', '/missing-redesign-route', 'h1', { authenticated: false }],
  ];
  for (const width of widths) for (const [name, url, selector, overrides] of cases) {
    const t = await pageCase(browser, width, name as string, url as string, selector as string, overrides);
    try {
      await snapshot(t.page, `${name}-${width}`, { fullPage: name !== 'playing', reduced: true });
      await axCheck(t.context, t.page, `${name}-${width}`);
      if (name === 'playing') await gameStates(t);
      if (name === 'login' || name === 'register') {
        await t.page.locator('form button[type="submit"]').click();
        await t.page.locator('input[aria-invalid="true"]').first().waitFor();
        await snapshot(t.page, `${name}-invalid-${width}`, { reduced: true });
        t.control.authError = 'Unable to sign in with these details.';
        if (name === 'register') { await t.page.locator('#username').fill('navigatore_test'); await t.page.locator('#email').fill('navigatore.test@example.test'); }
        else await t.page.locator('#identifier').fill('navigatore_test');
        await t.page.locator('#password').fill('Synthetic-test-password');
        const endpoint = name === 'login' ? '/api/auth/login' : '/api/auth/register';
        t.control.gates[endpoint] = deferred(); await t.page.locator('form button[type="submit"]').click();
        await t.page.waitForFunction(() => (document.querySelector('form button[type="submit"]') as HTMLButtonElement).disabled);
        await snapshot(t.page, `${name}-busy-${width}`, { reduced: true });
        t.control.gates[endpoint].release(); delete t.control.gates[endpoint];
        await t.page.getByRole('alert').waitFor(); await snapshot(t.page, `${name}-error-${width}`);
      }
      if (name === 'dashboard') {
        for (const state of ['empty', 'error', 'limit']) {
          t.control.list = state; await t.page.reload();
          await t.page.locator(state === 'error' ? '[role="alert"]' : state === 'empty' ? '.empty-state' : '[data-testid="game-row"]').first().waitFor();
          await snapshot(t.page, `dashboard-${state}-${width}`);
        }
      }
      if (name === 'new-game') {
        await t.page.getByRole('radio', { name: /^TIME/ }).check();
        await t.page.getByRole('radio', { name: /^MEDIUM/ }).check();
        t.control.createError = 'GAME_LIMIT_REACHED';
        await t.page.getByRole('button', { name: 'Start game', exact: true }).click();
        await t.page.getByRole('alert').waitFor();
        assert.equal(await t.page.getByRole('alert').count(), 1);
        await snapshot(t.page, `new-game-limit-${width}`);
      }
    } finally { await t.context.close(); }
  }
}

async function gameStates(t: any) {
  const { page, width, control } = t;
  await page.evaluate(() => scrollTo({ top: 700, left: 0, behavior: 'instant' }));
  await snapshot(page, `playing-reading-${width}`, { fullPage: false, sticky: width < 1120 });
  assert.equal(await page.locator('.wiki').getAttribute('lang'), 'it');
  if (width < 1120) {
    await page.getByRole('button', { name: /^Path/ }).click(); await page.locator('dialog[open]').waitFor();
    await snapshot(page, `playing-path-${width}`, { fullPage: false });
    await page.keyboard.press('Escape'); await page.locator('dialog[open]').waitFor({ state: 'hidden' });
  }
  const compact = page.locator('.wiki__toc-compact>summary'); if (await compact.isVisible()) await compact.click();
  await page.locator('.wiki__toc-list a:visible').filter({ hasText: 'Dettaglio della scheda' }).click();
  await page.waitForFunction(() => (document.querySelector('.wiki__facts') as HTMLDetailsElement).open);
  await snapshot(page, `playing-infobox-toc-${width}`, { fullPage: false });
  for (const code of ['WIKIPEDIA_UNAVAILABLE', 'INTERNAL_ERROR']) {
    await page.reload(); await page.locator('.wiki__body').waitFor();
    const link = page.locator('.wiki__body a[data-page-title]:visible').first();
    await link.focus();
    if (width < 1120) await link.evaluate((element: HTMLElement) => {
      const bar = document.querySelector('.hud')!.getBoundingClientRect();
      scrollBy({ top: element.getBoundingClientRect().top - bar.bottom - 18, left: 0, behavior: 'instant' });
    });
    control.moveError = code;
    const endpoint = `/api/games/${gameId}/moves`;
    control.gates[endpoint] = deferred();
    await page.keyboard.press('Enter'); await page.locator('app-wikipedia-article[aria-busy="true"]').waitFor();
    await snapshot(page, `playing-busy-${code}-${width}`, { fullPage: false, reduced: true });
    control.gates[endpoint].release(); delete control.gates[endpoint];
    await page.locator('.hud__feedback [role="alert"],.hud__feedback [role="status"]').waitFor();
    await page.waitForTimeout(80);
    const visible = await page.evaluate(() => {
      const feedback = document.querySelector('.hud__feedback [role="alert"],.hud__feedback [role="status"]')!;
      const message = feedback.getBoundingClientRect(), bar = document.querySelector('.hud')!.getBoundingClientRect(), active = document.activeElement!.getBoundingClientRect();
      return { message: message.toJSON(), bar: bar.toJSON(), active: active.toJSON(), notices: document.querySelectorAll('.hud__feedback [role="alert"],.hud__feedback [role="status"]').length };
    });
    assert.equal(visible.notices, 1); assert(visible.message.top >= 0 && visible.message.bottom <= 900);
    if (width < 1120) assert(visible.active.top >= visible.bar.bottom + 7);
    measurements.push({ name: `error-focus-${code}-${width}`, ...visible });
    await snapshot(page, `playing-error-${code}-${width}`, { fullPage: false });
  }
  if (width === 320) {
    control.moveError = null; await page.setViewportSize({ width: 320, height: 740 }); await page.reload(); await page.locator('.wiki__body').waitFor();
    await page.evaluate(() => scrollTo({ top: 0, left: 0, behavior: 'instant' })); await snapshot(page, 'playing-start-320x740', { fullPage: false });
    await page.evaluate(() => scrollTo({ top: 700, left: 0, behavior: 'instant' })); await snapshot(page, 'playing-reading-320x740', { fullPage: false, sticky: true });
    await page.getByRole('button', { name: /^Path/ }).click(); await snapshot(page, 'playing-path-320x740', { fullPage: false }); await page.keyboard.press('Escape');
    const endpoint = `/api/games/${gameId}/moves`; control.gates[endpoint] = deferred();
    await page.locator('a[data-page-title]:visible').first().click(); await page.locator('app-wikipedia-article[aria-busy="true"]').waitFor();
    await page.evaluate(() => scrollTo({ top: 700, left: 0, behavior: 'instant' }));
    await snapshot(page, 'playing-busy-320x740', { fullPage: false, sticky: true }); control.gates[endpoint].release();
  }
}

async function breakpointsAndResize(browser: any) {
  const bands: [string, number[]][] = [['home', [349, 350, 351, 599, 600, 601, 799, 800, 801]], ['playing', [679, 680, 681, 1119, 1120, 1121]], ['navigation', [999, 1000, 1001]]];
  for (const [kind, band] of bands) for (const width of band) {
    const game = kind === 'playing';
    const t = await pageCase(browser, width, kind, game ? `/game/${gameId}` : '/', game ? '.wiki__body' : kind === 'home' ? '#home-title' : '[data-testid="game-row"]', { authenticated: kind !== 'home' });
    try { await snapshot(t.page, `breakpoint-${kind}-${width}`, { fullPage: !game }); }
    finally { await t.context.close(); }
  }
  const t = await pageCase(browser, 390, 'resize', `/game/${gameId}`, '.wiki__body');
  try {
    await t.page.getByRole('button', { name: /^Path/ }).click(); await t.page.locator('dialog[open]').waitFor();
    await t.page.setViewportSize({ width: 1440, height: 900 }); await t.page.waitForTimeout(100);
    if (await t.page.locator('dialog[open]').count()) await t.page.keyboard.press('Escape');
    await t.page.waitForTimeout(100);
    const focus = await t.page.evaluate(() => ({ tag: document.activeElement!.tagName, rect: document.activeElement!.getBoundingClientRect().toJSON() }));
    assert(focus.rect.width > 0 && focus.rect.height > 0); assert.notEqual(focus.tag, 'BODY');
    await snapshot(t.page, 'path-after-resize-to-desktop', { fullPage: false });
    await t.page.setViewportSize({ width: 390, height: 900 }); await t.page.evaluate(() => scrollTo({ top: 0, left: 0, behavior: 'instant' }));
    const toggle = t.page.locator('.nav__toggle'); await toggle.click();
    await t.page.setViewportSize({ width: 1440, height: 900 }); await t.page.waitForTimeout(60);
    await snapshot(t.page, 'menu-resize-desktop', { fullPage: false });
    await t.page.keyboard.press('Escape');
    await t.page.waitForFunction(() => document.querySelector('.nav__toggle')?.getAttribute('aria-expanded') === 'false');
    const menuFocus = await t.page.evaluate(() => { const element = document.activeElement!; const rect = element.getBoundingClientRect(); return { tag: element.tagName, visible: element !== document.body && rect.width > 0 && rect.height > 0 }; });
    assert(menuFocus.visible); measurements.push({ name: 'menu-desktop-Escape', ...menuFocus });
    await t.page.setViewportSize({ width: 390, height: 900 }); await t.page.waitForTimeout(60);
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    await snapshot(t.page, 'menu-resize-mobile', { fullPage: false });
    await t.page.goto(origin + '/profile'); await t.page.locator('.danger-zone button').waitFor();
    await toggle.click(); await t.page.setViewportSize({ width: 1440, height: 900 }); await t.page.waitForTimeout(70);
    await t.page.locator('.danger-zone button').click(); await t.page.locator('dialog[open]').waitFor();
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
    await t.page.keyboard.press('Escape'); await t.page.locator('dialog[open]').waitFor({ state: 'hidden' });
    await t.page.waitForFunction(() => document.querySelector('.nav__toggle')?.getAttribute('aria-expanded') === 'false');
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    await snapshot(t.page, 'profile-modal-resize-first-Escape', { fullPage: false });
    await t.page.setViewportSize({ width: 390, height: 900 }); await t.page.goto(origin + `/game/${gameId}`); await t.page.locator('.wiki__body').waitFor();
    await t.page.evaluate(() => scrollTo({ top: 0, left: 0, behavior: 'instant' }));
    await toggle.click(); await t.page.setViewportSize({ width: 1040, height: 900 }); await t.page.waitForTimeout(70);
    await t.page.getByRole('button', { name: /^Path/ }).click(); await t.page.locator('dialog[open]').waitFor();
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
    await t.page.keyboard.press('Escape'); await t.page.locator('dialog[open]').waitFor({ state: 'hidden' });
    await t.page.waitForFunction(() => document.querySelector('.nav__toggle')?.getAttribute('aria-expanded') === 'false');
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(await t.page.getByRole('button', { name: /^Path/ }).evaluate((e: HTMLElement) => e === document.activeElement), true);
    await snapshot(t.page, 'path-modal-1040-first-Escape', { fullPage: false });
    for (const width of [768, 390, 320]) {
      await t.page.setViewportSize({ width, height: 900 }); await t.page.goto(origin + `/history/${gameId}`);
      await t.page.locator('.moves-section summary').click();
      const cells = await t.page.locator('.moves tbody th[scope="row"]').evaluateAll((elements: HTMLElement[]) => elements.filter(e => Number(e.textContent) >= 10 && Number(e.textContent) <= 31).map(e => { const range = document.createRange(); range.selectNodeContents(e); return { number: Number(e.textContent), lines: new Set([...range.getClientRects()].filter(r => r.width > 0 && r.height > 0).map(r => Math.round(r.top * 100) / 100)).size }; }));
      assert.equal(cells.length, 22); assert(cells.every((cell: any) => cell.lines === 1));
      measurements.push({ name: 'move-indices-single-line', width, cells });
      await t.page.locator('.moves tbody th[scope="row"]').nth(9).scrollIntoViewIfNeeded();
      await snapshot(t.page, `move-indices-10-31-${width}`, { fullPage: false });
    }
  } finally { await t.context.close(); }
}

async function transitions(browser: any) {
  for (const width of widths) {
    const t = await pageCase(browser, width, 'transition', '/', '#home-title', { authenticated: false });
    try {
      const toggle = t.page.getByRole('button', { name: 'Toggle navigation menu' }); if (await toggle.isVisible()) await toggle.click();
      await t.page.locator('nav').getByRole('link', { name: 'Log in', exact: true }).click(); await t.page.locator('#identifier').waitFor();
      await t.page.locator('#identifier').fill(originalUser.username); await t.page.locator('#password').fill('Synthetic-test-password');
      await t.page.getByRole('button', { name: 'Log in', exact: true }).click(); await t.page.getByTestId('game-row').first().waitFor();
      await t.page.getByRole('link', { name: 'New game', exact: true }).click(); await t.page.locator('fieldset').first().waitFor();
      await t.page.getByRole('button', { name: 'Start game', exact: true }).click(); await t.page.locator('.wiki__body').waitFor();
      await snapshot(t.page, `transition-login-create-${width}`, { fullPage: false });
      await t.page.getByRole('link', { name: 'Leave game', exact: true }).click(); await t.page.getByTestId('game-row').first().waitFor();
      await snapshot(t.page, `transition-leave-dashboard-${width}`);
    } finally { await t.context.close(); }
  }
}

async function zoom200() {
  // Actual browser zoom via Chrome extension API; never substitute DPR/pinch/CSS zoom.
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'roadtounina-zoom-'));
  const extension = path.join(temp, 'extension'); fs.mkdirSync(extension);
  fs.writeFileSync(path.join(extension, 'manifest.json'), JSON.stringify({ manifest_version: 3, name: 'Isolated local zoom verification', version: '1.0', permissions: ['tabs'], background: { service_worker: 'worker.js' } }));
  fs.writeFileSync(path.join(extension, 'worker.js'), 'chrome.runtime.onInstalled.addListener(() => {});');
  let context: any;
  try {
    context = await chromium.launchPersistentContext(path.join(temp, 'profile'), { channel: 'chromium', headless: true, viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
    const control = await install(context);
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', { timeout: 12000 });
    const page = context.pages()[0] ?? await context.newPage();
    for (const [name, url, selector, auth] of [['home', '/', '#home-title', false], ['login', '/login', 'form', false], ['playing', `/game/${gameId}`, '.wiki__body', true], ['history', '/history', 'tbody tr', true], ['profile', '/profile', '#profile-username', true]]) {
      control.authenticated = auth; await page.goto(origin + url); await page.locator(selector as string).first().waitFor();
      await worker.evaluate(async (base: string) => { const tabs = await chrome.tabs.query({}); const tab = tabs.find((t: any) => t.url?.startsWith(base + '/')); if (!tab?.id) throw new Error('Local zoom tab missing'); await chrome.tabs.setZoom(tab.id, 1); }, origin);
      await page.waitForTimeout(80); const before = await page.evaluate(() => ({ innerWidth, dpr: devicePixelRatio }));
      const zoom = await worker.evaluate(async (base: string) => { const tabs = await chrome.tabs.query({}); const tab = tabs.find((t: any) => t.url?.startsWith(base + '/')); if (!tab?.id) throw new Error('Local zoom tab missing'); await chrome.tabs.setZoom(tab.id, 2); return chrome.tabs.getZoom(tab.id); }, origin);
      await page.waitForTimeout(120); const after = await page.evaluate(() => ({ innerWidth, dpr: devicePixelRatio, visualScale: visualViewport?.scale }));
      assert.equal(zoom, 2); assert(Math.abs(after.innerWidth - before.innerWidth / 2) <= 2, 'Browser zoom did not reflow CSS viewport to half width');
      measurements.push({ name: `zoom-${name}`, method: 'chrome.tabs.setZoom=2/getZoom=2; layout viewport reflow checked', before, after });
      await snapshot(page, `zoom200-${name}`, { fullPage: false, reduced: true });
      const png = fs.readFileSync(path.join(output, `zoom200-${name}.png`));
      measurements.push({ name: `zoom200-${name}-capture`, method: 'Real viewport capture; fullPage disabled to avoid browser zoom clipping', pngWidth: png.readUInt32BE(16), pngHeight: png.readUInt32BE(20) });
      assert.equal(png.readUInt32BE(16), 1440, 'Zoom viewport screenshot unexpectedly clipped');
    }
  } finally { if (context) await context.close(); fs.rmSync(temp, { recursive: true, force: true }); }
}

async function optionalEngines() {
  for (const [name, engine] of [['firefox', firefox], ['webkit', webkit]] as const) {
    const executable = engine.executablePath();
    if (!fs.existsSync(executable)) { limits.push({ name, status: 'NOT_INSTALLED', downloaded: false }); continue; }
    const browser = await engine.launch();
    try { for (const width of [1440, 390]) { const t = await pageCase(browser, width, name, `/game/${gameId}`, '.wiki__body'); try { await snapshot(t.page, `${name}-playing-${width}`, { fullPage: false }); } finally { await t.context.close(); } } }
    finally { await browser.close(); }
  }
}

async function subprocessPhase5() {
  const file = path.join(output, 'phase5-production.txt');
  const descriptor = fs.openSync(file, 'w');
  const code = await new Promise<number>(resolve => { const process = spawn('node', [path.join(root, 'e2e/support/redesign-phase-5.mjs'), '--run'], { cwd: root, env: { ...globalThis.process.env, REDESIGN_BASE_URL: origin, REDESIGN_OUTPUT_DIR: path.join(output, 'phase5-production') }, stdio: ['ignore', descriptor, descriptor] }); process.on('exit', result => resolve(result ?? 1)); });
  fs.closeSync(descriptor); assert.equal(code, 0, 'Phase5 production replay failed');
}

async function run() {
  fs.mkdirSync(output, { recursive: true });
  const server = await startProductionServer(4500); origin = server.origin;
  fs.writeFileSync(path.join(output, 'production-source.json'), JSON.stringify({ origin, directory: server.directory, generatedAt: new Date().toISOString(), backendProxy: false }, null, 2));
  const browser = await chromium.launch();
  try {
    for (const [name, action] of [['primary', () => primaryMatrix(browser)], ['breakpoints-resize', () => breakpointsAndResize(browser)], ['transitions', () => transitions(browser)], ['zoom200', zoom200], ['other-installed-engines', optionalEngines], ['phase5-production', subprocessPhase5]] as const) {
      if (process.argv.includes('--resize-only') && name !== 'breakpoints-resize') continue;
      try { await action(); } catch (error: any) { failures.push({ group: name, message: error.stack ?? String(error) }); }
    }
  } finally {
    await browser.close(); await server.close();
    const suffix = process.argv.includes('--resize-only') ? '-resize-final' : '';
    fs.writeFileSync(path.join(output, `checks${suffix}.json`), JSON.stringify(measurements, null, 2) + '\n');
    fs.writeFileSync(path.join(output, `requests${suffix}.json`), JSON.stringify(apiRequests, null, 2) + '\n');
    fs.writeFileSync(path.join(output, `failures${suffix}.json`), JSON.stringify(failures, null, 2) + '\n');
    fs.writeFileSync(path.join(output, `limits${suffix}.json`), JSON.stringify(limits, null, 2) + '\n');
  }
  console.log(JSON.stringify({ records: measurements.length, failures, limits }, null, 2));
  if (failures.length) process.exitCode = 1;
}

if (process.argv.includes('--run')) await run();
