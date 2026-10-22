import { test, expect } from '@playwright/test';
import { writeFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';

test('both reading modes render images, tables, highlighted code and copy the original code', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  for (const prefix of ['/posts', '/journal/posts']) {
    await page.goto(`${prefix}/building-a-room-on-the-web`);
    const article = page.locator('article.article');
    await expect(article.locator('.article-heading .draft-label')).toHaveCount(0);
    await expect(article.locator('.article-image')).toHaveCount(2);
    const image = article.locator('.article-image img').first();
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
    await expect(image).toHaveAttribute('width', '1440');
    await expect(article.locator('.article-image figcaption').first()).toContainText('실제 웹 화면');
    await expect(article.getByRole('table')).toHaveCount(1);
    await expect(article.locator('.code-block .hljs-title').first()).toBeAttached();
    await article.getByRole('button', { name: '코드 복사', exact: true }).click();
    await expect(article.getByRole('button', { name: '코드 복사 완료' })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('camera.position.lerpVectors');
    await page.screenshot({ path: `.local/markdown-${prefix.includes('journal') ? 'journal' : 'book'}.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/journal/posts/building-a-room-on-the-web');
  await page.locator('.article-table').scrollIntoViewIfNeeded();
  expect(await page.locator('.journal').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.evaluate(() => { Object.defineProperty(navigator.clipboard, 'writeText', { configurable: true, value: async () => { throw new Error('denied'); } }); });
  await page.getByRole('button', { name: '코드 복사', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '복사할 코드' })).toHaveValue(/camera\.position\.lerpVectors/);
  await page.getByRole('textbox', { name: '복사할 코드' }).focus();
  expect(await page.getByRole('textbox', { name: '복사할 코드' }).evaluate((element: HTMLTextAreaElement) => element.selectionEnd - element.selectionStart)).toBeGreaterThan(100);
});

test('adding, editing and deleting one Markdown file updates both views without changing application code', async ({ page }) => {
  const slug = `content-workflow-${process.pid}`;
  const filename = resolve(`tests/fixtures/content/posts/${slug}.md`);
  const source = (body: string) => `---\ntitle: "작성 흐름 확인"\ndescription: "파일 기반 글 작성"\ndate: 2026-10-22\ntags: [작성흐름]\ndraft: true\n---\n\n## 자동 목차\n\n${body}\n`;
  let created = false;
  await page.goto('/journal');
  try {
    await writeFile(filename, source('처음 작성한 본문'), { flag: 'wx' });
    created = true;
    await expect(page.getByRole('heading', { name: '작성 흐름 확인', exact: true })).toBeVisible();
    await page.getByRole('link', { name: /파일 기반 글 작성/ }).click();
    await expect(page).toHaveURL(new RegExp(`/journal/posts/${slug}$`));
    await expect(page.locator('.article-heading .draft-label')).toHaveText('초안');
    await page.getByRole('navigation', { name: '목차' }).getByRole('link', { name: '자동 목차' }).click();
    expect(decodeURIComponent(new URL(page.url()).hash)).toBe('#자동-목차');
    await page.reload();
    await expect(page.locator('[id="자동-목차"]')).toBeInViewport();
    await writeFile(filename, source('수정한 본문과 고유검색어 xyzneedle'));
    await expect(page.locator('.markdown-body')).toContainText('수정한 본문');
    await page.goto(`/posts/${slug}`);
    await expect(page.locator('.markdown-body')).toContainText('수정한 본문');
    await page.goto('/journal?q=xyzneedle');
    await expect(page.locator('.journal-entry')).toHaveCount(1);
    await page.locator('.journal-entry').click();
    await unlink(filename);
    created = false;
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('페이지를 찾을 수 없습니다.');
    await page.goto('/posts');
    await expect(page.locator('.post-card')).toHaveCount(3);
  } finally {
    if (created) await unlink(filename);
  }
});
