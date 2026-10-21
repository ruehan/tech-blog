export type MarkdownNode =
  | { type: 'text'; value: string }
  | { type: 'element'; tag: string; attributes: Record<string, string | boolean | number>; children: MarkdownNode[] }
  | { type: 'code'; language: string; text: string; children: MarkdownNode[] };

export interface Post {
  slug: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
  draft: boolean;
  minutes: number;
  sections: { id: string; title: string }[];
  body: MarkdownNode[];
  searchText: string;
}
