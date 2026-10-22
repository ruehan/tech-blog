import data from '../content/projects.json';

export interface Project {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  status: string;
  tags: string[];
  cover?: { src: string; alt: string };
  previews: { label: string; image: string; alt: string; description: string; href: string; action: string }[];
  updates: { date: string; text: string }[];
  sections: { title: string; text?: string; items?: string[] }[];
  series?: string;
  action?: { href: string; label: string };
}

export const projects: Project[] = data;
