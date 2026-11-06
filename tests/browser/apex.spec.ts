import { test, expect } from '@playwright/test';

const article = '/writing/building-a-room-on-the-web';

test('APEX search, tags, sorting and series keep their URLs and history', async ({ page }) => {
  await page.goto('/writing');
  await expect(page.locator('.archive-entry')).toHaveCount(3);
  await page.getByRole('group', { name: '태그 필터' }).getByRole('button', { name: '3D', exact: true }).click();
  await expect(page.locator('.archive-entry')).toHaveCount(2);
  await page.getByRole('searchbox').fill('CAMERA.POSITION.SET quaternion');
  await page.getByRole('searchbox').press('Enter');
  await expect(page.locator('.archive-entry')).toHaveCount(1);
  await page.locator('.archive-entry').click();
  await expect(page).toHaveURL(/#search-block-/);
  await expect(page.locator('[data-search-match=true]')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('searchbox')).toHaveValue('CAMERA.POSITION.SET quaternion');
  await page.getByRole('link', { name: '필터 지우기' }).click();
  await page.getByRole('combobox', { name: '글 정렬' }).selectOption('oldest');
  await expect(page.locator('.archive-entry').first()).toContainText('방에서 출발선의 운전석까지');
  await page.goto(article);
  await page.locator('.article-series summary').click();
  await page.getByRole('navigation', { name: '시리즈 순서' }).getByRole('link', { name: '다음 편' }).click();
  await expect(page).toHaveURL(/\/writing\/making-hover-transitions-smooth$/);
  await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', 'noindex, follow');
});

test('reading tools, clipboard, sticky outline, and image focus work in the new layout', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(article);
  await page.getByRole('button', { name: '읽기 설정', exact: true }).click();
  const settings = page.getByRole('region', { name: '읽기 설정', exact: true });
  await settings.getByRole('radio', { name: '크게', exact: true }).check();
  await settings.getByRole('button', { name: '읽기 설정 닫기' }).click();
  await expect(page.locator('.article-body')).toHaveCSS('font-size', '20px');
  const toc = page.getByRole('navigation', { name: '목차' });
  await toc.getByRole('link', { name: '장면과 콘텐츠의 역할' }).click();
  await expect(toc).toBeInViewport();
  await expect(page.locator('#scene-and-content')).toBeInViewport();
  await page.getByRole('button', { name: '코드 복사', exact: true }).first().click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('camera.position.lerpVectors');
  const trigger = page.getByRole('button', { name: /^이미지 확대:/ }).first();
  await trigger.click();
  await expect(page.getByRole('dialog', { name: '이미지 크게 보기' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await page.getByRole('button', { name: '글 주소 복사', exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/writing\/building-a-room-on-the-web$/);
});

test('mobile dark theme and reading preferences persist across reload and the landing', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(article);
  await page.getByRole('button', { name: '다크 모드로 변경' }).click();
  await page.getByRole('button', { name: '읽기 설정', exact: true }).click();
  const settings = page.getByRole('region', { name: '읽기 설정', exact: true });
  await settings.getByRole('radio', { name: '크게', exact: true }).check();
  await settings.getByRole('button', { name: '읽기 설정 닫기' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.article-body')).toHaveCSS('font-size', '19px');
  await page.locator('#article-toc summary').click();
  await page.getByRole('navigation', { name: '목차' }).getByRole('link', { name: '장면과 콘텐츠의 역할' }).click();
  await expect(page.locator('#article-toc')).not.toHaveAttribute('open');
  expect(await page.locator('.apex-site').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#portal')).toBeVisible();
});

test('page transitions can be cancelled and project records override the profile fallback', async ({ page }) => {
  await page.goto('/writing');
  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link', { name: '프로젝트' }).click();
  await expect(page.locator('.page-loader')).toHaveClass(/is-loading/);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/writing$/);
  await expect(page.locator('.apex-site')).not.toHaveAttribute('inert');
  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link', { name: '프로젝트' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('프로젝트');
  await expect(page.locator('.case-preview').filter({ has: page.getByRole('heading', { name: 'hangyu / room', exact: true }) })).toHaveCount(1);
  await page.locator('.case-preview').first().getByRole('link', { name: '만든 과정 보기' }).click();
  await expect(page.locator('.apex-project-previews')).toBeVisible();
  await expect(page.locator('.apex-project-updates')).toBeVisible();
});

test('article and about pages retain the reference template structure', async ({ page }) => {
  await page.goto(article);
  await expect(page.locator('.detail-page > .article-heading')).toBeVisible();
  await expect(page.locator('.reading-layout > .article-toc')).toBeVisible();
  await expect(page.locator('.reading-layout > article.prose')).toBeVisible();
  const toc = (await page.locator('.article-toc').boundingBox())!;
  const prose = (await page.locator('.prose').boundingBox())!;
  expect(toc.x + toc.width).toBeLessThan(prose.x);
  await page.goto('/about');
  await expect(page.locator('.profile-layout > .profile-intro')).toContainText('코드를 쓰는 시간,');
  await expect(page.locator('.profile-layout > .profile-story > section')).toHaveCount(3);
  await expect(page.locator('.about-photo img')).toHaveAttribute('src', '/apex/assets/n-festival.jpg');
  await expect(page.locator('.profile-experience')).toHaveCount(2);
  await expect(page.getByRole('heading', { name: '직무와 경력' })).toBeVisible();
});

test('original race filters, photos, detail pages and credits are preserved', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/races/');
  await expect(page.locator('.race-lead')).toBeVisible();
  await expect(page.locator('#race-grid .race-card')).toHaveCount(4);
  await page.getByRole('button', { name: 'TCR', exact: true }).click();
  await expect(page.locator('#race-grid .race-card:visible')).toHaveCount(1);
  await page.getByRole('button', { name: '사진으로 보기', exact: true }).click();
  await expect(page.locator('#photo-wall .photo-tile:visible')).toHaveCount(1);
  await page.locator('#photo-wall .photo-tile:visible button').click();
  await expect(page.getByRole('dialog', { name: '사진 확대 보기' })).toBeVisible();
  await expect(page.locator('#photo-image')).toHaveAttribute('src', '/apex/assets/tcr.jpg');
  await page.getByRole('button', { name: '사진 닫기' }).click();
  await page.getByRole('button', { name: '글로 보기', exact: true }).click();
  await page.locator('#race-grid .race-card:visible').click();
  await expect(page).toHaveURL(/\/races\/tcr\/$/);
  await expect(page.locator('.reading-layout .prose')).toContainText('샘플');
  await expect(page.getByRole('navigation', { name: '글 목차' })).toBeVisible();
  await page.getByRole('button', { name: '사진 출처', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '사진 출처' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('reference search dialog includes real articles and projects on the landing and inside pages', async ({ page }) => {
  for (const path of ['/', '/writing', '/races/']) {
    await page.goto(path);
    await page.getByRole('button', { name: '글 검색', exact: true }).click();
    const search = page.getByRole('dialog', { name: '기록 검색' });
    await expect(search).toBeVisible();
    await search.getByRole('searchbox').fill('내 방을 웹으로');
    await expect(search.getByRole('link')).toHaveCount(1);
    await expect(search.getByRole('link')).toHaveAttribute('href', '/writing/building-a-room-on-the-web');
    await page.keyboard.press('Escape');
    await expect(search).not.toBeVisible();
  }
});
