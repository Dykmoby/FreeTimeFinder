#!/usr/bin/env node
/**
 * Screenshot a page of the app in headless Chromium — for visually verifying
 * UI changes. Uses the system browser (apt's `chromium`): puppeteer's own
 * download doesn't support the Pi's ARM Linux, hence puppeteer-core.
 *
 * Usage:
 *   node scripts/screenshot.mjs <url> <out.png> [options]
 *
 * Options:
 *   --login user:pass  log in via <origin>/api/auth/login and store the JWT in
 *                      localStorage (fff_token) before the app loads
 *   --token JWT        use a ready-made token instead of --login
 *   --width N          viewport width (default 1280)
 *   --height N         viewport height (default 900)
 *   --scroll N         scroll the window down N px after load
 *   --wait MS          settle time before the shot (default 600; covers CSS
 *                      transitions and the availability fetch)
 *   --full             full-page screenshot instead of the viewport
 */
import puppeteer from 'puppeteer-core';

const CHROMIUM = process.env.CHROMIUM_BIN || '/usr/bin/chromium';

const [, , url, out, ...rest] = process.argv;
if (!url || !out) {
  console.error('usage: node scripts/screenshot.mjs <url> <out.png> [--login user:pass] [--scroll N] ...');
  process.exit(1);
}

const opts = { width: 1280, height: 900, scroll: 0, wait: 600, full: false, login: null, token: null };
for (let i = 0; i < rest.length; i += 1) {
  const flag = rest[i].replace(/^--/, '');
  if (flag === 'full') opts.full = true;
  else if (flag in opts) opts[flag] = rest[(i += 1)];
  else {
    console.error(`unknown option --${flag}`);
    process.exit(1);
  }
}

const origin = new URL(url).origin;

let token = opts.token;
if (opts.login) {
  const sep = opts.login.indexOf(':');
  const body = { username: opts.login.slice(0, sep), password: opts.login.slice(sep + 1) };
  const r = await fetch(`${origin}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    console.error(`login failed (${r.status}): ${await r.text()}`);
    process.exit(1);
  }
  token = (await r.json()).token;
}

const browser = await puppeteer.launch({
  executablePath: CHROMIUM,
  // Local pages we wrote ourselves; --no-sandbox keeps headless launches
  // working even where user namespaces are restricted.
  args: ['--no-sandbox', '--disable-gpu'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: Number(opts.width), height: Number(opts.height) });
  if (token) {
    await page.evaluateOnNewDocument((t) => localStorage.setItem('fff_token', t), token);
  }
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  if (Number(opts.scroll)) {
    await page.evaluate((y) => window.scrollTo(0, y), Number(opts.scroll));
  }
  await new Promise((resolve) => setTimeout(resolve, Number(opts.wait)));
  await page.screenshot({ path: out, fullPage: opts.full });
  console.log(`saved ${out}`);
} finally {
  await browser.close();
}
