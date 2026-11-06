import { projects, type Project } from './project-data';
import { profile } from './profile';

// Existing project records take precedence; profile projects fill the previously empty archive.
const slugs = ['room-experience', 'bytepet', 'ddang', 'rd-workos'];
const covers: Record<string, { src: string; alt: string }> = {
  'room-experience': { src: '/images/site/room.png', alt: 'Blender로 만든 hangyu의 3D 방' },
  bytepet: { src: '/images/posts/bytepet-desktop-companion/bytepet-yard.png', alt: 'BytePet의 작은 캐릭터와 마당' },
};
const fromProfile: Project[] = profile.projects.map((project, index) => ({
  slug: slugs[index], title: project.name, subtitle: project.context,
  description: project.description, status: project.context.split(' · ')[0],
  tags: project.tools, cover: covers[slugs[index]], previews: [], updates: [],
  sections: [{ title: '프로젝트 소개', text: project.description }],
  ...(project.name === 'BytePet' ? { series: 'building-bytepet' } : {}),
  action: project.postSlug ? { href: `/writing/${project.postSlug}`, label: '제작기 읽기' }
    : project.reference ? { href: project.reference.href, label: project.reference.label } : undefined,
}));

export const apexProjects = [...projects, ...fromProfile.filter(item => !projects.some(existing => existing.slug === item.slug || existing.title === item.title))];

export function writingPath(path: string) {
  if (path === '/journal' || path === '/posts') return '/writing';
  return path.replace(/^\/(?:journal\/posts|posts)\//, '/writing/').replace(/^\/journal\/projects/, '/projects');
}
