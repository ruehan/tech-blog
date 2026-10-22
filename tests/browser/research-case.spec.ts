import { test, expect } from '@playwright/test';

const origin = 'https://hangyu-field-notes.vercel.app';

test.beforeEach(async ({ page }) => {
  await page.route(`${origin}/**`, route => route.fulfill({
    contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ko"><meta charset="utf-8"><title>연구 사례</title><body><h1>연구 상세 내용</h1><button>인터랙션 실행</button></body></html>',
  }));
});

test('research cases open inside a modal and restore reading position and focus on close', async ({ page }) => {
  await page.goto('/about');
  const links = page.locator('.about-reference');
  await expect(links).toHaveCount(4);
  for (const link of await links.all()) {
    await link.scrollIntoViewIfNeeded();
    const scrollTop = await page.locator('.journal').evaluate(el => el.scrollTop);
    const href = await link.getAttribute('href');
    await link.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/about$/);
    await expect(dialog.locator('iframe')).toHaveAttribute('src', href!);
    await expect(page.frameLocator('.research-case-frame').getByRole('heading')).toHaveText('연구 상세 내용');
    await expect(page.getByRole('button', { name: '연구 사례 닫기' })).toBeFocused();
    await expect(page.locator('.journal')).toHaveCSS('overflow-y', 'hidden');
    await page.getByRole('button', { name: '연구 사례 닫기' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(link).toBeFocused();
    await expect.poll(() => page.locator('.journal').evaluate(el => el.scrollTop)).toBeCloseTo(scrollTop, 0);
  }
});

test('Escape, backdrop and browser back close the modal without trapping navigation', async ({ page }) => {
  await page.goto('/journal');
  await page.getByRole('link', { name: '소개', exact: true }).click();
  const link = page.locator('.about-reference').first();
  await link.click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // Cross-origin frame keyboard events do not bubble to the parent dialog.
  // The persistent close control remains usable after interacting with its content.
  await link.click();
  await page.frameLocator('.research-case-frame').getByRole('button').click();
  await page.getByRole('button', { name: '연구 사례 닫기' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await link.click();
  await page.mouse.click(2, 2);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(link).toBeFocused();
  await link.click();
  await page.goBack();
  await expect(page).toHaveURL(/\/journal$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.journal')).toHaveCSS('overflow-y', 'auto');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
});

test('case viewer fits mobile, keeps the close control visible and offers the source in a new tab', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/about');
  await page.getByRole('button', { name: '밤에 읽기', exact: true }).click();
  await page.locator('.about-reference').first().click();
  const dialog = page.getByRole('dialog');
  const rect = (await dialog.boundingBox())!;
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.x + rect.width).toBeLessThanOrEqual(320);
  expect(rect.y + rect.height).toBeLessThanOrEqual(640);
  await expect(page.getByRole('button', { name: '연구 사례 닫기' })).toBeInViewport();
  await expect(page.getByRole('link', { name: '원본 새 탭' })).toHaveAttribute('target', '_blank');
});
