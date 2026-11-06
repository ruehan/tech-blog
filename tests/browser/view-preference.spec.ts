import { test, expect } from '@playwright/test';

test('APEX stays the entrance for returning readers without loading the old 3D scene', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('blog-view-mode', 'journal'));
  const requests: string[] = [];
  page.on('request', request => { if (/WorldScene|\.glb(?:\?|$)/.test(request.url())) requests.push(request.url()); });
  await page.goto('/?utm_source=return');
  await expect(page.locator('#portal')).toBeVisible();
  await expect(page).toHaveURL(/\/\?utm_source=return$/);
  await page.getByRole('link', { name: '개발 코드를 쓰며 배운 것과 해결한 문제들.' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('개발');
  expect(requests).toEqual([]);
});

test('original reading and room modes preserve browser history', async ({ page }) => {
  await page.goto('/room/journal');
  await page.getByRole('link', { name: '3D 방으로', exact: true }).click();
  await expect(page).toHaveURL(/\/room$/);
  await expect(page.getByRole('button', { name: '일반 블로그로 보기' })).toBeVisible();
  await page.goBack();
  await expect(page.locator('.journal')).toBeVisible();
  await expect(page).toHaveURL(/\/room\/journal$/);
});

test('old deep links preserve query and fragment with the new canonical address', async ({ page }) => {
  await page.goto('/journal/posts/building-a-room-on-the-web?tag=React#scene-and-content');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('내 방을 웹으로 옮기는 일');
  await expect(page).toHaveURL(/\/journal\/posts\/building-a-room-on-the-web\?tag=React#scene-and-content$/);
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', 'https://hangyu.blog/writing/building-a-room-on-the-web');
  await page.goto('/posts/building-a-room-on-the-web');
  await expect(page.getByRole('dialog', { name: '글 기록' })).toBeVisible();
});

test('navigation and theme work when storage is blocked', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }));
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/writing');
  await page.getByRole('button', { name: '다크 모드로 변경' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link', { name: '프로젝트' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('프로젝트');
  expect(errors).toEqual([]);
});
