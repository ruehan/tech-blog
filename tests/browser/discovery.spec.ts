import { test, expect } from '@playwright/test';

test('search excerpts highlight literal code matches and jump to the matching block on desktop and mobile', async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/journal?tag=3D&q=CAMERA.POSITION.SET%20quaternion');
    const result = page.locator('.journal-entry');
    await expect(result).toHaveCount(1);
    await expect(result.locator('.search-excerpt mark')).toHaveText(['camera.position.set', 'quaternion']);
    await expect(result).toHaveAttribute('href', /#search-block-/);
    await page.screenshot({ path: `.local/search-excerpt-${width}.png` });
    await result.click();
    const target = page.locator('[data-search-match=true]');
    await expect(target).toContainText('camera.quaternion.identity');
    await expect(target).toBeFocused();
    await expect(target).toBeInViewport();
    await page.reload();
    await expect(target).toBeInViewport();
    expect(await page.locator('.journal').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.getByRole('link', { name: '기록 목록', exact: true }).click();
    await expect(result.locator('.search-excerpt mark')).toHaveCount(2);
  }
});

test('series lists ordered chapters and navigates within each reading mode', async ({ page }) => {
  for (const base of ['/journal/posts', '/posts']) {
    await page.goto(`${base}/building-a-room-on-the-web`);
    await page.locator('.article-series summary').click();
    const series = page.getByRole('navigation', { name: '시리즈 순서' });
    await expect(series.locator('ol a')).toHaveCount(3);
    await expect(series.locator('[aria-current=page]')).toContainText('내 방을 웹으로 옮기는 일');
    await series.getByRole('link', { name: '다음 편', exact: true }).click();
    await expect(page).toHaveURL(`${page.url().split(base)[0]}${base}/making-hover-transitions-smooth`);
    await page.locator('.article-series summary').click();
    await expect(series.locator('[aria-current=page]')).toContainText('호버가 자꾸 다시 시작되던 이유');
    await series.getByRole('link', { name: '이전 편', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('내 방을 웹으로 옮기는 일');
  }
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/journal/posts/building-a-room-on-the-web');
  await page.getByRole('button', { name: '밤에 읽기', exact: true }).click();
  await page.locator('.article-series summary').click();
  expect(await page.locator('.journal').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: '.local/series-mobile.png' });
});

test('client navigation replaces share metadata and marks drafts and missing articles noindex', async ({ page }) => {
  await page.goto('/journal/posts/building-a-room-on-the-web');
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', 'https://hangyu.blog/journal/posts/building-a-room-on-the-web');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://hangyu.blog/images/posts/room-blog/room.png');
  expect(await page.locator('script[type="application/ld+json"]').textContent()).toContain('BlogPosting');
  await page.locator('.article-series summary').click();
  await page.getByRole('link', { name: '다음 편', exact: true }).click();
  await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', 'noindex, follow');
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /호버가 자꾸/);
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
  await page.getByRole('link', { name: '기록 목록', exact: true }).click();
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website');
  await expect(page.locator('meta[property="article:published_time"]')).toHaveCount(0);
  await expect(page.locator('meta[name=description]')).toHaveCount(1);
  await page.goto('/journal/posts/missing');
  await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', 'noindex, follow');
});
