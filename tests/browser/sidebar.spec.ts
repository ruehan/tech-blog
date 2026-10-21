import { test, expect } from '@playwright/test';

test('left shortcuts open content immediately and keep all controls together', async ({ page }) => {
  await page.goto('/');
  const menu = page.getByRole('complementary', { name: '공간 메뉴' });
  await expect(menu).toBeVisible();
  await expect(page.locator('.tools, .world-actions, .footer, .library-shortcut')).toHaveCount(0);
  await menu.getByRole('button', { name: '글 목록 열기' }).click();
  await expect(page).toHaveURL(/\/posts$/, { timeout: 2000 });
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '목록 닫기' }).click();
  await expect(menu).toBeVisible();
  await menu.getByRole('button', { name: '프로젝트 목록 열기' }).click();
  await expect(page).toHaveURL(/\/projects$/, { timeout: 2000 });
  await expect(page.getByRole('heading', { name: '만들며 배우는 것들.' })).toBeVisible();
  await page.getByRole('button', { name: '목록 닫기' }).click();
  await expect(menu.getByRole('button', { name: '조명 끄기', exact: true })).toBeEnabled();
  await menu.getByRole('button', { name: '조명 끄기', exact: true }).click();
  await expect(page.locator('main.app')).toHaveClass(/night/);
  await menu.getByRole('button', { name: '조명 켜기', exact: true }).click();
  await menu.getByRole('button', { name: '안내 숨기기', exact: true }).click();
  await expect(page.locator('.hotspot')).toHaveCount(0);
  await menu.getByRole('button', { name: '안내 보기', exact: true }).click();
  await expect(page.locator('.hotspot')).toHaveCount(4);
  await page.screenshot({ path: '.local/left-rail-desktop.png' });
});

test('switching worlds from the left menu cancels an in-flight book animation', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '조명 끄기', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '책 펼치기', exact: true }).click();
  await expect(page.getByRole('button', { name: '연출 건너뛰기' })).toBeVisible();
  await page.getByRole('button', { name: '컴퓨터 02' }).click();
  await expect(page.locator('main.app')).toHaveAttribute('data-world', 'desktop');
  await expect(page.locator('main.app')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('button', { name: '컴퓨터 02' })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', { name: '서킷 03' }).click();
  await expect(page.locator('main.app')).toHaveAttribute('data-world', 'circuit');
  await expect(page.getByRole('button', { name: '운전석 시점', exact: true })).toBeVisible();
  await expect(page.locator('main.app')).toHaveAttribute('data-view', 'cockpit');
  await page.waitForTimeout(1000);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: '차량 가까이' }).click();
  await expect(page.locator('main.app')).toHaveAttribute('data-view', 'car');
  await page.getByRole('button', { name: '시점 초기화' }).click();
  await expect(page.locator('main.app')).toHaveAttribute('data-view', 'cockpit');
});

test('left menu remains reachable on mobile and short landscape screens', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByRole('button', { name: '조명 끄기', exact: true })).toBeEnabled();
    const menu = page.getByRole('complementary', { name: '공간 메뉴' });
    const bounds = (await menu.boundingBox())!;
    expect(bounds.x).toBeLessThan(40);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
    await menu.getByRole('button', { name: '안내 숨기기' }).click();
    await expect(page.locator('.hotspot')).toHaveCount(0);
    await menu.getByRole('button', { name: '글 목록 열기' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: '목록 닫기' }).click();
    await menu.getByRole('button', { name: '나의 방 01' }).scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    await page.screenshot({ path: `.local/left-rail-${viewport.width}.png` });
  }
});

test('a content shortcut cancels a pending folder opening without closing an already opened folder', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '컴퓨터 02' }).click();
  await page.getByRole('button', { name: 'Projects 폴더 열기' }).click();
  await page.waitForTimeout(350);
  await page.getByRole('button', { name: '글 목록 열기' }).click();
  await expect(page).toHaveURL(/\/posts$/);
  await page.getByRole('button', { name: '목록 닫기' }).click();
  await page.waitForTimeout(2800);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Projects 폴더 열기' }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await page.getByRole('button', { name: '목록 닫기' }).click();
  await page.getByRole('button', { name: '글 목록 열기' }).click();
  await page.getByRole('button', { name: '목록 닫기' }).click();
  await expect(page.getByRole('button', { name: 'Projects 폴더 닫기' })).toHaveAttribute('aria-pressed', 'true');
});
