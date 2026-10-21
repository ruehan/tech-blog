import { readFile, writeFile } from 'node:fs/promises';

const [slug, title] = process.argv.slice(2);
if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  console.error('사용법: npm run post -- my-post "글 제목"');
  process.exitCode = 1;
} else {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const template = await readFile(new URL('../content/post-template.md', import.meta.url), 'utf8');
  const source = template.replace('title: "글 제목"', `title: ${JSON.stringify(title || slug)}`).replace(/^date: .*$/m, `date: ${date}`);
  try {
    await writeFile(new URL(`../content/posts/${slug}.md`, import.meta.url), source, { flag: 'wx' });
    console.log(`content/posts/${slug}.md 초안을 만들었습니다.`);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    console.error(`이미 content/posts/${slug}.md 파일이 있습니다. 덮어쓰지 않았습니다.`);
    process.exitCode = 1;
  }
}
