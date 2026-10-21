import { test, expect } from '@playwright/test';

test('paused room and static circuit stop rendering while controls and resume still work', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '조명 끄기', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '애니메이션 일시정지', exact: true }).click();
  await expect.poll(() => page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).measureRenderedFrames(300))).toBeLessThanOrEqual(2);
  const paused = await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readWorldCamera());
  await page.getByRole('button', { name: '조명 끄기', exact: true }).click();
  await expect(page.locator('main.app')).toHaveClass(/night/);
  await page.mouse.move(850, 450);
  await page.mouse.down();
  await page.mouse.move(1000, 500, { steps: 10 });
  await page.mouse.up();
  await expect.poll(async () => (await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readWorldCamera())).position).not.toEqual(paused.position);
  await page.getByRole('button', { name: '애니메이션 재생', exact: true }).click();
  expect(await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).measureRenderedFrames(300))).toBeGreaterThan(2);
  await page.getByRole('button', { name: '서킷 03' }).click();
  await expect(page.locator('main.app')).toHaveAttribute('data-ready', 'true');
  await expect.poll(() => page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).measureRenderedFrames(300))).toBeLessThanOrEqual(2);
  await page.getByRole('button', { name: '서킷 전체', exact: true }).click();
  await expect.poll(async () => (await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readWorldCamera())).position).not.toEqual([-3, 0.85, -0.1]);
  await page.getByRole('button', { name: '운전석 시점', exact: true }).click();
  await expect.poll(() => page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).measureRenderedFrames(300))).toBeLessThanOrEqual(2);
});

test('hidden tabs and open articles stop the scene and resume without skipping the cinematic', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '조명 끄기', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '책 펼치기', exact: true }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readRenderStats().frameloop)).toBe('never');
  const before = await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readWorldCamera());
  expect(await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).measureRenderedFrames(400))).toBe(0);
  expect(await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readWorldCamera())).toEqual(before);
  await page.evaluate(() => {
    delete (document as unknown as { hidden?: boolean }).hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 8000 });
  expect(await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).measureRenderedFrames(300))).toBe(0);
  await page.getByRole('button', { name: '목록 닫기' }).click();
  await expect(page.getByRole('button', { name: '조명 끄기', exact: true })).toBeEnabled();
});

test.describe('adaptive resolution', () => {
  test.use({ deviceScaleFactor: 2 });

  test('quality switch restores rendering settings without replacing the scene and remembers selection', async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1440 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: '조명 끄기', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: '애니메이션 일시정지', exact: true }).click();
    const toggle = page.getByRole('switch', { name: '60fps 최적화' });
    await expect(toggle).toBeChecked();
    const canvas = await page.locator('canvas').elementHandle();
    const camera = await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readWorldCamera());
    const quality = () => page.evaluate(async () => {
      const { dpr, shadowSizes, transmissionScale } = (await import('/tests/browser/room-probe.ts')).readRenderStats();
      return { dpr, shadowSizes, transmissionScale };
    });
    const optimizedQuality = await quality();
    expect(optimizedQuality.dpr).toBeLessThan(1);
    await toggle.focus();
    await page.keyboard.press('Space');
    await expect(toggle).not.toBeChecked();
    await expect.poll(quality).toEqual({ dpr: 1.5, shadowSizes: [2048], transmissionScale: 1 });
    await toggle.click();
    await expect.poll(quality).toEqual(optimizedQuality);
    expect(await canvas!.evaluate(node => node === document.querySelector('canvas'))).toBe(true);
    expect(await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readWorldCamera())).toEqual(camera);
    await toggle.click();
    await page.reload();
    await expect(page.getByRole('button', { name: '조명 끄기', exact: true })).toBeEnabled();
    await expect(toggle).not.toBeChecked();
    await expect.poll(quality).toEqual({ dpr: 1.5, shadowSizes: [2048], transmissionScale: 1 });
    await page.getByRole('button', { name: '서킷 03' }).click();
    await expect(page.locator('main.app')).toHaveAttribute('data-ready', 'true');
    await expect(toggle).not.toBeChecked();
    await expect.poll(quality).toEqual({ dpr: 1.5, shadowSizes: [2048], transmissionScale: 1 });
    await toggle.click();
    await expect.poll(quality).toEqual({ dpr: 0.6, shadowSizes: [1024], transmissionScale: 0.5 });
  });

  test('a large Retina viewport keeps its pixel budget through UI updates and pause', async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1440 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: '조명 끄기', exact: true })).toBeEnabled();
    const dpr = () => page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readRenderStats().dpr);
    await expect.poll(dpr).toBeLessThanOrEqual(0.75);
    const quality = await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readRenderStats());
    expect(quality.shadowSizes).toEqual([1024]);
    expect(quality.transmissionScale).toBe(0.5);
    const camera = await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readWorldCamera());
    await page.getByRole('button', { name: '조명 끄기', exact: true }).click();
    await page.getByRole('button', { name: '애니메이션 일시정지', exact: true }).click();
    await expect.poll(dpr).toBeLessThanOrEqual(0.75);
    expect(await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readWorldCamera())).toEqual(camera);
    await expect.poll(() => page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).measureRenderedFrames(300))).toBeLessThanOrEqual(2);
  });

  test('sustained frame load reduces actual canvas resolution without moving the camera', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: '조명 끄기', exact: true })).toBeEnabled();
    const before = await page.evaluate(async () => {
      const probe = await import('/tests/browser/room-probe.ts');
      return { dpr: probe.readRenderStats().dpr, camera: probe.readWorldCamera() };
    });
    expect(before.dpr).toBeGreaterThan(0.65);
    await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).setRenderDelay(35));
    try {
      await expect.poll(() => page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readRenderStats().dpr), { timeout: 15000 }).toBeLessThan(before.dpr);
    } finally {
      await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).setRenderDelay(0));
    }
    expect(await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readWorldCamera())).toEqual(before.camera);
    await page.getByRole('button', { name: '조명 끄기', exact: true }).click();
    expect(await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readRenderStats().dpr)).toBeLessThan(before.dpr);
  });
});

test('quality switch remains usable on mobile when storage is unavailable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('Storage unavailable'); };
    Storage.prototype.setItem = () => { throw new Error('Storage unavailable'); };
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: '조명 끄기', exact: true })).toBeEnabled();
  const toggle = page.getByRole('switch', { name: '60fps 최적화' });
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await toggle.click();
  await expect(toggle).toBeChecked();
  await page.screenshot({ path: '.local/render-mode-mobile.png' });
});
