import { readdir, readFile } from 'node:fs/promises';
import { basename, join, resolve, relative, isAbsolute } from 'node:path';
import { Marked } from 'marked';
import { parse as parseYaml } from 'yaml';
import sanitizeHtml from 'sanitize-html';
import hljs from 'highlight.js';
import { parseDocument, DomUtils } from 'htmlparser2';
import { imageSize } from 'image-size';

const escape = text => String(text).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const plain = html => DomUtils.textContent(parseDocument(html));
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parsePost(source, file = 'post.md') {
  const match = source.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  const fail = message => { throw new Error(`${file}: ${message}`); };
  if (!match) fail('글 맨 위에 YAML 메타데이터(---)가 필요합니다.');
  let metadata;
  try { metadata = parseYaml(match[1], { maxAliasCount: 0, uniqueKeys: true }); }
  catch (error) { fail(`메타데이터 오류: ${error.message}`); }
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) fail('메타데이터는 필드와 값으로 작성해주세요.');
  for (const field of Object.keys(metadata)) {
    if (!['slug', 'title', 'description', 'date', 'tags', 'draft', 'minutes'].includes(field)) fail(`알 수 없는 필드: ${field}`);
  }
  for (const field of ['title', 'description', 'date']) {
    if (typeof metadata[field] !== 'string' || !metadata[field].trim()) fail(`${field} 필드에 문자열이 필요합니다.`);
  }
  const slug = metadata.slug ?? basename(file, '.md');
  if (typeof slug !== 'string' || !slugPattern.test(slug)) fail('slug는 영문 소문자·숫자·하이픈으로 작성해주세요.');
  const date = metadata.date;
  const parsedDate = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) fail('date는 실제 날짜인 YYYY-MM-DD 형식이어야 합니다.');
  const tags = metadata.tags ?? [];
  if (!Array.isArray(tags) || tags.some(tag => typeof tag !== 'string' || !tag.trim())) fail('tags에는 문자열 목록이 필요합니다.');
  if (metadata.draft !== undefined && typeof metadata.draft !== 'boolean') fail('draft는 true 또는 false여야 합니다.');
  if (metadata.minutes !== undefined && (!Number.isInteger(metadata.minutes) || metadata.minutes < 1)) fail('minutes는 1 이상의 정수여야 합니다.');
  if (!match[2].trim()) fail('본문이 비어 있습니다.');
  return { metadata: { slug, title: metadata.title.trim(), description: metadata.description.trim(), date, tags: [...new Set(tags.map(tag => tag.trim()))], draft: metadata.draft ?? true, minutes: metadata.minutes }, markdown: match[2] };
}

export function compilePost(source, file = 'post.md') {
  const { metadata, markdown } = parsePost(source, file);
  const sections = [];
  const codeBlocks = [];
  const ids = new Set(['journal-main', 'journal-search', 'entries-heading', 'library-title']);
  const parser = new Marked({ gfm: true, async: false, renderer: {
    // Markdown is the authoring format; raw HTML is deliberately not executed.
    html({ text }) { return escape(text); },
    heading({ text, depth }) {
      if (depth === 1) throw new Error(`${file}: 본문 제목은 ##부터 사용해주세요. 글 제목은 title에 작성합니다.`);
      const explicit = text.match(/\s+\{#([\p{L}\p{N}_-]+)\}\s*$/u);
      const label = explicit ? text.slice(0, explicit.index) : text;
      const html = parser.parseInline(label);
      const title = plain(html);
      const base = explicit?.[1] ?? (title.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s+/g, '-') || 'section');
      let id = base;
      for (let suffix = 2; ids.has(id); suffix++) id = `${base}-${suffix}`;
      ids.add(id);
      if (depth === 2) sections.push({ id, title });
      return `<h${depth} id="${escape(id)}">${html}</h${depth}>\n`;
    },
    code({ text, lang }) {
      const language = (lang ?? '').trim().split(/\s+/)[0].toLowerCase() || 'text';
      const highlighted = hljs.getLanguage(language) ? hljs.highlight(text, { language, ignoreIllegals: true }).value : escape(text);
      const index = codeBlocks.push({ language, text }) - 1;
      return `<figure data-code="${index}"><pre><code>${highlighted}</code></pre></figure>\n`;
    },
    paragraph({ tokens }) {
      const meaningful = tokens.filter(token => token.type !== 'text' || token.text.trim());
      if (meaningful.length === 1 && meaningful[0].type === 'image') {
        const token = meaningful[0];
        const image = this.image(token);
        return `<figure class="article-image">${image}${token.title ? `<figcaption>${escape(token.title)}</figcaption>` : ''}</figure>\n`;
      }
      return `<p>${this.parser.parseInline(tokens)}</p>\n`;
    },
    image({ href, text, title }) {
      if (!/^(?:\/(?!\/)|https:\/\/)/i.test(href)) throw new Error(`${file}: 이미지 주소는 /images/... 또는 https://... 형식을 사용해주세요.`);
      if (!text.trim()) throw new Error(`${file}: 이미지의 대체 텍스트가 필요합니다.`);
      return `<img src="${escape(href)}" alt="${escape(text)}"${title ? ` title="${escape(title)}"` : ''} loading="lazy" decoding="async"/>`;
    },
  } });
  const html = sanitizeHtml(parser.parse(markdown), {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'input'],
    allowedAttributes: {
      a: ['href', 'title'], img: ['src', 'alt', 'title', 'loading', 'decoding'],
      h2: ['id'], h3: ['id'], h4: ['id'], h5: ['id'], h6: ['id'],
      span: ['class'], figure: ['class', 'data-code'], ol: ['start'],
      th: ['align'], td: ['align'], input: [{ name: 'type', values: ['checkbox'] }, 'checked', 'disabled'],
    },
    allowedClasses: { span: ['hljs-*', 'language_*', 'function_'], figure: ['article-image'] },
    allowedSchemes: ['http', 'https', 'mailto'], allowProtocolRelative: false,
  });
  // Serialize only sanitized nodes. React renders these without raw HTML or a runtime parser.
  function nodes(elements) {
    return elements.flatMap(element => {
      if (element.type === 'text') return [{ type: 'text', value: element.data }];
      if (element.type !== 'tag') return [];
      if (element.name === 'figure' && element.attribs['data-code'] !== undefined) {
        const block = codeBlocks[Number(element.attribs['data-code'])];
        const code = DomUtils.findOne(node => node.name === 'code', element.children, true);
        return [{ type: 'code', ...block, children: nodes(code?.children ?? []) }];
      }
      const attributes = {};
      for (const [key, value] of Object.entries(element.attribs)) attributes[key === 'class' ? 'className' : key] = ['checked', 'disabled'].includes(key) ? true : value;
      return [{ type: 'element', tag: element.name, attributes, children: nodes(element.children) }];
    });
  }
  const document = parseDocument(html);
  const searchText = DomUtils.textContent(document).replace(/\s+/g, ' ').trim();
  return { ...metadata, minutes: metadata.minutes ?? Math.max(1, Math.ceil(searchText.replace(/\s/g, '').length / 500)), sections, body: nodes(document.children), searchText };
}

export async function loadPosts(directory, { includeDrafts = false, publicDirectory } = {}) {
  const files = (await readdir(directory)).filter(file => file.endsWith('.md')).sort();
  const slugs = new Set();
  const posts = [];
  for (const file of files) {
    const source = await readFile(join(directory, file), 'utf8');
    const { metadata } = parsePost(source, file);
    if (slugs.has(metadata.slug)) throw new Error(`${file}: 중복된 slug: ${metadata.slug}`);
    slugs.add(metadata.slug);
    // A draft's body never enters the module generated for production.
    if (!includeDrafts && metadata.draft) continue;
    const post = compilePost(source, file);
    if (publicDirectory) {
      const visit = async nodes => {
        for (const node of nodes) {
          if (node.type === 'element' && node.tag === 'img' && node.attributes.src.startsWith('/')) {
            const path = resolve(publicDirectory, '.' + decodeURIComponent(new URL(node.attributes.src, 'https://local.invalid').pathname));
            const localPath = relative(publicDirectory, path);
            if (localPath.startsWith('..') || isAbsolute(localPath)) throw new Error(`${file}: 이미지가 public 폴더 밖을 가리킵니다.`);
            try {
              const { width, height } = imageSize(await readFile(path));
              Object.assign(node.attributes, { width, height });
            } catch (error) { throw new Error(`${file}: 이미지를 확인해주세요: ${node.attributes.src} (${error.message})`); }
          }
          if (node.children) await visit(node.children);
        }
      };
      await visit(post.body);
    }
    posts.push(post);
  }
  return posts.sort((a, b) => b.date.localeCompare(a.date));
}
