import { test, expect } from '@playwright/test';

const key = 'blog-view-mode';

test('last journal view survives a new browser context and root entry avoids 3D loading', async ({ page, context, browser, baseURL }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '일반 블로그로 보기' })).toBeVisible();
  await page.getByRole('button', { name: '일반 블로그로 보기' }).click();
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), key)).toBe('journal');
  const saved = await context.storageState();
  const returning = await browser.newContext({ storageState: saved, baseURL });
  try {
    const next = await returning.newPage();
    const sceneRequests: string[] = [];
    next.on('request', request => { if (/WorldScene|\.glb(?:\?|$)/.test(request.url())) sceneRequests.push(request.url()); });
    await next.goto('/?utm_source=return');
    await expect(next).toHaveURL(/\/journal\?utm_source=return$/);
    await expect(next.getByRole('heading', { level: 1 })).toHaveText('글 3');
    await expect(next.locator('canvas')).toHaveCount(0);
    expect(sceneRequests).toEqual([]);
    const length = await next.evaluate(() => history.length);
    await next.reload();
    expect(await next.evaluate(() => history.length)).toBe(length);
  } finally { await returning.close(); }
});

test('explicit switches and browser back update the preference without redirect loops', async ({ page }) => {
  await page.goto('/journal');
  await page.getByRole('link', { name: '3D 방으로', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: '일반 블로그로 보기' })).toBeVisible();
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), key)).toBe('room');
  await page.reload();
  await expect(page).toHaveURL(/\/$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/journal$/);
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), key)).toBe('journal');
  await page.goForward();
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), key)).toBe('room');
  await page.goto('/');
  await expect(page).toHaveURL(/\/$/);
});

test('article and project deep links keep their reading mode, query and fragment', async ({ page }) => {
  await page.goto('/journal');
  await page.goto('/posts/building-a-room-on-the-web?tag=React#scene-and-content');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('내 방을 웹으로 옮기는 일');
  await expect(page).toHaveURL(/\/posts\/building-a-room-on-the-web\?tag=React#scene-and-content$/);
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), key)).toBe('room');
  await page.goto('/journal/projects/hangyu-room');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('hangyu / room');
  await expect(page).toHaveURL(/\/journal\/projects\/hangyu-room$/);
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), key)).toBe('journal');
  await page.goto('/journal/posts/building-a-room-on-the-web?tag=React#scene-and-content');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('내 방을 웹으로 옮기는 일');
  await expect(page).toHaveURL(/\/journal\/posts\/building-a-room-on-the-web\?tag=React#scene-and-content$/);
  await page.goto('/');
  await expect(page).toHaveURL(/\/journal$/);
});

test('unavailable storage and invalid values retain usable navigation', async ({ page, context }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }));
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: '일반 블로그로 보기' }).click();
  await expect(page).toHaveURL(/\/journal$/);
  await page.reload();
  await expect(page.locator('.journal')).toBeVisible();
  await page.getByRole('link', { name: '3D 방으로', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(errors).toEqual([]);
  const other = await context.newPage();
  await other.goto('/journal');
  await other.evaluate(key => localStorage.setItem(key, 'invalid'), key);
  await other.goto('/');
  await expect(other).toHaveURL(/\/$/);
  await expect.poll(() => other.evaluate(key => localStorage.getItem(key), key)).toBe('room');
});
