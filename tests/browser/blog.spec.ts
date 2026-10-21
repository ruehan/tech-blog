import { test, expect } from '@playwright/test';

test('posts appear when the book opens and closing posts immediately starts closing the book', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '조명 끄기', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '조명 끄기', exact: true }).click();
  const before = await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readWorldCamera());
  await page.getByRole('button', { name: '책 펼치기', exact: true }).click();
  await expect(page.getByRole('button', { name: '연출 건너뛰기' })).toBeVisible();
  await expect.poll(async () => page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readWorldCamera().position[0])).toBeLessThan(8);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/\/posts$/, { timeout: 6500 });
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.post-card')).toHaveCount(3);
  const book = await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readBookPose());
  // Content replaces the later page-enlargement sequence.
  expect(book.pageScale).toEqual([1, 1, 1]);
  expect(Math.abs(book.cover[1])).toBeGreaterThan(0.99);
  await page.screenshot({ path: '.local/blog-list.png' });
  await page.getByRole('link', { name: '인터랙션', exact: true }).click();
  await expect(page.locator('.post-card')).toHaveCount(1);
  await page.locator('.post-card').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('호버가 자꾸 다시 시작되던 이유');
  await expect(page.getByRole('navigation', { name: '목차' })).toBeVisible();
  await expect(page.locator('.book-index')).toBeVisible();
  await expect(page.locator('.book-paper')).toBeVisible();
  await expect(page.locator('.post-card[aria-current=page]')).toContainText('호버가 자꾸 다시 시작되던 이유');
  await page.screenshot({ path: '.local/blog-article.png' });
  await page.getByRole('link', { name: '글 목록', exact: true }).click();
  await expect(page.locator('.post-card')).toHaveCount(1);
  expect(await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readBookPose())).toEqual(book);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: '연출 건너뛰기' })).toBeVisible();
  // No enlarged page retracts first: the cover must already be closing.
  await expect.poll(async () => page.evaluate(async () => Math.abs((await import('/tests/browser/room-probe.ts')).readBookPose().cover[1])), { timeout: 1500 }).toBeLessThan(0.95);
  expect((await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readBookPose())).pageScale).toEqual([1, 1, 1]);
  await expect(page.locator('main.app')).toHaveClass(/night/);
  await expect(page.getByRole('button', { name: '연출 건너뛰기' })).toHaveCount(0);
  const after = await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readWorldCamera());
  expect(after).toEqual(before);
});

test('book entry can be cancelled or skipped without losing the reading destination', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '조명 끄기', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '책', exact: true }).click();
  await expect(page.getByRole('button', { name: '연출 건너뛰기' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '연출 건너뛰기' })).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('button', { name: '글 목록 열기' }).click();
  await page.getByRole('button', { name: '연출 건너뛰기' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const book = await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readBookPose());
  expect(book.pageScale).toEqual([1, 1, 1]);
  expect(Math.abs(book.cover[1])).toBeGreaterThan(0.99);
  await page.getByRole('button', { name: '목록 닫기' }).click();
  await page.getByRole('button', { name: '연출 건너뛰기' }).click();
  await expect(page.getByRole('button', { name: '조명 끄기', exact: true })).toBeEnabled();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('direct article links load without 3D, support sharing and browser history', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/posts/making-hover-transitions-smooth');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('호버가 자꾸 다시 시작되던 이유');
  await expect(page).toHaveTitle(/호버가 자꾸 다시 시작되던 이유/);
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(await page.evaluate(() => performance.getEntriesByType('resource').some(entry => entry.name.endsWith('.glb')))).toBe(false);
  await page.locator('.book-page-scroll').evaluate(element => { element.scrollTop = 600; });
  const position = await page.locator('.book-page-scroll').evaluate(element => element.scrollTop);
  await page.getByRole('link', { name: '글 목록', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.goBack();
  await expect(page.locator('.book-page-scroll')).toBeVisible();
  await expect.poll(() => page.locator('.book-page-scroll').evaluate(element => element.scrollTop)).toBeCloseTo(position, 0);
  await page.getByRole('button', { name: '링크 복사', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('링크를 복사했어요.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('호버가 자꾸 다시 시작되던 이유');
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('mobile reading, empty tags, missing articles and reduced motion remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/posts?tag=missing');
  await expect(page.getByRole('heading', { name: '아직 이 태그의 글이 없어요.' })).toBeVisible();
  await page.getByRole('link', { name: '전체 글 보기' }).click();
  await page.screenshot({ path: '.local/mobile-blog-list.png' });
  await page.locator('.post-card').first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('내 방을 웹으로 옮기는 일');
  await expect(page.locator('.book-index')).toBeHidden();
  await expect(page.locator('.book-leaf')).toHaveCSS('animation-name', 'none');
  await page.getByRole('link', { name: '다음 글', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('호버가 자꾸 다시 시작되던 이유');
  await expect(page.locator('.book-leaf')).toHaveCSS('animation-name', 'none');
  await page.screenshot({ path: '.local/mobile-blog-article.png' });
  expect(await page.locator('.book-page-scroll').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.goto('/posts/no-such-article');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('이 페이지는 아직 없어요.');
  await page.getByRole('link', { name: '글 목록으로' }).click();
  await page.getByRole('button', { name: '목록 닫기' }).click();
  await expect(page.getByRole('button', { name: '책 펼치기', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '책 펼치기', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('desktop Projects folder opens project details and preserves the desktop on return', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: '컴퓨터 속으로' }).click();
  await expect(page.locator('main.app')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Projects 폴더 열기' }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await page.locator('.project-card').click();
  await expect(page).toHaveURL(/\/projects\/hangyu-room$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('hangyu / room');
  await page.screenshot({ path: '.local/blog-project.png' });
  await page.getByRole('button', { name: '공간으로 돌아가기' }).click();
  await expect(page.locator('main.app')).toHaveAttribute('data-world', 'desktop');
  await expect(page.getByRole('button', { name: 'Projects 폴더 닫기' })).toHaveAttribute('aria-pressed', 'true');
});

test('Projects waits for the actual folder animation and closing early cancels the opening', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '컴퓨터 02' }).click();
  await expect(page.locator('main.app')).toHaveAttribute('data-ready', 'true');
  const rest = await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readFolderPose());
  expect(rest).toBeDefined();
  await page.getByRole('button', { name: 'Projects 폴더 열기' }).click();
  await page.waitForTimeout(350);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const moving = await page.evaluate(async () => (await import('/tests/browser/room-probe.ts')).readFolderPose());
  expect(moving).not.toEqual(rest);
  await page.getByRole('button', { name: 'Projects 폴더 닫기' }).click();
  await page.waitForTimeout(2700);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('button', { name: 'Projects 폴더 열기' }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '목록 닫기' }).click();
  await page.waitForTimeout(300);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('posts remain reachable even when the 3D room fails to load', async ({ page }) => {
  await page.route('**/interactive/room.glb', route => route.abort());
  await page.goto('/');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: '글 목록 열기' }).click();
  await page.locator('.post-card').first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('내 방을 웹으로 옮기는 일');
});

test('large book keeps the index fixed and turns only the selected page in either direction', async ({ page }) => {
  await page.goto('/posts');
  const spread = page.getByRole('dialog');
  await expect(spread).toBeVisible();
  await expect(page.locator('.book-paper')).toBeVisible();
  expect((await spread.boundingBox())!.width).toBeGreaterThan(1300);
  const indexBounds = await page.locator('.book-index').boundingBox();
  await page.locator('.post-card').nth(1).click();
  await expect(page.locator('.book-leaf')).toHaveAttribute('data-direction', 'forward');
  await expect(page.locator('.book-leaf')).toHaveCSS('animation-name', 'leaf-turn');
  await expect(page.locator('.post-card[aria-current=page]')).toContainText('호버가 자꾸 다시 시작되던 이유');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  expect(await page.locator('.book-index').boundingBox()).toEqual(indexBounds);
  await page.getByRole('link', { name: '이전 글', exact: true }).click();
  await expect(page.locator('.book-leaf')).toHaveAttribute('data-direction', 'backward');
  await expect(page.locator('.book-leaf')).toHaveCSS('animation-name', 'leaf-turn-back');
  // Rapid selections replace the moving leaf; no queued animation can restore an old article.
  await page.locator('.post-card').nth(2).click();
  await page.locator('.post-card').nth(1).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('호버가 자꾸 다시 시작되던 이유');
  await expect.poll(() => page.locator('.book-leaf').evaluate(element => element.getAnimations().length)).toBe(0);
  await expect(page.locator('.book-leaf')).toHaveCount(1);
  await page.screenshot({ path: '.local/book-spread.png' });
});

test('table of contents and browser history preserve independent reading positions', async ({ page }) => {
  await page.goto('/posts/building-a-room-on-the-web');
  await page.getByRole('navigation', { name: '목차' }).getByRole('link', { name: '다음에 쌓아갈 것' }).click();
  await expect(page).toHaveURL(/#next$/);
  const position = await page.locator('.book-page-scroll').evaluate(element => element.scrollTop);
  expect(position).toBeGreaterThan(300);
  const indexPosition = await page.locator('.book-index-scroll').evaluate(element => element.scrollTop);
  await page.locator('.post-card').nth(2).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('방에서 출발선의 운전석까지');
  await expect.poll(() => page.locator('.book-page-scroll').evaluate(element => element.scrollTop)).toBe(0);
  expect(await page.locator('.book-index-scroll').evaluate(element => element.scrollTop)).toBe(indexPosition);
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('내 방을 웹으로 옮기는 일');
  // Native fragment alignment can round by one CSS pixel after the page transform.
  await expect.poll(async () => Math.abs(await page.locator('.book-page-scroll').evaluate(element => element.scrollTop) - position)).toBeLessThanOrEqual(1);
});
