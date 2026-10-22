import { test, expect, type Page } from '@playwright/test';

async function setup(page: Page) {
  const time = new Date('2026-10-22T03:00:00Z');
  await page.addInitScript(() => { Math.random = () => 0.5; });
  await page.clock.install({ time });
  await page.clock.pauseAt(new Date(time.getTime() + 1000));
  await page.goto('/journal');
}

async function lightsOut(page: Page) {
  await page.clock.runFor(4650);
  await expect(page.locator('.start-lights')).toHaveAttribute('data-phase', 'go');
}

test('lights progress in order, record a reaction once and preserve only the best score', async ({ page }) => {
  await setup(page);
  const game = page.locator('.start-lights');
  const pad = page.getByRole('button', { name: '스타트 라이트 게임' });
  await pad.click();
  await expect(game).toHaveAttribute('data-phase', 'waiting');
  await expect(game.locator('[data-lit=true]')).toHaveCount(1);
  await page.clock.runFor(650);
  await expect(game.locator('[data-lit=true]')).toHaveCount(2);
  await page.clock.runFor(1950);
  await expect(game.locator('[data-lit=true]')).toHaveCount(5);
  await page.clock.runFor(1900);
  await expect(game).toHaveAttribute('data-phase', 'waiting');
  await page.clock.runFor(150);
  await expect(game).toHaveAttribute('data-phase', 'go');
  await expect(game.locator('[data-lit=true]')).toHaveCount(0);
  await page.clock.runFor(200);
  await pad.click();
  await expect(game).toHaveAttribute('data-phase', 'result');
  const best = Number(await page.evaluate(() => localStorage.getItem('journal-start-lights-best')));
  expect(best).toBeGreaterThanOrEqual(200);
  expect(best).toBeLessThan(300);
  await expect(game.locator('.start-lights-best')).toContainText(`${best} ms`);
  await pad.click();
  await lightsOut(page);
  await page.clock.runFor(450);
  await pad.click();
  expect(await page.evaluate(() => localStorage.getItem('journal-start-lights-best'))).toBe(String(best));
  await page.reload();
  await expect(game).toHaveAttribute('data-phase', 'idle');
  await expect(game.locator('.start-lights-best')).toContainText(`${best} ms`);
});

test('keyboard holds do not fire twice, early presses do not score, and a valid retry succeeds', async ({ page }) => {
  await setup(page);
  const game = page.locator('.start-lights');
  const pad = page.getByRole('button', { name: '스타트 라이트 게임' });
  await pad.focus();
  await page.keyboard.down('Space');
  await pad.dispatchEvent('keydown', { key: ' ', repeat: true });
  await page.keyboard.up('Space');
  await expect(game).toHaveAttribute('data-phase', 'waiting');
  await page.clock.runFor(1300);
  await pad.press('Enter');
  await expect(game).toHaveAttribute('data-phase', 'early');
  expect(await page.evaluate(() => localStorage.getItem('journal-start-lights-best'))).toBeNull();
  await page.clock.runFor(6000);
  await expect(game).toHaveAttribute('data-phase', 'early');
  await pad.press('Enter');
  await lightsOut(page);
  await page.clock.runFor(220);
  await pad.press('Space');
  await expect(game).toHaveAttribute('data-phase', 'result');
  await expect(game.getByRole('status')).toContainText('새 최고 기록');
});

test('hidden tabs, focus changes, Escape, timeout and leaving the index clear pending rounds', async ({ page }) => {
  await setup(page);
  const game = page.locator('.start-lights');
  const pad = page.getByRole('button', { name: '스타트 라이트 게임' });
  await pad.click();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(game).toHaveAttribute('data-phase', 'cancelled');
  await page.clock.runFor(20_000);
  await page.evaluate(() => {
    delete (document as unknown as { hidden?: boolean }).hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(game).toHaveAttribute('data-phase', 'cancelled');
  await pad.click();
  await page.getByRole('searchbox').focus();
  await expect(game).toHaveAttribute('data-phase', 'cancelled');
  await pad.click();
  await pad.press('Escape');
  await expect(game).toHaveAttribute('data-phase', 'cancelled');
  await pad.click();
  await lightsOut(page);
  await page.clock.runFor(10_000);
  await expect(game).toHaveAttribute('data-phase', 'missed');
  expect(await page.evaluate(() => localStorage.getItem('journal-start-lights-best'))).toBeNull();
  await pad.click();
  await page.locator('.journal-entry').first().click();
  await page.clock.runFor(6000);
  await page.getByRole('link', { name: '기록 목록', exact: true }).click();
  await expect(game).toHaveAttribute('data-phase', 'idle');
});

test('a blocked storage and reduced-motion preference still allow a complete round', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setup(page);
  const pad = page.getByRole('button', { name: '스타트 라이트 게임' });
  await pad.click();
  await lightsOut(page);
  await page.clock.runFor(200);
  await pad.click();
  await expect(page.locator('.start-lights')).toHaveAttribute('data-phase', 'result');
  await expect(page.locator('.start-lights-best')).toContainText('ms');
});

test('the desk device stays beside or below the posts and within narrow screens', async ({ page }) => {
  for (const width of [1440, 1100, 844, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/journal');
    const game = page.locator('.start-lights');
    await game.scrollIntoViewIfNeeded();
    const bounds = (await game.boundingBox())!;
    const entries = (await page.locator('.journal-entries').boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(bounds.x >= entries.x + entries.width || bounds.y >= entries.y + entries.height).toBe(true);
    expect(await page.locator('.journal').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    if (width === 1440 || width === 390) await page.screenshot({ path: `.local/start-lights-${width}.png` });
    if (width === 320) {
      await page.getByRole('button', { name: '밤에 읽기', exact: true }).click();
      await page.screenshot({ path: '.local/start-lights-night.png' });
    }
  }
});

test.describe('touch', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('touch down records once without the synthetic click starting another round', async ({ page }) => {
    await setup(page);
    const pad = page.getByRole('button', { name: '스타트 라이트 게임' });
    await pad.tap();
    await expect(page.locator('.start-lights')).toHaveAttribute('data-phase', 'waiting');
    await lightsOut(page);
    await page.clock.runFor(200);
    await pad.tap();
    await expect(page.locator('.start-lights')).toHaveAttribute('data-phase', 'result');
  });
});
