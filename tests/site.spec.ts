import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
// @ts-expect-error plain ESM script without types
import { lintText } from '../scripts/copy-lint.mjs';
import { toQuery, fromQuery, canonical, emptyState, type State } from '../src/lib/state';
import { stats } from '../src/lib/data';

const events = JSON.parse(readFileSync('src/data/events.json', 'utf8'));
const debate = JSON.parse(readFileSync('src/data/debate.json', 'utf8'));
const meta = JSON.parse(readFileSync('src/data/meta.json', 'utf8'));
const S = stats(events, debate, meta);
const ids = new Set<string>(events.map((e: { id: string }) => e.id));

async function ready(page: Page, url = './') {
  await page.goto(url);
  await page.waitForSelector('.stage svg, #index.is-active', { timeout: 15000 });
  await page.waitForTimeout(1800);
}
async function axe(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).analyze();
  expect(r.violations.map((v) => `${label} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
}
async function lintPage(page: Page, label: string) {
  const text: string = await page.evaluate(() => {
    const parts = [document.body.innerText];
    document.querySelectorAll('svg text').forEach((t) => parts.push(t.textContent ?? ''));
    document.querySelectorAll('[aria-label]').forEach((n) => parts.push(n.getAttribute('aria-label') ?? ''));
    return parts.join('\n');
  });
  const problems = text.split('\n').flatMap((l: string) => (l.trim() ? lintText(l, label) : []));
  expect(problems).toEqual([]);
}

test('numbers on screen match the validator', async ({ page }) => {
  await ready(page, './?v=floor');
  await expect(page.locator('.deck')).toContainText(`${S.items} UN linked events`);
  await expect(page.locator('.deck')).toContainText(`${S.hlw} of them in high level week`);
  await expect(page.locator('svg text.t-big')).toHaveText(String(S.membersAi));
  await expect(page.locator('.stage svg')).toContainText(`of ${S.members} Member States that spoke from 22 to 25 September`);
  await expect(page.locator('.stage svg')).toContainText(`THE PEAK, ${S.peak} ITEMS`);
  await expect(page.locator('.sentence')).toHaveText(`Showing ${S.items} of ${S.items} items.`);
  for (const c of meta.conveners) await expect(page.locator('.legend .conv', { hasText: c.label })).toContainText(String(S.conv[c.key]));
  await expect(page.locator('.stage .mark')).toHaveCount(S.items);
  const seats = page.locator('.stage .seats rect');
  await expect(seats).toHaveCount(S.members);
  expect(await page.locator('.stage .seats rect[fill="rgb(239, 235, 225)"]').count()).toBe(S.membersAi);
  await page.getByRole('button', { name: 'BY REGIONAL GROUP' }).click();
  for (const g of S.groups) await expect(page.locator('.groups')).toContainText(`${g.label} ${g.lit} of ${g.total}`);
});

test('public JSON carries no gist for statements without AI and no mention counts', async ({ request }) => {
  const res = await request.get('data/stage.json');
  const d = await res.json();
  for (const s of d.debate) if (!s.raised_ai) expect(s.ai_gist).toBeNull();
  const keys: string[] = [];
  const walk = (o: unknown) => {
    if (Array.isArray(o)) o.forEach(walk);
    else if (o && typeof o === 'object')
      for (const [k, v] of Object.entries(o)) if (k !== 'expected') (keys.push(k), walk(v)); // meta.expected holds the Assembly wide totals
  };
  walk(d);
  expect(keys.filter((k) => /mention/i.test(k))).toEqual([]);
});

test('axe and copy lint in every view and state', async ({ page }) => {
  await ready(page, './?v=floor');
  for (const v of ['floor', 'pulse', 'constellation', 'index']) {
    await page.locator(`#tab-${v}`).click();
    await page.waitForTimeout(800);
    await axe(page, v);
    await lintPage(page, v);
  }
  await page.locator('#tab-constellation').click();
  for (const f of ['PLATFORM', 'THEME', 'WHERE', 'TYPE']) {
    await page.getByRole('button', { name: f, exact: true }).click();
    await page.waitForTimeout(700);
    await axe(page, `constellation ${f}`);
    await lintPage(page, `constellation ${f}`);
  }
  await page.locator('#tab-index').click();
  await page.locator('#tab-statements').click();
  await axe(page, 'index statements');
  await lintPage(page, 'index statements');

  await page.locator('#tab-floor').click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'FILTER' }).click();
  await axe(page, 'filters');
  await lintPage(page, 'filters');
  await page.getByRole('button', { name: /Education and children/ }).click();
  await expect(page.locator('.sentence')).toContainText('education and children');
  await lintPage(page, 'filtered');
  await page.getByRole('button', { name: 'CLEAR', exact: true }).click();
  await page.getByRole('button', { name: 'CLOSE', exact: true }).click();

  await page.locator('.mark[data-id="e058"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: /Independent International Scientific Panel/ })).toBeVisible();
  await axe(page, 'card');
  await lintPage(page, 'card');
  await page.keyboard.press('Escape');

  await page.keyboard.press('/');
  await page.getByRole('combobox').fill('keny');
  await expect(page.getByRole('option', { name: /Kenya/ }).first()).toBeVisible();
  await axe(page, 'search');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Kenya' })).toBeVisible();
  await axe(page, 'country card');
  await lintPage(page, 'country card');
});

test('keyboard: tabs, roving marks, pin and escape', async ({ page }) => {
  await ready(page, './?v=floor');
  await page.locator('#tab-floor').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#tab-pulse')).toBeFocused();
  await expect(page).toHaveURL(/v=pulse/);
  await page.keyboard.press('ArrowLeft');
  await expect(page).toHaveURL(/v=floor/);
  const first = page.locator('.mark[tabindex="0"]');
  await expect(first).toHaveCount(1);
  await first.focus();
  const id1 = await first.getAttribute('data-id');
  await page.keyboard.press('ArrowRight');
  const id2 = await page.evaluate(() => document.activeElement?.getAttribute('data-id'));
  expect(id2).not.toBe(id1);
  await page.keyboard.press('Enter');
  await expect(page.locator('#card-title')).toBeFocused();
  await expect(page).toHaveURL(new RegExp(`sel=${id2}`));
  await page.keyboard.press('Escape');
  await expect(page.locator(`.mark[data-id="${id2}"]`)).toBeFocused();
  await expect(page.locator('#stage-desc')).toContainText('Floor view');
  await expect(page.locator('[aria-live="polite"]').first()).toContainText('Floor view');
});

test('URL state: 50 random filter states round trip', async ({ page, browserName }, info) => {
  test.skip(info.project.name !== 'desktop', 'one project is enough');
  let seed = 81;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pick = (keys: string[]) => keys.filter(() => rnd() < 0.25);
  const days = Array.from({ length: 22 }, (_, i) => `2026-09-${String(8 + i).padStart(2, '0')}`);
  const views = ['floor', 'pulse', 'constellation', 'index'] as const;
  const facets = ['convener', 'platform', 'theme', 'where', 'type'] as const;
  for (let n = 0; n < 50; n++) {
    const s: State = emptyState();
    s.v = views[Math.floor(rnd() * 4)];
    s.conv = pick(meta.conveners.map((c: { key: string }) => c.key));
    s.theme = pick(meta.themes.map((c: { key: string }) => c.key));
    s.platform = pick(meta.platforms.map((c: { key: string }) => c.key));
    s.type = pick(meta.types.map((c: { key: string }) => c.key));
    s.loc = pick(meta.locations.map((c: { key: string }) => c.key));
    if (rnd() < 0.5) {
      const a = Math.floor(rnd() * 22);
      const b = Math.min(21, a + Math.floor(rnd() * 8));
      if (!(a === 0 && b === 21)) s.d = [days[a], days[b]];
    }
    s.pga = rnd() < 0.2;
    s.facet = facets[Math.floor(rnd() * 5)];
    s.seat = rnd() < 0.3 ? 'group' : 'day';
    if (rnd() < 0.3) s.sel = [...ids][Math.floor(rnd() * ids.size)];
    if (rnd() < 0.2) s.q = ['kenya', 'UNESCO', 'Côte', 'ITU'][Math.floor(rnd() * 4)];
    if (rnd() < 0.2) s.org = [['itu'], ['unesco', 'undp'], ['pga'], ['eu']][Math.floor(rnd() * 4)];
    const q = toQuery(s, meta);
    expect(toQuery(fromQuery(q, meta, ids), meta)).toBe(q);
    expect(fromQuery(q, meta, ids)).toEqual(canonical(s, meta));
    await page.goto(`./${q}`);
    await page.waitForSelector('.sentence:not(:empty)');
    const back = await page.evaluate(() => location.search);
    expect(decodeURIComponent(back)).toBe(decodeURIComponent(q));
  }
  await page.goto('./?v=floor');
  await page.waitForSelector('.stage svg');
  await page.locator('#tab-pulse').click();
  await page.locator('#tab-constellation').click();
  await page.goBack();
  await expect(page).toHaveURL(/v=pulse/);
  await expect(page.locator('#tab-pulse')).toHaveAttribute('aria-selected', 'true');
  await page.goBack();
  await expect(page).toHaveURL(/v=floor/);
});

test('phone width: no horizontal scroll and 44 px targets in every view', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await ready(page);
  for (const v of ['floor', 'pulse', 'constellation', 'index']) {
    await page.locator(`#tab-${v}`).click();
    await page.waitForTimeout(700);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over, v).toBeLessThanOrEqual(0);
    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.mbtn, .opt, .conv, [role="tab"], .handle, .idx .sort, .idx .src a')]
        .filter((el) => el.offsetParent !== null)
        .map((el) => ({ t: el.textContent?.trim().slice(0, 30), r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width < 44 || r.height < 44)
        .map(({ t, r }) => `${t} ${Math.round(r.width)}x${Math.round(r.height)}`),
    );
    expect(small, v).toEqual([]);
  }
  await page.getByRole('button', { name: 'FILTER' }).click();
  await expect(page.getByRole('dialog', { name: 'Filters' })).toBeVisible();
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(0);
});

test('SAVE IMAGE produces a PNG at both sizes', async ({ page }, info) => {
  test.skip(info.project.name === 'phone', 'Android Chrome shares through the native sheet, which automation cannot open');
  const viaShare = info.project.name === 'iphone';
  if (viaShare) {
    // iOS hands the file to the native share sheet. Capture what would be shared.
    await page.addInitScript(() => {
      (navigator as unknown as { canShare: unknown }).canShare = () => true;
      (navigator as unknown as { share: unknown }).share = async (d: { files: File[] }) => {
        const bmp = await createImageBitmap(d.files[0]);
        (window as unknown as { __shared: unknown }).__shared = { name: d.files[0].name, w: bmp.width, h: bmp.height };
      };
    });
  }
  await ready(page, './?v=floor');
  // Phones export the portrait size, the size toggle shows from 600 px up.
  const sizes = [
    ['1080 X 1350', 1080, 1350],
    ['1200 X 627', 1200, 627],
  ] as const;
  for (const [label, w, h] of viaShare ? sizes.slice(0, 1) : sizes) {
    if (!viaShare) await page.getByRole('button', { name: label }).click();
    if (viaShare) {
      await page.evaluate(() => ((window as unknown as { __shared: unknown }).__shared = null));
      const shared = page
        .waitForFunction(() => (window as unknown as { __shared: unknown }).__shared, null, { timeout: 30000 })
        .then(() => page.evaluate(() => (window as unknown as { __shared: unknown }).__shared));
      const downloaded = page.waitForEvent('download', { timeout: 30000 }).then(async (dl) => {
        const buf = readFileSync((await dl.path())!);
        return { name: dl.suggestedFilename(), w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
      });
      await page.getByRole('button', { name: 'SAVE IMAGE' }).click();
      const got = await Promise.any([shared, downloaded]);
      expect(got).toEqual({ name: `unga81-ai-floor-${w}x${h}.png`, w, h });
      continue;
    }
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'SAVE IMAGE' }).click()]);
    expect(dl.suggestedFilename()).toBe(`unga81-ai-floor-${w}x${h}.png`);
    const buf = readFileSync((await dl.path())!);
    expect(buf.readUInt32BE(16)).toBe(w);
    expect(buf.readUInt32BE(20)).toBe(h);
  }
});

test('reduced motion: no intro and no count up', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('./?v=floor');
  await page.waitForSelector('svg text.t-big');
  await expect(page.locator('svg text.t-big')).toHaveText(String(S.membersAi), { timeout: 300 });
  await ctx.close();
});

test('share pages carry the right card', async ({ request }) => {
  const home = await (await request.get('./')).text();
  expect(home).toContain('<meta property="og:image" content="https://mafiatun.github.io/unga81-ai-events/og/cover.png"');
  expect(home).toContain('<title>The week AI took the floor: AI at UNGA81</title>');
  const item = await (await request.get('e/e058/')).text();
  expect(item).toContain('content="https://mafiatun.github.io/unga81-ai-events/og/e/e058.png"');
  const country = await (await request.get('country/kenya/')).text();
  expect(country).toContain('content="https://mafiatun.github.io/unga81-ai-events/og/country/kenya.png"');
  for (const p of ['og/cover.png', 'og/e/e058.png', 'og/country/kenya.png']) {
    const buf = await (await request.get(p)).body();
    expect([buf.readUInt32BE(16), buf.readUInt32BE(20)], p).toEqual([1200, 627]);
  }
  // Countries that neither mentioned AI nor convened an item have no page.
  expect((await request.get('country/jordan/')).status()).toBe(404);
});

test('no runtime request leaves the site origin', async ({ page }) => {
  const outside: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (!['localhost', '127.0.0.1'].includes(u.hostname) && u.protocol !== 'data:' && u.protocol !== 'blob:') outside.push(r.url());
  });
  await ready(page, './?v=floor');
  for (const v of ['pulse', 'constellation', 'index', 'floor']) {
    await page.locator(`#tab-${v}`).click();
    await page.waitForTimeout(400);
  }
  await page.locator('.mark[data-id="e058"]').focus();
  await page.keyboard.press('Enter');
  await page.goto('./e/e058/');
  await page.goto('./country/kenya/');
  expect(outside).toEqual([]);
});

// ---------------------------------------------------------------- layout and guidance

const SCREENS = [
  ['MacBook Pro 14', 1512, 860],
  ['MacBook Air 13', 1440, 780],
  ['1366 laptop', 1366, 768],
  ['1280 laptop', 1280, 720],
  ['Full HD', 1920, 960],
  ['iPad Pro landscape', 1194, 834],
] as const;

test('the whole chart fits the window after choosing a view, on common desktop screens', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop', 'desktop sizes only');
  for (const [name, w, h] of SCREENS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('./');
    await page.waitForSelector('.stage svg');
    for (const v of ['floor', 'pulse', 'constellation']) {
      await page.locator(`#tab-${v}`).click();
      await page.waitForTimeout(500);
      const box = await page.locator('.stage svg').boundingBox();
      expect(box!.y, `${name} ${v} top`).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height, `${name} ${v} bottom`).toBeLessThanOrEqual(h + 1);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over, `${name} ${v} overflow`).toBeLessThanOrEqual(0);
    }
    await ctx.close();
  }
});

test('start with presets apply a view and are links', async ({ page }) => {
  await ready(page, './?v=floor');
  const peak = page.getByRole('link', { name: /The peak day, 21 September/i });
  await expect(peak).toHaveAttribute('href', '?d=0921-0921');
  await peak.click();
  await expect(page.locator('.sentence')).toHaveText(`Showing ${S.peak} of ${S.items} items: on 21 September.`);
  await expect(peak).toHaveAttribute('aria-current', 'true');
  await page.getByRole('link', { name: /PGA took part/i }).click();
  await expect(page.locator('.sentence')).toContainText('with the President of the General Assembly taking part');
  await page.getByRole('button', { name: /Find your country/i }).click();
  await expect(page.getByRole('combobox')).toBeFocused();
});

test('how to read this: opens, passes axe and copy lint, closes with Escape', async ({ page }) => {
  await ready(page, './?v=floor');
  const btn = page.getByRole('button', { name: 'HOW TO READ THIS' });
  await btn.click();
  const dlg = page.getByRole('dialog', { name: 'How to read this' });
  await expect(dlg).toBeVisible();
  await expect(dlg).toContainText(`${S.membersAi} seats are lit`);
  await axe(page, 'how to read');
  await lintPage(page, 'how to read');
  await page.keyboard.press('Escape');
  await expect(dlg).toBeHidden();
  await expect(btn).toBeFocused();
  await page.getByRole('button', { name: 'HIDE TIPS' }).click();
  await expect(page.locator('.hint')).toHaveCount(0);
  await page.reload();
  await page.waitForSelector('.stage svg');
  await expect(page.locator('.hint')).toHaveCount(0);
  await page.getByRole('button', { name: 'SHOW TIPS' }).click();
  await expect(page.locator('.hint')).toHaveCount(1);
});

test('pinned bar appears once the toolbar scrolls away and switches views', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the pinned tabs show on wide screens');
  await ready(page, './?v=index');
  await expect(page.locator('.pin')).not.toHaveClass(/on/);
  await page.mouse.wheel(0, 3000);
  await expect(page.locator('.pin')).toHaveClass(/on/);
  await axe(page, 'pinned');
  await page.locator('.pin').getByRole('button', { name: 'PULSE' }).click();
  await expect(page).toHaveURL(/v=pulse/);
  await expect(page.locator('.toolbar')).toBeInViewport();
});

test('filters open as a drawer on wide screens and a sheet on phones', async ({ page }, info) => {
  await ready(page, './?v=floor');
  await page.locator('.toolbar').getByRole('button', { name: 'FILTER' }).click();
  const panel = page.locator('#filters');
  await expect(panel).toBeVisible();
  await expect(panel).toHaveClass(info.project.name === 'desktop' ? /drawer/ : /sheet/);
  await axe(page, 'filters panel');
  await panel.getByRole('button', { name: /^Health/ }).click();
  await expect(page.locator('.sentence')).toContainText('health');
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
});

test('who took part: directory renders, links work, passes axe and copy lint', async ({ page }) => {
  await page.goto('./who/');
  await expect(page.locator('h1')).toHaveText('Who took part');
  for (const g of S.groups) await expect(page.locator('.group-head', { hasText: g.label })).toContainText(`${g.lit} OF ${g.total} MENTIONED AI`);
  await expect(page.locator('#countries .tile')).toHaveCount(94);
  await axe(page, 'who');
  await lintPage(page, 'who');
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(0);
  // Only seats of statements that mentioned AI can be pointed at.
  const kenya = page.locator('.tile', { hasText: 'Kenya' });
  await expect(kenya).not.toHaveAttribute('data-order', /.*/);
  await page.locator('#un_system .tile', { hasText: /^ITU/ }).click();
  await expect(page).toHaveURL(/\?o=itu/);
  await page.waitForSelector('.stage svg');
  await expect(page.locator('.sentence')).toHaveText('Showing 16 of 133 items: naming ITU among the organisers.');
  await page.getByRole('button', { name: 'CLEAR \u201cITU\u201d' }).click();
  await expect(page.locator('.sentence')).toHaveText(`Showing ${S.items} of ${S.items} items.`);
});

test('who took part: every link resolves', async ({ page, request }, info) => {
  test.skip(info.project.name !== 'desktop', 'one project is enough');
  await page.goto('./who/');
  const hrefs = await page.locator('main a[href]').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
  for (const h of [...new Set(hrefs)].filter((h) => !h.includes('#'))) expect((await request.get(h)).status(), h).toBe(200);
});
