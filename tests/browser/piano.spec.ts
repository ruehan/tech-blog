import { test, expect } from '@playwright/test';

async function openPlayer(page: import('@playwright/test').Page, skip = false) {
  await page.goto('/room');
  await expect(page.getByRole('button', { name: '피아노', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '피아노', exact: true }).click();
  if (skip) await page.getByRole('button', { name: '연출 건너뛰기' }).click();
  await expect(page.getByRole('dialog', { name: '피아노', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '곡 재생', exact: true })).toBeEnabled();
}

test('approach and key phrase lead to a fixed closeup player; MIDI audio, keys, pause and return share the same session', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const Original = window.AudioContext;
    const contexts: AudioContext[] = [];
    (window as any).__pianoContexts = contexts;
    window.AudioContext = class extends Original { constructor() { super(); contexts.push(this); } };
  });
  await page.goto('/room');
  await expect(page.getByRole('button', { name: '피아노', exact: true })).toBeEnabled();
  const rest = await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readWorldCamera());
  await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).startRoomCapture());
  await page.getByRole('button', { name: '피아노 연주', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '피아노', exact: true })).toBeVisible();
  const frames = await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readRoomCapture(true));
  expect(frames.some(frame => frame.pianoPressed > 0)).toBe(true);
  const closeup = await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readWorldCamera());
  expect(closeup.position[0]).toBeCloseTo(-0.85, 4);
  await page.screenshot({ path: '.local/piano-player-desktop.png' });
  await expect(page.getByRole('button', { name: '곡 재생', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '곡 재생', exact: true }).click();
  await expect(page.getByRole('button', { name: '곡 일시정지', exact: true })).toBeVisible();
  await expect.poll(() => page.locator('progress').evaluate(el => (el as HTMLProgressElement).value)).toBeGreaterThan(1);
  await expect.poll(() => page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readPianoPose().some(key => key.angle > 0.001)), { intervals: [40] }).toBe(true);
  expect(await page.evaluate(() => (window as any).__pianoContexts[0].state)).toBe('running');
  await page.getByRole('button', { name: '곡 일시정지', exact: true }).click();
  await page.waitForTimeout(150);
  const pausedTime = await page.locator('progress').getAttribute('value');
  await page.waitForTimeout(400);
  expect(await page.locator('progress').getAttribute('value')).toBe(pausedTime);
  expect(await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readWorldCamera())).toEqual(closeup);
  await expect.poll(() => page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readPianoPose().every(key => Math.abs(key.angle) < 0.0001))).toBe(true);
  await page.getByRole('button', { name: '곡 재생', exact: true }).click();
  await expect.poll(() => page.locator('progress').evaluate(el => (el as HTMLProgressElement).value)).toBeGreaterThan(Number(pausedTime));
  await page.getByRole('button', { name: '느린 저녁 기본 예제', exact: true }).click();
  await expect(page.getByRole('button', { name: '곡 재생', exact: true })).toBeEnabled();
  await expect(page.locator('progress')).toHaveAttribute('value', '0');
  await page.getByRole('button', { name: '곡 재생', exact: true }).click();
  await expect(page.getByRole('button', { name: '곡 일시정지', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as any).__pianoContexts.every((ctx: AudioContext) => ctx.state === 'closed'))).toBe(true);
  await expect(page.getByRole('button', { name: '피아노', exact: true })).toBeEnabled();
  expect(await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readWorldCamera())).toEqual(rest);
  expect((await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readPianoPose())).every(key => Math.abs(key.angle) < 1e-6)).toBe(true);
  expect(errors).toEqual([]);
});

test('failed MIDI and sample loading can recover and close', async ({ page }) => {
  let fail = true;
  await page.route('**/music/piano/room-prelude.mid', route => fail ? route.fulfill({ status: 404, body: 'missing' }) : route.continue());
  await page.goto('/room');
  await expect(page.getByRole('button', { name: '피아노', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '피아노', exact: true }).click();
  await page.getByRole('button', { name: '연출 건너뛰기' }).click();
  await expect(page.getByRole('alert')).toContainText('곡을 불러오지 못했어요');
  fail = false;
  await page.getByRole('button', { name: '다시 불러오기' }).click();
  await expect(page.getByRole('button', { name: '곡 재생', exact: true })).toBeEnabled();
  await page.route('**/audio/piano/*.mp3', route => route.abort());
  await page.getByRole('button', { name: '곡 재생', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: '곡 재생', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '피아노 닫기' }).click();
  await expect(page.getByRole('button', { name: '피아노', exact: true })).toBeEnabled();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('browser navigation disposes playing audio and reopening starts a fresh session', async ({ page }) => {
  await page.addInitScript(() => {
    const Original = window.AudioContext;
    (window as any).__pianoContexts = [];
    window.AudioContext = class extends Original { constructor() { super(); (window as any).__pianoContexts.push(this); } };
  });
  await page.goto('/room/journal');
  await page.getByRole('link', { name: '3D 방으로', exact: true }).click();
  await expect(page.getByRole('button', { name: '피아노', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '피아노', exact: true }).click();
  await page.getByRole('button', { name: '연출 건너뛰기' }).click();
  await expect(page.getByRole('button', { name: '곡 재생', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '곡 재생', exact: true }).click();
  await expect(page.getByRole('button', { name: '곡 일시정지', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/journal$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as any).__pianoContexts.every((ctx: AudioContext) => ctx.state === 'closed'))).toBe(true);
  await page.getByRole('link', { name: '3D 방으로', exact: true }).click();
  await expect(page.getByRole('button', { name: '피아노', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '피아노', exact: true }).click();
  await page.getByRole('button', { name: '연출 건너뛰기' }).click();
  await expect(page.getByRole('button', { name: '곡 재생', exact: true })).toBeEnabled();
  await expect(page.locator('progress')).toHaveAttribute('value', '0');
});

test('reduced motion still opens the music player and the panel fits mobile and landscape', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(size);
    await openPlayer(page);
    const box = (await page.getByRole('dialog').boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(size.width);
    expect(box.y + box.height).toBeLessThanOrEqual(size.height);
    await page.screenshot({ path: `.local/piano-player-${size.width}.png` });
    await page.getByRole('button', { name: '피아노 닫기' }).click();
    await expect(page.getByRole('button', { name: '피아노', exact: true })).toBeEnabled();
  }
});
