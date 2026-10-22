import { test, expect } from '@playwright/test';

test('journal reads and shares articles without loading the 3D scene', async ({ page, context }) => {
  const sceneRequests: string[] = [];
  page.on('request', request => {
    if (/\.glb(?:\?|$)|WorldScene|\/three\./.test(request.url())) sceneRequests.push(request.url());
  });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/journal');
  await expect(page.locator('.journal-header a')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('글 3');
  await expect(page.locator('.journal-entry')).toHaveCount(3);
  await page.screenshot({ path: '.local/journal-desktop.png', fullPage: true });
  await page.getByRole('link', { name: /호버가 자꾸 다시 시작되던 이유/ }).click();
  await expect(page).toHaveURL(/\/journal\/posts\/making-hover-transitions-smooth$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await expect(page).toHaveTitle('호버가 자꾸 다시 시작되던 이유 — hangyu / room');
  await page.getByRole('navigation', { name: '목차' }).getByRole('link', { name: '메시보다 상호작용 단위로 판단하기' }).click();
  await expect(page).toHaveURL(/#interaction-root$/);
  await expect(page.locator('.article-body pre')).toContainText('function interaction');
  await page.getByRole('button', { name: '링크 복사' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/journal\/posts\/making-hover-transitions-smooth$/);
  await page.getByRole('navigation', { name: '글 이동' }).getByRole('link', { name: '이전 글 내 방을 웹으로 옮기는 일' }).click();
  await expect(page).toHaveURL(/\/journal\/posts\/building-a-room-on-the-web$/);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('내 방을 웹으로 옮기는 일');
  await expect(page.locator('canvas, dialog')).toHaveCount(0);
  expect(sceneRequests).toEqual([]);
  await page.screenshot({ path: '.local/journal-article.png' });
});

test.describe('desk clock and calendar', () => {
  test.use({ timezoneId: 'Asia/Seoul' });

  test('local time and calendar update across midnight and leap day', async ({ page }) => {
    await page.clock.install({ time: new Date('2028-02-29T14:59:30Z') });
    await page.clock.pauseAt(new Date('2028-02-29T14:59:31Z'));
    await page.goto('/journal');
    await expect(page.getByRole('group', { name: '현재 시간' })).toContainText('23:59');
    await expect(page.getByRole('table', { name: '2028년 2월 달력' })).toBeVisible();
    await expect(page.locator('.desk-calendar tbody time')).toHaveCount(29);
    await expect(page.locator('.desk-calendar [aria-current=date]')).toHaveAttribute('datetime', '2028-02-29');
    await expect(page.locator('.clock-second-hand')).toHaveAttribute('transform', 'rotate(186 80 80)');
    await page.clock.fastForward(28_000);
    await expect(page.locator('.clock-second-hand')).toHaveAttribute('transform', 'rotate(354 80 80)');
    await page.clock.fastForward(1_000);
    await expect(page.locator('.clock-second-hand')).toHaveAttribute('transform', 'rotate(0 80 80)');
    await expect(page.getByRole('group', { name: '현재 시간' })).toContainText('00:00');
    await expect(page.getByRole('table', { name: '2028년 3월 달력' })).toBeVisible();
    await expect(page.locator('.desk-calendar tbody time')).toHaveCount(31);
    await expect(page.locator('.desk-calendar [aria-current=date]')).toHaveAttribute('datetime', '2028-03-01');
    const arrangement = await page.locator('.desk-objects').getAttribute('data-arrangement');
    await page.getByRole('navigation', { name: '태그 필터' }).getByRole('link', { name: 'React', exact: true }).click();
    await expect(page.locator('.desk-objects')).toHaveAttribute('data-arrangement', arrangement!);
    await page.locator('.journal-entry').first().click();
    await expect(page.locator('.desk-objects')).toHaveCount(0);
    await page.getByRole('link', { name: '기록 목록', exact: true }).click();
    await expect(page.locator('.desk-objects')).toHaveAttribute('data-arrangement', arrangement!);
  });

  test('random desk coordinates stay clear of articles, each other and narrow screens', async ({ page }) => {
    for (const arrangement of [0, 1, 2]) {
      await page.addInitScript(value => { Math.random = () => (value + 0.1) / 3; }, arrangement);
      for (const width of [2560, 1440, 1280, 1100, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/journal');
        const desk = page.locator('.desk-objects');
        await expect(desk).toHaveAttribute('data-arrangement', String(Math.floor((arrangement + 0.1) / 3 * 0x100000000)));
        await expect(desk).toHaveAttribute('data-layout', width >= 1280 ? 'free' : 'stack');
        await desk.scrollIntoViewIfNeeded();
        const articles = (await page.locator('.journal-entries').boundingBox())!;
        const objects = [page.locator('.desk-clock'), page.locator('.desk-calendar'), page.locator('.now-note'), page.locator('.start-lights')];
        const rectangles = [];
        for (const object of objects) {
          const bounds = (await object.boundingBox())!;
          expect(bounds.x).toBeGreaterThanOrEqual(0);
          expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
          expect(bounds.x + bounds.width <= articles.x || bounds.x >= articles.x + articles.width || bounds.y >= articles.y + articles.height).toBe(true);
          rectangles.push(bounds);
        }
        for (const [index, a] of rectangles.entries()) for (const b of rectangles.slice(index + 1)) expect(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y).toBe(true);
        expect(await page.locator('.journal').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
        if (width === 1440 || width === 390) await page.screenshot({ path: `.local/desk-${arrangement}-${width}.png` });
      }
    }
  });
});

test('body search includes headings, lists and code, and clearing preserves the selected tag', async ({ page }) => {
  await page.goto('/journal?tag=3D');
  const input = page.getByRole('searchbox', { name: '글 검색' });
  // These terms occur only in the article's code, with deliberately mixed casing and spacing.
  await input.fill('  CAMERA.POSITION.SET   QUATERNION  ');
  await input.press('Enter');
  await expect(page.locator('.journal-entry')).toHaveCount(1);
  await expect(page.locator('.journal-entry')).toContainText('방에서 출발선의 운전석까지');
  await page.reload();
  await expect(page.locator('.journal-entry')).toHaveCount(1);
  await page.getByRole('button', { name: '검색어 지우기' }).click();
  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();
  await expect(page).toHaveURL(/\/journal\?tag=3D$/);
  await expect(page.locator('.journal-entry')).toHaveCount(2);
  await input.fill('입구로 삼기');
  await input.press('Enter');
  await expect(page.locator('.journal-entry')).toHaveCount(1);
  await expect(page.locator('.journal-entry')).toContainText('내 방을 웹으로 옮기는 일');
  await page.getByRole('button', { name: '검색어 지우기' }).click();
  await input.fill('회전과 확대');
  await input.press('Enter');
  await expect(page.getByRole('heading', { name: '아직 찾는 기록이 없어요.' })).toBeVisible();
  await page.goto('/journal?tag=React&q=' + encodeURIComponent('같은 오브젝트 안에서 메시'));
  await expect(page.locator('.journal-entry')).toHaveCount(1);
  await expect(page.locator('.journal-entry')).toContainText('호버가 자꾸 다시 시작되던 이유');
});

test('article navigation stays in filtered results and restores the list scroll position', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await page.goto('/journal?tag=3D&q=' + encodeURIComponent('카메라'));
  const list = page.locator('.journal');
  const entries = page.locator('.journal-entry');
  await expect(entries).toHaveCount(2);
  await entries.last().scrollIntoViewIfNeeded();
  await expect.poll(() => list.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  const position = await list.evaluate(element => element.scrollTop);
  await entries.last().click();
  const nav = page.getByRole('navigation', { name: '글 이동' });
  await expect(nav.getByRole('link', { name: /^다음 글/ })).toHaveCount(0);
  await nav.getByRole('link', { name: /^이전 글/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('내 방을 웹으로 옮기는 일');
  expect(new URL(page.url()).searchParams.get('q')).toBe('카메라');
  await expect(nav.getByRole('link', { name: /^이전 글/ })).toHaveCount(0);
  await nav.getByRole('link', { name: /^다음 글/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('방에서 출발선의 운전석까지');
  await nav.scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.local/journal-pagination-mobile.png' });
  await nav.getByRole('link', { name: '글 목록', exact: true }).click();
  await expect(page.getByRole('searchbox')).toHaveValue('카메라');
  await expect(entries).toHaveCount(2);
  await expect.poll(async () => Math.abs(await list.evaluate(element => element.scrollTop) - position)).toBeLessThan(3);
});

test('journal search and tags combine, survive back navigation, and handle empty results', async ({ page }) => {
  await page.goto('/journal');
  await page.getByRole('navigation', { name: '태그 필터' }).getByRole('link', { name: 'React', exact: true }).click();
  await expect(page.locator('.journal-entry')).toHaveCount(2);
  await page.getByRole('searchbox', { name: '글 검색' }).fill('호버');
  await page.getByRole('button', { name: '검색', exact: true }).click();
  await expect(page.locator('.journal-entry')).toHaveCount(1);
  await page.locator('.journal-entry').click();
  await page.getByRole('link', { name: '기록 목록', exact: true }).click();
  await expect(page.getByRole('searchbox')).toHaveValue('호버');
  await expect(page.locator('.journal-entry')).toHaveCount(1);
  await page.getByRole('searchbox').fill('없는 기록');
  await page.getByRole('searchbox').press('Enter');
  await expect(page.getByRole('heading', { name: '아직 찾는 기록이 없어요.' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('searchbox')).toHaveValue('호버');
  await expect(page.locator('.journal-entry')).toHaveCount(1);
  await page.getByRole('link', { name: '필터 지우기' }).click();
  await expect(page.locator('.journal-entry')).toHaveCount(3);
});

test('journal project and missing routes stay in the ordinary blog', async ({ page }) => {
  await page.goto('/journal/projects');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('프로젝트');
  await page.getByRole('link', { name: '프로젝트 자세히 보기' }).click();
  await expect(page).toHaveURL(/\/journal\/projects\/hangyu-room$/);
  await expect(page.getByRole('heading', { name: '지금까지 만든 경험' })).toBeVisible();
  await page.getByRole('link', { name: '내 방을 웹으로 옮기는 일' }).click();
  await expect(page).toHaveURL(/\/journal\/posts\/building-a-room-on-the-web$/);
  await page.goto('/journal/posts/missing');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('페이지를 찾을 수 없습니다.');
  await page.getByRole('link', { name: '기록 목록으로' }).click();
  await expect(page).toHaveURL(/\/journal$/);
  await expect(page.locator('canvas, dialog')).toHaveCount(0);
});

test('journal is reachable before 3D loads and returning remounts a working room', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: '일반 블로그로 보기' }).click();
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.getByRole('link', { name: '3D 방으로', exact: true }).click();
  await expect(page.locator('main.app')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('button', { name: '조명 끄기', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '글 목록 열기' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '목록 닫기' }).click();
  await page.getByRole('button', { name: '일반 블로그로 보기' }).click();
  await page.goBack();
  await expect(page.locator('main.app')).toHaveAttribute('data-ready', 'true');
  await page.goForward();
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.locator('.journal')).toBeVisible();
});

test('switching to the journal cancels a pending desktop folder', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '컴퓨터 02' }).click();
  await page.getByRole('button', { name: 'Projects 폴더 열기' }).click();
  await page.getByRole('button', { name: '일반 블로그로 보기' }).click();
  await page.waitForTimeout(3000);
  await expect(page).toHaveURL(/\/journal$/);
  await expect(page.locator('canvas, dialog')).toHaveCount(0);
  await page.getByRole('link', { name: '3D 방으로', exact: true }).click();
  await expect(page.locator('main.app')).toHaveAttribute('data-world', 'room');
  await expect(page.locator('main.app')).toHaveAttribute('data-ready', 'true');
});

test('mobile journal keeps navigation reachable and articles within the viewport', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 640 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/journal');
    const menu = page.getByRole('navigation', { name: '블로그 메뉴' });
    const bounds = (await menu.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
    await page.screenshot({ path: `.local/journal-${viewport.width}.png` });
    await page.locator('.journal-entry').nth(1).click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.locator('.journal').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.locator('.code-block').scrollIntoViewIfNeeded();
    expect(await page.locator('.journal').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await menu.getByRole('link', { name: '프로젝트', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('프로젝트');
    await menu.getByRole('link', { name: '글 기록', exact: true }).click();
    await expect(page).toHaveURL(/\/journal$/);
  }
});
