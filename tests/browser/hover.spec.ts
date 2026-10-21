import { test, expect } from '@playwright/test';

test('moving between monitor meshes keeps one continuous hover and exits smoothly', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '조명 끄기', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '안내 숨기기', exact: true }).click();
  const points = await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).roomMeshPoints('monitor'));
  expect(points.length).toBeGreaterThanOrEqual(2);
  await page.mouse.move(points[0].x, points[0].y);
  await page.waitForTimeout(750);
  await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).startRoomCapture());
  for (let i = 0; i < 12; i++) {
    const point = points[i % 2];
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(30);
  }
  const hovering = await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readRoomCapture());
  expect(hovering.length).toBeGreaterThan(10);
  expect(Math.min(...hovering.map(frame => frame.hover.monitor))).toBeGreaterThan(0.98);

  await page.mouse.move(10, 10);
  await page.waitForTimeout(850);
  const frames = await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readRoomCapture(true));
  expect(frames.at(-1)!.hover.monitor).toBeCloseTo(0, 5);
  expect(Math.max(...frames.slice(1).map((frame, i) => Math.abs(frame.hover.monitor - frames[i].hover.monitor)))).toBeLessThan(0.25);

  // Interrupt entry with a real exit, then re-enter before the exit completes.
  await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).startRoomCapture());
  await page.mouse.move(points[0].x, points[0].y);
  await page.waitForTimeout(120);
  await page.mouse.move(10, 10);
  await page.waitForTimeout(150);
  await page.mouse.move(points[0].x, points[0].y);
  await page.waitForTimeout(750);
  const reversed = await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readRoomCapture(true));
  expect(reversed.at(-1)!.hover.monitor).toBeCloseTo(1, 5);
  expect(Math.max(...reversed.slice(1).map((frame, i) => Math.abs(frame.hover.monitor - reversed[i].hover.monitor)))).toBeLessThan(0.25);
});

test('all four label hovers enter once, hold their pose, and survive quick leave/re-entry', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '조명 끄기', exact: true })).toBeEnabled();
  for (const [label, key, expected] of [
    ['책 펼치기', 'book', 0.23], ['컴퓨터 속으로', 'monitor', 1], ['서킷으로', 'simulator', 1], ['베이스 연주', 'music', 0],
  ] as const) {
    await page.mouse.move(10, 10);
    await page.waitForTimeout(750);
    await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).startRoomCapture());
    await page.getByRole('button', { name: label }).hover();
    await page.waitForTimeout(2900);
    let frames = await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readRoomCapture());
    const tail = frames.filter(frame => frame.time > frames.at(-1)!.time - 250);
    for (const frame of tail) {
      const values = key === 'music' ? frame.hover.music : [frame.hover[key]];
      for (const value of values) expect(value).toBeCloseTo(expected, 4);
    }
    // A short gap over an edge must not replay the entry animation.
    await page.mouse.move(10, 10);
    await page.getByRole('button', { name: label }).hover();
    await page.waitForTimeout(300);
    frames = await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readRoomCapture(true));
    for (const frame of frames.filter(frame => frame.time >= tail[0].time)) {
      const values = key === 'music' ? frame.hover.music : [frame.hover[key]];
      for (const value of values) expect(value).toBeCloseTo(expected, 4);
    }
    if (key !== 'music') {
      const values = frames.map(frame => frame.hover[key]);
      // Includes Enter -> Hold: no single rendered frame may restore the base pose.
      const span = key === 'book' ? 0.07 : 1;
      expect(Math.max(...values.slice(1).map((value, i) => Math.abs(value - values[i])))).toBeLessThan(span * 0.25);
    }
  }
});
