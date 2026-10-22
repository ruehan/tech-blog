import { test, expect } from '@playwright/test';

test('project previews switch without loading 3D and link to the project and its records', async ({ page }) => {
  const sceneRequests: string[] = [];
  page.on('request', request => { if (/\.glb(?:\?|$)|WorldScene/.test(request.url())) sceneRequests.push(request.url()); });
  await page.goto('/journal/projects');
  await expect(page.getByRole('heading', { name: 'hangyu / room', exact: true })).toBeVisible();
  await expect(page.locator('.showcase-screen img:visible')).toHaveAttribute('src', /room\.png$/);
  const toggle = page.getByRole('button', { name: '2D 블로그', exact: true });
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.showcase-screen img:visible')).toHaveAttribute('src', /journal\.png$/);
  await page.getByRole('link', { name: '글 읽으러 가기' }).click();
  await expect(page).toHaveURL(/\/journal$/);
  await page.goBack();
  await page.getByRole('link', { name: '프로젝트 자세히 보기' }).click();
  await expect(page).toHaveURL(/\/journal\/projects\/hangyu-room$/);
  await page.goBack();
  await page.locator('.showcase-records a').first().click();
  await expect(page).toHaveURL(/\/journal\/posts\/building-a-room-on-the-web$/);
  expect(sceneRequests).toEqual([]);
});

test('project preview and details fit mobile and night mode', async ({ page }) => {
  for (const width of [1440, 844, 390, 320]) {
    await page.setViewportSize({width, height: 900});
    await page.goto('/journal/projects');
    await page.getByRole('button', {name: '2D 블로그', exact: true}).click();
    await expect(page.locator('.showcase-screen img:visible')).toBeVisible();
    expect(await page.locator('.journal').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.getByRole('button', {name: '밤에 읽기', exact: true}).click();
    await expect(page.locator('.journal')).toHaveAttribute('data-theme', 'night');
    await page.screenshot({path: `.local/project-night-${width}.png`});
    await page.getByRole('button', {name: '밤에 읽기', exact: true}).click();
  }
});
