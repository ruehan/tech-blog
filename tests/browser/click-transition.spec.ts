import { test, expect } from '@playwright/test';

for (const label of ['책 펼치기', '베이스 연주', '컴퓨터 속으로', '서킷으로']) {
  test(`${label}: aligns from the orbit view without a first-frame snap and can be cancelled`, async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: '조명 끄기', exact: true })).toBeEnabled();
    // Use the actual OrbitControls so the camera starts away from the authored pose.
    await page.mouse.move(850, 450);
    await page.mouse.down();
    await page.mouse.move(1000, 500, { steps: 12 });
    await page.mouse.up();
    await page.mouse.wheel(0, -180);
    await page.getByRole('button', { name: label, exact: true }).hover();
    await page.waitForTimeout(800);
    const before = await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readWorldCamera());
    const distance = Math.hypot(...before.position.map((v, i) => v - [9, 8, 11][i]));
    expect(distance).toBeGreaterThan(1);
    await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).startRoomCapture());
    await page.getByRole('button', { name: label, exact: true }).click();
    await page.waitForTimeout(300);
    const frames = await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readRoomCapture(true));
    const aligning = frames.filter(frame => !frame.controlsEnabled);
    expect(aligning.length).toBeGreaterThan(5);
    // Camera translation and extra room zoom must both converge over multiple frames.
    expect(aligning[0].zoom).toBeGreaterThan(1.095);
    expect(aligning.at(-1)!.zoom).toBeGreaterThan(1.01);
    expect(aligning.at(-1)!.zoom).toBeLessThan(1.095);
    let previous = before;
    for (const frame of frames) {
      expect(Math.hypot(...frame.position.map((v, i) => v - previous.position[i]))).toBeLessThan(distance * 0.2);
      expect(Math.abs(frame.zoom - previous.zoom)).toBeLessThan(0.02);
      previous = { ...before, ...frame };
    }
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: '조명 끄기', exact: true })).toBeEnabled();
    await page.waitForTimeout(800);
    await expect(page.locator('main.app')).toHaveAttribute('data-world', 'room');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '연출 건너뛰기' })).toHaveCount(0);
  });
}

test('alignment pauses in place, resumes and allows skipping directly to the open book', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '조명 끄기', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '책', exact: true }).click();
  await page.getByRole('button', { name: '애니메이션 일시정지', exact: true }).click();
  const held = await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readWorldCamera());
  await page.waitForTimeout(800);
  expect(await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readWorldCamera())).toEqual(held);
  await page.getByRole('button', { name: '애니메이션 재생', exact: true }).click();
  await page.getByRole('button', { name: '연출 건너뛰기' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const book = await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readBookPose());
  expect(book.pageScale).toEqual([1, 1, 1]);
  expect(Math.abs(book.cover[1])).toBeGreaterThan(0.99);
});

for (const action of ['book', 'music']) {
  test(`${action}: the final frame blends into the resting room before controls resume`, async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: '조명 끄기', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: '조명 끄기', exact: true }).click();
    const before = await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readWorldCamera());
    await page.getByRole('button', { name: action === 'book' ? '책' : '음악', exact: true }).click();
    if (action === 'book') {
      await page.getByRole('button', { name: '연출 건너뛰기' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
    }
    await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).startRoomCapture());
    if (action === 'book') await page.getByRole('button', { name: '목록 닫기' }).click();
    await expect(page.getByRole('button', { name: '조명 켜기', exact: true })).toBeEnabled({ timeout: 25000 });
    await expect.poll(async () => page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readRoomCapture().filter(frame => frame.controlsEnabled).length)).toBeGreaterThanOrEqual(3);
    const frames = await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readRoomCapture(true));
    const end = frames.findLastIndex(frame => frame.zoom <= 1.000001);
    expect(end).toBeGreaterThan(0);
    const returning = frames.slice(end);
    expect(returning.filter(frame => frame.zoom > 1 && frame.zoom < 1.1).length).toBeGreaterThan(8);
    for (let i = 1; i < returning.length; i++) {
      expect(returning[i].zoom - returning[i - 1].zoom).toBeGreaterThanOrEqual(-0.00001);
      expect(Math.abs(returning[i].zoom - returning[i - 1].zoom)).toBeLessThan(0.016);
      expect(Math.hypot(...returning[i].position.map((v, j) => v - returning[i - 1].position[j]))).toBeLessThan(0.01);
      expect(Math.abs(returning[i].fov - returning[i - 1].fov)).toBeLessThan(0.1);
      expect(Math.hypot(...returning[i].quaternion.map((v, j) => v - returning[i - 1].quaternion[j]))).toBeLessThan(0.001);
      if (returning[i].zoom < 1.1) expect(returning[i].controlsEnabled).toBe(false);
    }
    expect(await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readWorldCamera())).toEqual(before);
    await expect(page.locator('main.app')).toHaveClass(/night/);
    await expect(page.getByRole('button', { name: '책', exact: true })).toBeEnabled();
  });
}
