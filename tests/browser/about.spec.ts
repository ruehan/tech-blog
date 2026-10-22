import { test, expect } from '@playwright/test';

test('about opens from the journal without loading 3D and includes contact and supplied work experience', async ({ page }) => {
  const scenes: string[] = [];
  page.on('request', request => { if (/\.glb|WorldScene/.test(request.url())) scenes.push(request.url()); });
  await page.goto('/journal');
  await page.getByRole('link', { name: '소개', exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('안녕하세요,hangyu입니다.');
  await expect(page.getByRole('link', { name: '소개', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await expect(page.getByRole('link', { name: 'ruehan98@gmail.com', exact: true })).toHaveAttribute('href', 'mailto:ruehan98@gmail.com');
  await expect(page.getByRole('link', { name: 'GitHub ruehan', exact: true })).toHaveAttribute('href', 'https://github.com/ruehan');
  await expect(page.locator('.about-experience-row')).toHaveCount(2);
  await expect(page.locator('.about-experience-row').first()).toContainText('2025.04 ~ 2026.10');
  await expect(page.locator('.about-experience-row').first()).toContainText('(주) 제로원');
  await expect(page.locator('.about-experience-row').last()).toContainText('한국전자기술연구원');
  await expect(page.locator('.about-experience-row').last()).toContainText('2021.10 ~ 2023.03');
  await expect(page.locator('.about-experience')).not.toContainText('작성 예정');
  await expect(page.locator('.about-role')).toHaveText('풀스택 개발자 · 응용 AI 연구자');
  await expect(page.getByRole('link', { name: '포트폴리오', exact: true })).toHaveAttribute('href', 'https://hangyu-field-notes.vercel.app/');
  await expect(page.locator('.about-project')).toHaveCount(4);
  await expect(page.getByRole('link', { name: 'DDang 구현 사례 보기' })).toHaveAttribute('href', 'https://hangyu-field-notes.vercel.app/projects/ddang');
  await expect(page.locator('.about-project').filter({ hasText: 'R&D WorkOS' })).toContainText('외부 AI 호출과 서버 저장은 아직 포함하지 않았습니다.');
  await expect(page.locator('.about-reference')).toHaveCount(4);
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', 'https://hangyu.blog/about');
  await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', 'index, follow');
  await expect(page).toHaveTitle('소개 — hangyu / room');
  await page.reload();
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(scenes).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('blog-view-mode'))).toBe('journal');
  await page.goBack();
  await expect(page).toHaveURL(/\/journal$/);
});

test('about is reachable from the room during an animation and preserves the room preference', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '책 펼치기', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '책 펼치기', exact: true }).click();
  await page.getByRole('button', { name: '소개', exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('blog-view-mode'))).toBe('room');
  await page.waitForTimeout(1500);
  await expect(page).toHaveURL(/\/about$/);
  await page.getByRole('link', { name: '방 둘러보기', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('main.app')).toBeVisible();
});

test('about and its expanded menu fit mobile and night theme', async ({ page }) => {
  await page.goto('/about');
  await page.getByRole('button', { name: '밤에 읽기', exact: true }).click();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.locator('.journal')).toHaveAttribute('data-theme', 'night');
    await expect(page.getByRole('link', { name: '소개', exact: true })).toBeInViewport();
    const rail = (await page.locator('.journal-rail').boundingBox())!;
    expect(rail.x).toBeGreaterThanOrEqual(0);
    expect(rail.x + rail.width).toBeLessThanOrEqual(width);
    expect(await page.locator('.journal').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  }
  await page.getByRole('link', { name: '글 기록 보기', exact: true }).click();
  await expect(page).toHaveURL(/\/journal$/);
});
