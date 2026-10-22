export type MarkdownNode =
  | { type: 'text'; value: string }
  | { type: 'element'; tag: string; attributes: Record<string, string | boolean | number>; children: MarkdownNode[] }
  | { type: 'code'; id?: string; language: string; text: string; children: MarkdownNode[] };

export interface Post {
  slug: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
  draft: boolean;
  minutes: number;
  series?: { slug: string; title: string; order: number };
  image?: string;
  sections: { id: string; title: string }[];
  body: MarkdownNode[];
  searchText: string;
  searchBlocks: { id: string; text: string }[];
}
