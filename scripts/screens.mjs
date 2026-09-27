// Screen size check: opens every view on 14 common screens and reports whether the whole chart
// is in the window, plus screenshots. Needs a running preview: npx astro preview --port 4321
// Usage: node scripts/screens.mjs <output folder> [comma separated screen names]
import { chromium, devices } from '@playwright/test';
const OUT = process.argv[2];
const sizes = [
  ['mbp14', { viewport: { width: 1512, height: 860 } }],
  ['air13', { viewport: { width: 1440, height: 780 } }],
  ['laptop720', { viewport: { width: 1280, height: 720 } }],
  ['hd768', { viewport: { width: 1366, height: 768 } }],
  ['fhd', { viewport: { width: 1920, height: 960 } }],
  ['qhd', { viewport: { width: 2560, height: 1300 } }],
  ['ipad-p', { ...devices['iPad (gen 11)'] }],
  ['ipad-l', { ...devices['iPad (gen 11) landscape'] }],
  ['ipadpro-p', { ...devices['iPad Pro 11'] }],
  ['ipadpro-l', { ...devices['iPad Pro 11 landscape'] }],
  ['phone360', { ...devices['Galaxy S9+'], viewport: { width: 360, height: 740 } }],
  ['iphone15', { ...devices['iPhone 15'] }],
  ['iphone15max', { ...devices['iPhone 15 Pro Max'] }],
  ['phone-land', { ...devices['iPhone 15 landscape'] }],
];
const only = process.argv[3]?.split(',');
const b = await chromium.launch();
for (const [name, opt] of sizes) {
  if (only && !only.includes(name)) continue;
  const ctx = await b.newContext({ ...opt, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:4321/unga81-ai-events/');
  await p.waitForSelector('.stage svg');
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${OUT}/${name}-0-landing.png` });
  const rows = [];
  for (const v of ['floor', 'pulse', 'constellation', 'index']) {
    await p.locator(`#tab-${v}`).click();
    await p.waitForTimeout(1100);
    const m = await p.evaluate(() => {
      const svg = document.querySelector('.stage:not(.hidden) svg');
      const r = svg?.getBoundingClientRect();
      const tb = document.querySelector('.toolbar').getBoundingClientRect();
      return {
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        toolbarTop: Math.round(tb.top),
        chartTop: r ? Math.round(r.top) : null,
        chartBottom: r ? Math.round(r.bottom) : null,
        chartH: r ? Math.round(r.height) : null,
        vh: innerHeight,
        fits: r ? r.bottom <= innerHeight + 1 && r.top >= 0 : null,
        pinned: document.querySelector('.pin')?.classList.contains('on'),
      };
    });
    rows.push(`${v}: ${JSON.stringify(m)}`);
    await p.screenshot({ path: `${OUT}/${name}-${v}.png` });
  }
  console.log(`== ${name} ${JSON.stringify(ctx.pages()[0].viewportSize())} errors:${errs.length}`);
  for (const r of rows) console.log('   ' + r);
  await ctx.close();
}
await b.close();
