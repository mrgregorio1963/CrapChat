/**
 * Headless two-tab smoke test with fake media devices.
 */
import { chromium } from 'playwright';

const BASE = process.env.CRAPCHAT_URL || 'http://127.0.0.1:3000';

async function waitSplashGone(page) {
  await page.waitForSelector('#splash.hide, body:not(:has(#splash))', { timeout: 30000 }).catch(() => {});
  // splash may still be present with .hide
  await page.waitForFunction(() => {
    const s = document.getElementById('splash');
    return !s || s.classList.contains('hide') || s.style.display === 'none';
  }, { timeout: 30000 });
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });

  const context = await browser.newContext({
    permissions: ['camera', 'microphone'],
    viewport: { width: 390, height: 844 },
  });

  // Grant fake media
  await context.grantPermissions(['camera', 'microphone'], { origin: BASE });

  const a = await context.newPage();
  const b = await context.newPage();

  const errors = [];
  for (const p of [a, b]) {
    p.on('pageerror', (e) => errors.push(String(e)));
    p.on('console', (msg) => {
      if (msg.type() === 'error') errors.push('console: ' + msg.text());
    });
  }

  console.log('Opening tab A…');
  await a.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitSplashGone(a);
  await a.fill('#display-name', 'AliceThrone');
  await a.click('#btn-create');
  await a.waitForSelector('#view-throne.active', { timeout: 15000 });

  // Wait for preview (camera fake)
  await a.waitForTimeout(2000);
  const previewOk = await a.evaluate(() => {
    const v = document.getElementById('local-video-raw');
    return !!(v && v.srcObject && v.srcObject.getVideoTracks().length);
  });
  console.log('Tab A preview stream:', previewOk);

  // Toggle fart silencer
  await a.click('#btn-fart-silencer');
  await a.waitForTimeout(500);
  const silencerOn = await a.getAttribute('#btn-fart-silencer', 'aria-pressed');
  console.log('Fart silencer pressed:', silencerOn);

  // Pick a background
  await a.click('.bg-thumb[data-id="tropical-beach"]');
  await a.waitForTimeout(300);

  await a.click('#btn-enter-call');
  await a.waitForSelector('#view-call.active', { timeout: 15000 });
  const roomBadge = await a.textContent('#room-badge');
  const roomId = (roomBadge || '').replace(/[^\w-]/g, '').toLowerCase() || null;
  const urlRoom = a.url().match(/\/room\/([^/?#]+)/)?.[1];
  const code = urlRoom || roomId;
  console.log('Room code:', code);
  if (!code) throw new Error('No room code');

  console.log('Opening tab B as joiner…');
  await b.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitSplashGone(b);
  await b.fill('#display-name', 'BobStall');
  await b.fill('#room-code', code);
  await b.click('#btn-join');
  await b.waitForSelector('#view-throne.active', { timeout: 15000 });
  await b.waitForTimeout(1500);
  await b.click('#btn-enter-call');
  await b.waitForSelector('#view-call.active', { timeout: 15000 });

  // Wait for peer connection / remote video
  let connected = false;
  for (let i = 0; i < 40; i++) {
    const countA = await a.getAttribute('#remote-grid', 'data-count');
    const countB = await b.getAttribute('#remote-grid', 'data-count');
    if (Number(countA) >= 1 && Number(countB) >= 1) {
      connected = true;
      break;
    }
    await a.waitForTimeout(500);
  }
  console.log('Peers connected:', connected);

  // Reactions
  await a.click('#btn-react');
  await a.click('#react-sheet button[data-emoji="💩"]');
  await a.waitForTimeout(500);

  // Flush on A
  await a.click('#btn-flush');
  await a.waitForTimeout(800);
  const muted = await a.getAttribute('#btn-mute', 'aria-pressed');
  console.log('After flush mic muted:', muted);

  // Sit timer visible
  const timer = await a.textContent('#sit-timer');
  console.log('Sit timer:', timer);

  // Health assets
  const bgRes = await a.evaluate(async () => {
    const r = await fetch('/assets/backgrounds/manifest.json');
    const j = await r.json();
    return j.scenes?.length;
  });
  console.log('Background count:', bgRes);

  // Hangup
  await a.click('#btn-hangup');
  await a.waitForSelector('#view-throne.active', { timeout: 10000 });
  console.log('Hangup -> throne OK');

  await browser.close();

  const summary = {
    previewOk,
    silencerOn,
    code,
    connected,
    muted,
    bgRes,
    pageErrors: errors.slice(0, 20),
  };
  console.log('SUMMARY', JSON.stringify(summary, null, 2));
  if (!previewOk || !connected || bgRes !== 30) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('E2E FAILED', e);
  process.exit(1);
});
