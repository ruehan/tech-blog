import { test, expect } from '@playwright/test';

const newest = ['내 방을 웹으로 옮기는 일', '호버가 자꾸 다시 시작되던 이유', '방에서 출발선의 운전석까지'];

test('journal sorting survives filters, reading, reload and history', async ({ page }) => {
  await page.goto('/journal');
  const titles = page.locator('.journal-entry h2');
  const sort = page.getByRole('combobox', { name: '글 정렬' });
  await expect(sort).toHaveValue('newest');
  await expect(titles).toHaveText(newest);
  await sort.selectOption('oldest');
  await expect(titles).toHaveText([...newest].reverse());
  await page.getByRole('searchbox').fill('React');
  await page.getByRole('searchbox').press('Enter');
  await page.getByRole('navigation', { name: '태그 필터' }).getByRole('link', { name: 'React', exact: true }).click();
  await expect(titles).toHaveText([newest[1], newest[0]]);
  await expect(sort).toHaveValue('oldest');
  await page.locator('.journal-entry').first().click();
  await page.getByRole('link', { name: `다음 글 ${newest[0]}` }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(newest[0]);
  await page.getByRole('link', { name: '기록 목록', exact: true }).click();
  await page.reload();
  await expect(sort).toHaveValue('oldest');
  await expect(titles).toHaveText([newest[1], newest[0]]);
  await page.getByRole('link', { name: '필터 지우기' }).click();
  await expect(sort).toHaveValue('oldest');
  await sort.selectOption('title');
  await expect(titles).toHaveText([newest[0], newest[2], newest[1]]);
  await page.goBack();
  await expect(sort).toHaveValue('oldest');
  await sort.selectOption('newest');
  await expect(page).toHaveURL(/\/journal$/);
});

test('book sorting keeps the selected article and ordered page navigation', async ({ page }) => {
  await page.goto('/posts');
  const titles = page.locator('.post-card h3');
  const sort = page.getByRole('combobox', { name: '글 정렬' });
  await sort.selectOption('oldest');
  await expect(titles).toHaveText([...newest].reverse());
  await page.locator('.post-card').first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(newest[2]);
  await sort.selectOption('title');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(newest[2]);
  await page.getByRole('link', { name: '다음 글', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(newest[1]);
  await page.locator('.tag-filters').getByRole('link', { name: 'React', exact: true }).click();
  await expect(sort).toHaveValue('title');
  await expect(titles).toHaveText([newest[0], newest[1]]);
  await page.reload();
  await expect(sort).toHaveValue('title');
  await page.setViewportSize({ width: 320, height: 800 });
  await expect(sort).toBeVisible();
  await sort.selectOption('newest');
  await expect(titles).toHaveText([newest[0], newest[1]]);
  await page.goto('/journal?sort=invalid');
  await expect(page.getByRole('combobox', { name: '글 정렬' })).toHaveValue('newest');
  await expect(page.locator('.journal-entry h2')).toHaveText(newest);
});
