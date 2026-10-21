import { test, expect } from '@playwright/test';

test('opening starts at its first pose and settles continuously into the closer room view', async ({ page }) => {
  // Install the frame observer before releasing the last asset. This catches
  // both an initial static-room flash and a camera snap at the end of the intro.
  let release!: () => void;
  const assetGate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/interactive/runtime-tracks.json', async route => {
    await assetGate;
    await route.continue();
  });
  await page.goto('/');
  await page.evaluate(async () => {
    const probe = await import('/tests/browser/room-probe.ts');
    probe.startRoomCapture();
  });
  release();
  await expect(page.getByRole('button', { name: '조명 끄기', exact: true })).toBeEnabled();
  await expect.poll(async () => page.evaluate(async () => {
    const probe = await import('/tests/browser/room-probe.ts');
    return probe.readRoomCapture().filter(frame => frame.controlsEnabled).length;
  })).toBeGreaterThanOrEqual(3);
  const frames = await page.evaluate(async () => {
    const probe = await import('/tests/browser/room-probe.ts');
    return probe.readRoomCapture(true);
  });

  expect(frames[0].position[0]).toBeGreaterThan(10.15);
  expect(frames[0].zoom).toBe(1);
  expect(frames[0].editorScale).toBeLessThan(0.01);
  const settling = frames.filter(frame => frame.zoom > 1 && frame.zoom < 1.1);
  expect(settling.length).toBeGreaterThan(8);
  for (const frame of settling) {
    expect(frame.position[0]).toBeCloseTo(9, 5);
    expect(frame.position[1]).toBeCloseTo(8, 5);
    expect(frame.position[2]).toBeCloseTo(11, 5);
    expect(frame.controlsEnabled).toBe(false);
    expect(frame.editorScale).toBeCloseTo(1, 5);
  }
  for (let i = 1; i < frames.length; i++) {
    expect(frames[i].zoom - frames[i - 1].zoom).toBeGreaterThanOrEqual(-0.00001);
    expect(Math.abs(frames[i].zoom - frames[i - 1].zoom)).toBeLessThan(0.016);
  }
  expect(frames.at(-1)!.zoom).toBeCloseTo(1.1, 8);
});

test('room lighting, animated portal, folder, circuit closeup and return', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('main')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('button', { name: '조명 끄기', exact: true })).toBeEnabled({ timeout: 20_000 });
  await page.screenshot({ path: '.local/desktop-room.png' });
  const earlyRequests = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name));
  expect(earlyRequests.some(url => url.endsWith('computer-desktop.glb'))).toBe(false);
  expect(earlyRequests.some(url => url.endsWith('apex-circuit.glb'))).toBe(false);
  await page.getByRole('button', { name: '조명 끄기', exact: true }).click();
  await expect(page.locator('main')).toHaveClass(/night/);
  await page.getByRole('button', { name: '조명 켜기', exact: true }).click();
  await page.getByRole('button', { name: '컴퓨터 속으로' }).click();
  await expect(page.locator('main')).toHaveAttribute('data-world', 'desktop', { timeout: 20_000 });
  await expect(page.locator('main')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Projects 폴더 열기' }).click();
  await expect(page.getByRole('dialog')).toContainText('만들며 배우는 것들.');
  await page.getByRole('button', { name: '목록 닫기' }).click();
  await expect(page.getByRole('button', { name: 'Projects 폴더 닫기' })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: '.local/desktop-world.png' });
  await page.getByRole('button', { name: 'Projects 폴더 닫기' }).click();
  await page.getByRole('button', { name: '서킷 03' }).click();
  await expect(page.locator('main')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('main')).toHaveAttribute('data-view', 'cockpit');
  await page.getByRole('button', { name: '서킷 전체', exact: true }).click();
  await page.screenshot({ path: '.local/circuit-world.png' });
  await page.getByRole('button', { name: '차량 가까이' }).click();
  await expect(page.getByRole('button', { name: '차량 가까이' })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: '.local/car-closeup.png' });
  await page.keyboard.press('Escape');
  await expect(page.locator('main')).toHaveAttribute('data-world', 'room');
  await expect(page.locator('main')).toHaveAttribute('data-ready', 'true');
  expect(errors).toEqual([]);
});

test('mobile and reduced motion navigation stay available', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('main')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('button', { name: '애니메이션 재생', exact: true })).toBeVisible();
  await page.screenshot({ path: '.local/mobile-room.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '컴퓨터 속으로' }).click();
  await expect(page.locator('main')).toHaveAttribute('data-world', 'desktop');
  await expect(page.locator('main')).toHaveAttribute('data-ready', 'true');
  await page.screenshot({ path: '.local/mobile-desktop.png' });
  await page.getByRole('button', { name: '나의 방 01' }).click();
  await expect(page.locator('main')).toHaveAttribute('data-world', 'room');
  await page.getByRole('button', { name: '서킷으로', exact: true }).click();
  await expect(page.locator('main')).toHaveAttribute('data-world', 'circuit');
  await expect(page.locator('main')).toHaveAttribute('data-view', 'cockpit');
  await expect(page.locator('main')).toHaveAttribute('data-ready', 'true');
  await page.screenshot({ path: '.local/mobile-cockpit.png' });
});

test('sim racing portal enters the authored first-person cockpit and reset returns to it', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('button', { name: '조명 끄기', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '서킷으로', exact: true }).click();
  await expect(page.locator('main')).toHaveAttribute('data-world', 'circuit');
  await expect(page.locator('main')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('button', { name: '운전석 시점' })).toHaveAttribute('aria-pressed', 'true');
  const cockpit = await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readWorldCamera());
  expect(cockpit.position).toEqual([-3, 0.85, -0.1]);
  expect(cockpit.quaternion).toEqual([0, 0, 0, 1]);
  expect(cockpit.fov).toBeCloseTo(49.55, 1);
  expect(cockpit.zoom).toBe(1);
  expect(cockpit.near).toBe(0.03);
  await page.screenshot({ path: '.local/cockpit.png' });
  await page.mouse.move(650, 400);
  await page.mouse.down();
  await page.mouse.move(850, 500, { steps: 8 });
  await page.mouse.up();
  await page.mouse.wheel(0, 400);
  expect(await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readWorldCamera())).toEqual(cockpit);
  await page.getByRole('button', { name: '차량 가까이' }).click();
  await expect(page.locator('main')).toHaveAttribute('data-view', 'car');
  await page.getByRole('button', { name: '시점 초기화' }).click();
  await expect(page.locator('main')).toHaveAttribute('data-view', 'cockpit');
  expect(await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readWorldCamera())).toEqual(cockpit);
  await page.keyboard.press('Escape');
  await expect(page.locator('main')).toHaveAttribute('data-world', 'room');
  expect(errors).toEqual([]);
});

test('failed world loads show recovery and allow returning to room', async ({ page }) => {
  await page.route('**/worlds/computer-desktop.glb', route => route.abort());
  await page.goto('/');
  await expect(page.locator('main')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: '컴퓨터 02' }).click();
  await expect(page.getByRole('alert')).toContainText('공간을 불러오지 못했어요');
  await expect(page.locator('.loading')).not.toBeVisible();
  await page.getByRole('button', { name: '나의 방 01' }).click();
  await expect(page.locator('main')).toHaveAttribute('data-ready', 'true');
});
