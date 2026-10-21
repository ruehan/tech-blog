export type ContentBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'code'; language: string; text: string }
  | { type: 'note'; text: string };
export interface Post {
  slug: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
  minutes: number;
  sections: { id: string; title: string; blocks: ContentBlock[] }[];
}

// These initial articles are editable drafts based on the work in this repository.
export const posts: Post[] = [
  {
    slug: 'building-a-room-on-the-web', title: '내 방을 웹으로 옮기는 일',
    description: '책장, 컴퓨터, 베이스, 그리고 심레이싱. 관심사가 놓인 공간을 블로그의 입구로 만드는 과정.',
    date: '2026-10-21', tags: ['React', '3D'], minutes: 3,
    sections: [
      { id: 'a-room-as-an-entry', title: '공간을 입구로 삼기', blocks: [
        { type: 'paragraph', text: '이 블로그는 작은 방에서 시작한다. 책장에는 글을, 컴퓨터에는 프로젝트를 연결한다. 음악과 심레이싱도 같은 공간에 놓아 개발 이외의 관심사를 함께 드러내려 한다.' },
        { type: 'paragraph', text: '첫 구현에서는 방을 돌아보고 오브젝트에 반응하는 경험을 만들었다. 이제 책을 누르면 글 목록을 펼치고, 글을 선택하면 읽기에 집중할 수 있는 화면으로 이동한다. 공간을 둘러보는 속도와 글을 읽는 속도를 각각 존중하는 구성이다.' },
      ] },
      { id: 'scene-and-content', title: '장면과 콘텐츠의 역할', blocks: [
        { type: 'paragraph', text: 'React는 메뉴와 글 화면을, React Three Fiber는 3D 장면을 담당한다. 방과 컴퓨터, 서킷은 각각의 GLB 파일로 나뉘며 필요한 월드에 들어갈 때 불러온다.' },
        { type: 'list', items: ['방: 책과 악기, 모니터의 상호작용과 조명', '컴퓨터: 프로젝트를 탐색하는 데스크톱', '서킷: 출발선 위 차량의 운전석 시점'] },
        { type: 'paragraph', text: '글을 읽는 동안에는 방의 렌더링을 쉬게 한다. 방으로 돌아오면 카메라와 조명 상태를 이어받으므로, 글 하나를 읽을 때마다 오프닝을 기다릴 필요가 없다.' },
      ] },
      { id: 'small-transitions', title: '작은 전환이 만드는 차이', blocks: [
        { type: 'paragraph', text: '첫 화면을 만드는 것보다 화면 사이를 잇는 일이 더 까다로웠다. 오프닝의 마지막 프레임과 기본 카메라의 확대 배율이 달라 전환이 툭 끊겼다. 마지막 자세를 유지한 채 기본 배율로 짧게 보간하면서 이 문제를 줄였다.' },
        { type: 'note', text: '장면이 바뀌는 순간에도 사용자가 보고 있던 위치와 상태를 가능한 한 이어가는 것이 이번 구현의 기준이다.' },
      ] },
      { id: 'next', title: '다음에 쌓아갈 것', blocks: [
        { type: 'paragraph', text: '먼저 실제 글과 프로젝트 기록을 쌓고, 읽는 과정에서 필요한 기능을 추가하려 한다. 공간의 재미와 글의 가독성을 함께 다듬는 작업은 계속된다.' },
      ] },
    ],
  },
  {
    slug: 'making-hover-transitions-smooth', title: '호버가 자꾸 다시 시작되던 이유',
    description: '하나의 오브젝트 안에서 반복되던 진입 동작. 포인터 이벤트와 애니메이션 전환을 함께 살펴봤다.',
    date: '2026-10-21', tags: ['React', '인터랙션'], minutes: 3,
    sections: [
      { id: 'symptom', title: '마우스는 그대로인데 동작은 다시 시작된다', blocks: [
        { type: 'paragraph', text: '모니터 위에서 포인터를 조금 움직이면 테두리 효과가 처음부터 다시 나타났다. 화면에서는 하나의 모니터지만, 3D 모델 안에는 화면과 프레임처럼 여러 메시가 있다. 한 메시를 떠나는 이벤트를 모니터 전체를 떠난 것으로 해석하고 있었다.' },
      ] },
      { id: 'interaction-root', title: '메시보다 상호작용 단위로 판단하기', blocks: [
        { type: 'paragraph', text: '포인터가 닿은 메시에서 부모를 따라 올라가 상호작용 식별자를 찾는다. 같은 식별자 안의 이동은 동일한 호버 상태로 유지한다. 하위 메시 사이에서 잠깐 발생하는 이탈은 100밀리초 동안 기다렸다가 확정한다.' },
        { type: 'code', language: 'TypeScript', text: "function interaction(object: Object3D | null): string | null {\n  while (object) {\n    if (object.userData.interaction_id) {\n      return object.userData.interaction_id;\n    }\n    object = object.parent;\n  }\n  return null;\n}" },
        { type: 'paragraph', text: 'HTML 안내 버튼과 캔버스 사이를 오갈 때도 같은 기준을 적용한다. 버튼 위에서는 버튼이 포인터를 소유하고, 이미 지나간 메시 정보로 호버가 되돌아가지 않도록 처리했다.' },
      ] },
      { id: 'blend', title: '자세와 발광을 함께 연결하기', blocks: [
        { type: 'paragraph', text: '이벤트만 안정화해도 애니메이션 교체 시점의 끊김은 남았다. 이전 동작을 즉시 정지하면 모델이 기본 자세로 돌아가기 때문이다. 진입·유지·복귀 사이를 0.16초 동안 혼합하고, 별도 데이터로 재생하는 발광 효과에도 같은 전환을 적용했다.' },
        { type: 'list', items: ['같은 오브젝트 안에서 메시를 바꾸어도 진입을 반복하지 않는다.', '짧게 이탈했다 돌아오면 유지 상태가 이어진다.', '진입 도중 실제로 떠나거나 다시 들어와도 자세가 갑자기 바뀌지 않는다.'] },
      ] },
      { id: 'verification', title: '프레임으로 확인하기', blocks: [
        { type: 'paragraph', text: '브라우저에서 포인터를 실제로 움직이고 매 프레임의 크기와 위치를 기록했다. 네 오브젝트의 유지 상태, 빠른 재진입, 동작 중 방향 전환을 검사했다. 최종 화면뿐 아니라 그 화면에 도착하는 과정도 확인해야 했다.' },
      ] },
    ],
  },
  {
    slug: 'from-the-room-to-the-cockpit', title: '방에서 출발선의 운전석까지',
    description: '서킷을 내려다보던 카메라를 운전석으로 옮기며, 원본 에셋의 카메라 정보를 연결한 기록.',
    date: '2026-10-21', tags: ['3D', '심레이싱'], minutes: 2,
    sections: [
      { id: 'driver-view', title: '도착할 시점을 먼저 정하기', blocks: [
        { type: 'paragraph', text: '심레이싱 장비를 누르면 모니터를 향한 접근 연출을 거쳐 서킷으로 들어간다. 처음에는 전체 서킷을 보여줬지만, 장비에 앉아 들어가는 경험에는 출발선의 운전석 시점이 더 잘 맞았다.' },
      ] },
      { id: 'authored-camera', title: '에셋에 이미 있던 카메라', blocks: [
        { type: 'paragraph', text: '월드 에셋의 설명에는 출발 콕핏 카메라 위치와 시야각이 기록되어 있었다. 운전자 차량을 서킷의 지정 위치에 놓고, 카메라도 같은 좌표계를 사용하도록 연결했다.' },
        { type: 'code', language: 'TypeScript', text: 'camera.position.set(-3, 0.85, -0.10);\ncamera.quaternion.identity();\ncamera.fov = 49.55;\ncamera.near = 0.03;\ncamera.updateProjectionMatrix();' },
        { type: 'paragraph', text: '운전석에서는 전방인 -Z 방향을 바라본다. 가까운 핸들과 콕핏이 잘리지 않도록 근거리 클리핑 평면을 조정하고, 기본 방 화면의 추가 확대가 남지 않도록 카메라 확대 배율도 초기화했다.' },
      ] },
      { id: 'stay-in-seat', title: '운전석에 머무르기', blocks: [
        { type: 'paragraph', text: '운전석에는 궤도 회전을 적용하지 않는다. 드래그나 스크롤로 카메라가 차량 밖으로 빠져나가는 일을 막고, 전체 서킷과 차량 외부는 별도 시점 버튼으로 볼 수 있게 했다. 시점 초기화는 다시 운전석으로 돌아온다.' },
        { type: 'note', text: '현재 구현은 운전석에서 서킷을 바라보는 공간 탐색이다. 차량 주행과 물리 시뮬레이션은 아직 포함하지 않았다.' },
      ] },
    ],
  },
];

export const project = {
  slug: 'hangyu-room', title: 'hangyu / room', subtitle: '관심사가 놓인 방, 글이 쌓이는 블로그.',
  description: '방의 오브젝트를 통해 개발 기록과 프로젝트, 음악과 심레이싱을 탐색하는 개인 공간.',
  tags: ['React', 'TypeScript', 'React Three Fiber'],
};
export const allTags = [...new Set(posts.flatMap(post => post.tags))];
export const formatDate = (date: string) => date.replaceAll('-', '.');

const normalizeSearch = (text: string) => text.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
export function filterPosts(tag: string, query: string) {
  const terms = normalizeSearch(query).split(' ').filter(Boolean);
  return posts.filter(post => {
    if (tag && !post.tags.includes(tag)) return false;
    const text = normalizeSearch([
      post.title, post.description, ...post.tags,
      ...post.sections.flatMap(section => [section.title, ...section.blocks.flatMap(block => block.type === 'list' ? block.items : [block.text])]),
    ].join(' '));
    return terms.every(term => text.includes(term));
  });
}
