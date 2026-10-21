import { test, expect } from '@playwright/test';

const articlePath = '/journal/posts/building-a-room-on-the-web';

test('night reading persists across journal routes and reloads without loading 3D', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/journal');
  const journal = page.locator('.journal');
  const toggle = page.getByRole('button', { name: '밤에 읽기', exact: true });
  await expect(journal).toHaveAttribute('data-theme', 'day');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(journal).toHaveCSS('background-color', 'rgb(28, 43, 37)');
  await page.screenshot({ path: '.local/journal-night-index.png' });
  await page.locator('.journal-entry').first().click();
  await expect(journal).toHaveAttribute('data-theme', 'night');
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.article-body')).toHaveCSS('color', 'rgb(204, 211, 192)');
  await page.getByRole('navigation', { name: '블로그 메뉴' }).getByRole('link', { name: '프로젝트' }).click();
  await expect(journal).toHaveAttribute('data-theme', 'night');
  await page.locator('.journal-project-card').click();
  await expect(page.locator('.article-body h2').first()).toHaveCSS('color', 'rgb(230, 229, 213)');
  await toggle.click();
  await page.reload();
  await expect(journal).toHaveAttribute('data-theme', 'day');
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('theme toggle remains usable when local storage is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
  });
  await page.goto('/journal');
  await page.getByRole('button', { name: '밤에 읽기', exact: true }).click();
  await expect(page.locator('.journal')).toHaveAttribute('data-theme', 'night');
  await page.locator('.journal-entry').first().click();
  await expect(page.locator('.journal')).toHaveAttribute('data-theme', 'night');
});

test('desktop outline stays beside the article and tracks scrolling, links and deep links', async ({ page }) => {
  await page.goto(articlePath);
  const toc = page.getByRole('navigation', { name: '목차' });
  const current = toc.locator('[aria-current=location]');
  await expect(current).toHaveText('공간을 입구로 삼기');
  await expect(toc.getByRole('button')).toBeHidden();
  await page.getByRole('button', { name: '밤에 읽기', exact: true }).click();
  await page.screenshot({ path: '.local/journal-night-article.png' });
  await toc.getByRole('link', { name: '작은 전환이 만드는 차이' }).click();
  await expect(page).toHaveURL(/#small-transitions$/);
  await expect(current).toHaveText('작은 전환이 만드는 차이');
  await expect(page.locator('#small-transitions')).toBeFocused();
  const bounds = (await toc.boundingBox())!;
  const body = (await page.locator('.article-body').boundingBox())!;
  expect(bounds.y).toBeCloseTo(32, 0);
  expect(bounds.x).toBeGreaterThan(body.x + body.width);
  await page.screenshot({ path: '.local/journal-night-scrolled.png' });
  await page.locator('#scene-and-content').evaluate(element => element.scrollIntoView());
  await expect(current).toHaveText('장면과 콘텐츠의 역할');
  await page.reload();
  await expect(current).toHaveText('작은 전환이 만드는 차이');
  await expect(page.locator('#small-transitions')).toBeInViewport();
  await toc.getByRole('link', { name: '공간을 입구로 삼기' }).click();
  await page.goBack();
  await expect(current).toHaveText('작은 전환이 만드는 차이');
});

test('compact outline expands by keyboard, closes after jumping and stays within narrow screens', async ({ page }) => {
  for (const width of [390, 320, 844]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(articlePath);
    const toc = page.getByRole('navigation', { name: '목차' });
    const toggle = toc.getByRole('button');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toc.getByRole('link').first()).toBeHidden();
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await toc.getByRole('link', { name: '작은 전환이 만드는 차이' }).click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#small-transitions')).toBeFocused();
    await expect(toggle).toContainText('작은 전환이 만드는 차이');
    const bounds = (await toc.boundingBox())!;
    const heading = (await page.locator('#small-transitions').boundingBox())!;
    expect(bounds.y).toBeCloseTo(0, 0);
    expect(heading.y).toBeGreaterThanOrEqual(bounds.y + bounds.height);
    expect(await page.locator('.journal').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.getByRole('button', { name: '밤에 읽기', exact: true }).click();
    await page.screenshot({ path: `.local/journal-reading-${width}.png` });
    await page.reload();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toContainText('작은 전환이 만드는 차이');
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole('navigation', { name: '목차' }).getByRole('link')).toHaveCount(4);
  await expect(page.getByRole('navigation', { name: '목차' }).getByRole('link').first()).toBeVisible();
});
