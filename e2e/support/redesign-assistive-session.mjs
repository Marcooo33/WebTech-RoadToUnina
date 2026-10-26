/** Isolated, muted Orca/AT-SPI attempt against only our production test page.
 * No user profile, preferences or desktop accessibility bus is used.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { startProductionServer } from './redesign-production-server.mjs';
import { originalUser } from './redesign-phase-5.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.join(root, 'docs/redesign-evidence/phase-6');
const script = fileURLToPath(import.meta.url);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function inside() {
  const result = { method: 'Private DBus/AT-SPI bus, temporary XDG dirs, memory settings; muted Orca; full Chromium headless', status: 'IN_PROGRESS', interactiveScreenReaderPass: false };
  let browser, server, orca;
  try {
    const address = spawnSync('gdbus', ['call', '--session', '--dest', 'org.a11y.Bus', '--object-path', '/org/a11y/bus', '--method', 'org.a11y.Bus.GetAddress'], { encoding: 'utf8', timeout: 10000 });
    fs.writeFileSync(path.join(output, 'assistive-private-bus.txt'), address.stdout + address.stderr);
    const bus = address.stdout.match(/'([^']+)'/)?.[1];
    if (!bus || !bus.includes(process.env.XDG_RUNTIME_DIR)) {
      result.status = 'LIMIT'; result.reason = 'A private accessibility bus could not be verified; no Orca or browser attached to the user accessibility bus.'; return result;
    }
    process.env.AT_SPI_BUS_ADDRESS = bus;
    const help = spawnSync('/usr/bin/orca', ['--help'], { encoding: 'utf8', timeout: 10000 });
    fs.writeFileSync(path.join(output, 'orca-help.txt'), help.stdout + help.stderr);
    if (help.status !== 0) { result.status = 'LIMIT'; result.reason = 'Installed Orca failed its isolated startup/help prerequisite.'; result.exitCode = help.status; return result; }
    server = await startProductionServer(4501);
    const log = fs.openSync(path.join(output, 'orca-process.txt'), 'w');
    orca = spawn('/usr/bin/orca', ['--disable=speech', '--disable=braille', '--disable=main-window', `--debug-file=${path.join(output, 'orca-debug.txt')}`], { cwd: output, env: { ...process.env }, stdio: ['ignore', log, log] });
    fs.closeSync(log); result.orcaPid = orca.pid;
    await wait(700);
    if (orca.exitCode !== null) { result.status = 'LIMIT'; result.reason = 'Orca exited before the isolated test page was available.'; result.exitCode = orca.exitCode; return result; }
    browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--force-renderer-accessibility'], env: { ...process.env } });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== server.origin) return route.abort();
      if (!url.pathname.startsWith('/api/')) return route.continue();
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(url.pathname === '/api/auth/me' ? originalUser : { game: null, revision: null, expiresAt: null }) });
    });
    const page = await context.newPage();
    await page.goto(server.origin + '/profile'); await page.locator('#profile-username').waitFor();
    const cdp = await browser.newBrowserCDPSession();
    const processes = await cdp.send('SystemInfo.getProcessInfo');
    const ids = processes.processInfo.map(p => Number(p.id));
    fs.writeFileSync(path.join(output, 'assistive-owned-processes.json'), JSON.stringify(ids));
    const probe = `import gi,json,time\ngi.require_version('Atspi','2.0')\nfrom gi.repository import Atspi\nids=set(json.load(open(${JSON.stringify(path.join(output, 'assistive-owned-processes.json'))})))\napps=[]\ndesktop=Atspi.get_desktop(0)\nfor i in range(desktop.get_child_count()):\n app=desktop.get_child_at_index(i)\n if app.get_process_id() not in ids: continue\n nodes=[]; queue=[app]\n while queue and len(nodes)<500:\n  node=queue.pop(0)\n  try:\n   nodes.append({'name':node.get_name(),'role':node.get_role_name(),'focused':node.get_state_set().contains(Atspi.StateType.FOCUSED)})\n   queue.extend(node.get_child_at_index(j) for j in range(node.get_child_count()))\n  except Exception: pass\n apps.append({'pid':app.get_process_id(),'nodes':nodes})\nprint(json.dumps({'ownedApplications':apps}))\n`;
    fs.writeFileSync(path.join(output, 'assistive-atspi-probe.py'), probe);
    await page.locator('nav a').first().focus();
    await page.getByRole('button', { name: 'Change password', exact: true }).click();
    await page.locator('#current-password[aria-invalid="true"]').waitFor();
    await page.screenshot({ path: path.join(output, 'assistive-profile-error.png'), fullPage: true });
    await page.locator('.danger-zone button').click(); await page.locator('dialog[open]').waitFor();
    await page.screenshot({ path: path.join(output, 'assistive-profile-dialog.png') });
    await wait(1000);
    const probeResult = spawnSync('python3', [path.join(output, 'assistive-atspi-probe.py')], { encoding: 'utf8', timeout: 10000, env: { ...process.env } });
    fs.writeFileSync(path.join(output, 'assistive-atspi-tree.txt'), probeResult.stdout + probeResult.stderr);
    if (probeResult.status !== 0) { result.status = 'LIMIT'; result.reason = 'Isolated native AT-SPI probe could not inspect the owned headless Chromium process.'; result.exitCode = probeResult.status; return result; }
    const tree = JSON.parse(probeResult.stdout.trim().split('\n').at(-1));
    result.ownedApplications = tree.ownedApplications.length;
    const nodes = tree.ownedApplications.flatMap(application => application.nodes);
    const orcaLog = fs.existsSync(path.join(output, 'orca-debug.txt')) ? fs.readFileSync(path.join(output, 'orca-debug.txt'), 'utf8') : '';
    result.evidence = {
      orcaNativeLinkRole: orcaLog.includes("name='ROADTOUNINA' role='link'"),
      orcaErrorDescription: orcaLog.includes("description='Enter your current password.'"),
      nativeDialog: nodes.some(node => node.role === 'dialog' && node.name === 'Delete account permanently?'),
      nativeFocusedCancel: nodes.some(node => node.role === 'push button' && node.name === 'Cancel' && node.focused),
      orcaGeneratedDialogSpeech: orcaLog.includes("SPEECH OUTPUT: 'Delete account permanently? dialog'"),
      orcaGeneratedCancelSpeech: orcaLog.includes("SPEECH OUTPUT: 'Cancel push button.'"),
    };
    result.targetedNativeAssistiveCheck = Object.values(result.evidence).every(Boolean);
    result.status = result.targetedNativeAssistiveCheck ? 'PARTIAL_PASS' : 'LIMIT';
    result.reason = result.targetedNativeAssistiveCheck
      ? 'Actual muted Orca and native AT-SPI observed owned production page link, invalid-field description, dialog role and focused Cancel; dialog speech was generated in Orca debug output. No audible/manual reader usability certification.'
      : 'Isolated Orca/AT-SPI attempt did not establish all targeted native reader evidence; programmatic Chromium AX is separate and is not claimed as an Orca pass.';
    return result;
  } catch (error) { result.status = 'LIMIT'; result.reason = String(error.stack ?? error); return result; }
  finally {
    if (browser) await browser.close(); if (server) await server.close();
    if (orca && orca.exitCode === null) { orca.kill('SIGTERM'); await wait(300); if (orca.exitCode === null) orca.kill('SIGKILL'); }
    fs.writeFileSync(path.join(output, 'assistive-result.json'), JSON.stringify(result, null, 2) + '\n');
  }
}

if (process.argv.includes('--inside')) console.log(JSON.stringify(await inside(), null, 2));
else if (process.argv.includes('--run')) {
  fs.mkdirSync(output, { recursive: true });
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'roadtounina-atspi-'));
  for (const name of ['config', 'cache', 'runtime', 'data']) fs.mkdirSync(path.join(temp, name), { mode: 0o700 });
  const descriptor = fs.openSync(path.join(output, 'assistive-attempt.txt'), 'w');
  try {
    const exitCode = await new Promise(resolve => {
      const child = spawn('dbus-run-session', ['--', process.execPath, script, '--inside'], { cwd: root,
        env: { ...process.env, XDG_CONFIG_HOME: path.join(temp, 'config'), XDG_CACHE_HOME: path.join(temp, 'cache'), XDG_RUNTIME_DIR: path.join(temp, 'runtime'), XDG_DATA_HOME: path.join(temp, 'data'), GSETTINGS_BACKEND: 'memory', NO_AT_BRIDGE: '0', GIO_USE_VFS: 'local', PLAYWRIGHT_BROWSERS_PATH: path.dirname(path.dirname(path.dirname(chromium.executablePath()))) }, stdio: ['ignore', descriptor, descriptor] });
      child.on('exit', code => resolve(code));
    });
    console.log(`Isolated assistive attempt completed, child exit=${exitCode}; see assistive-result.json.`);
  } finally { fs.closeSync(descriptor); try { fs.rmSync(temp, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); } catch (error) { fs.writeFileSync(path.join(output, 'assistive-cleanup-limit.txt'), String(error)); } }
}
