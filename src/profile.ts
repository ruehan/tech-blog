interface WorkGroup {
  title: string;
  items: string[];
  reference?: { label: string; href: string };
}
interface Experience {
  organization: string;
  period: string;
  role: string;
  details: string;
  work: WorkGroup[];
}
interface ProfileProject {
  name: string;
  context: string;
  description: string;
  tools: string[];
  postSlug?: string;
  reference?: { label: string; href: string };
}

export const profile = {
  name: 'hangyu',
  description: '풀스택 개발자이자 응용 AI 연구자 hangyu의 경력과 프로젝트. 웨어러블 센싱, 차량 음성 시스템, 웹·데스크톱 앱을 만듭니다.',
  role: '풀스택 개발자 · 응용 AI 연구자',
  email: 'ruehan98@gmail.com',
  github: 'https://github.com/ruehan',
  portfolio: 'https://hangyu-field-notes.vercel.app/',
  introduction: [
    '웨어러블 센싱과 차량 음성 시스템을 연구하고, 데이터를 수집하는 장치부터 서버와 사용자 화면까지 연결해 왔습니다. 모델의 결과를 사람이 이해하고 다음 행동을 선택할 수 있는 제품으로 만드는 데 관심이 있습니다.',
    '개인 작업으로는 웹과 데스크톱 앱을 만들고 있습니다. Blender에서 만든 방을 웹으로 옮긴 이 블로그와, 화면 한쪽에 작은 캐릭터를 놓아두는 BytePet도 그 과정에서 시작했습니다.',
    '이 블로그에는 완성된 모습과 함께 만드는 중에 막혔던 지점, 선택한 방법, 다시 고친 과정을 남깁니다.',
  ],
  experience: [
    {
      organization: '(주) 제로원',
      period: '2025.04 ~ 2026.10',
      role: '팀장 · SW 개발',
      details: '감량기와 자원순환 R&D를 지원하는 IoT·웹·서버 시스템 개발을 담당했습니다.',
      work: [
        {
          title: '감량기 IoT 및 자원순환 R&D',
          reference: { label: '바이오 흡음재 공정 설계 사례', href: 'https://hangyu-field-notes.vercel.app/projects/materials' },
          items: [
            '감량기 내부 IoT 기능 구현 및 관련 소프트웨어 개발',
            '식품 폐기물 부산물 기반 흡음재 생산 R&D 수행',
            '원료 전처리, 배합, 상온 압착, 건조·양생, 시편 검증 흐름 설계',
          ],
        },
        {
          title: '웹 서비스 개발과 운영',
          items: [
            '사내 업무·운영 플랫폼 및 웹 서비스 구현·관리',
            '웹 프론트엔드와 서버 기능 개발, 운영 환경 및 서버 관리',
            'SW 개발과 R&D 과제를 함께 진행하며 제품 요구사항을 실제 구현으로 연결',
          ],
        },
      ],
    },
    {
      organization: '한국전자기술연구원',
      period: '2021.10 ~ 2023.03',
      role: '지능융합SW연구센터 · 연구원',
      details: '웨어러블 센싱과 차량 음성 AI를 중심으로, 센서·모바일·서버를 연결하는 응용 AI 시스템을 연구·개발했습니다.',
      work: [
        {
          title: '실시간 운동 동작 인식',
          reference: { label: 'Motion Feedback 연구 사례', href: 'https://hangyu-field-notes.vercel.app/projects/aether' },
          items: [
            '가속도 센서 기반 실시간 덤벨 운동 동작 인식 시스템 개발',
            '블루투스 기반 센서·스마트폰 연동, 특징 추출, K-NN 분류, Flask 서비스 구현',
          ],
        },
        {
          title: '웨어러블 보행 측정',
          reference: { label: 'Gait Measured 연구 사례', href: 'https://hangyu-field-notes.vercel.app/projects/atlas' },
          items: [
            '손목 착용형 IMU 기반 보행 거리·보행 속도 측정 연구',
            'Android 연동, 걸음 수·거리 추정, 칼만 필터 및 중력 보정, 통제 실험 설계·평가',
          ],
        },
        {
          title: '차량 음성 인식과 무선 업데이트',
          reference: { label: 'Voice Updated 연구 사례', href: 'https://hangyu-field-notes.vercel.app/projects/relay' },
          items: [
            '차량용 음성 인식 및 무선 업데이트 시스템 구현',
            '다중 STT API 연동, 서버·DB 설계, 차량별 데이터 수집, 개인화 모델 및 OTA 전달 흐름 구현',
          ],
        },
      ],
    },
  ] as Experience[],
  projects: [
    {
      name: 'hangyu / room',
      context: '개인 프로젝트 · 3D 블로그',
      description: 'Blender에서 에셋과 애니메이션을 직접 만들고, React Three Fiber로 연결한 블로그입니다. 방을 둘러보는 화면과 글을 읽는 2D 화면을 함께 만들었습니다.',
      tools: ['Blender', 'React', 'React Three Fiber'],
      postSlug: 'building-a-3d-blog-with-blender',
    },
    {
      name: 'BytePet',
      context: '개인 프로젝트 · 데스크톱 앱',
      description: '작업하는 화면 한쪽에 작은 캐릭터를 놓아두는 데스크톱 앱입니다. Electron으로 시작해 Tauri로 옮겼고, 캐릭터의 움직임과 메모·파일을 보관하는 기능을 다듬고 있습니다.',
      tools: ['Electron', 'Tauri', 'Canvas'],
      postSlug: 'bytepet-desktop-companion',
    },
    {
      name: 'DDang',
      context: '2024 · 팀 프로젝트 · 프론트엔드 팀장',
      description: '반려견과 산책 중인 사용자가 주변 산책자를 찾고 함께 걷기를 요청하는 서비스입니다. GPS 기반 산책 상태, 주변 탐색, 함께 산책하기 요청과 친구 신청 흐름을 구현했습니다.',
      tools: ['React', 'TypeScript', 'Vite', 'Geolocation'],
      reference: { label: 'DDang 구현 사례 보기', href: 'https://hangyu-field-notes.vercel.app/projects/ddang' },
    },
    {
      name: 'R&D WorkOS',
      context: '개발 중 · 연구 운영 워크스페이스',
      description: '프로젝트·실험·시료·문서·성과물을 연결하는 연구 업무 화면을 만들고 있습니다. 브라우저 상태와 localStorage를 사용하는 프로토타입으로, 외부 AI 호출과 서버 저장은 아직 포함하지 않았습니다.',
      tools: ['Next.js', 'React', 'TypeScript', 'localStorage'],
      reference: { label: '포트폴리오에서 WorkOS 보기', href: 'https://hangyu-field-notes.vercel.app/' },
    },
  ] as ProfileProject[],
  skills: [
    { name: 'AI · 연구', tools: ['Python', '동작 인식', '웨어러블 센싱', '신호 처리'] },
    { name: '프론트엔드', tools: ['React', 'Next.js', 'TypeScript'] },
    { name: '백엔드 · 데이터', tools: ['FastAPI', 'Flask', 'SQL'] },
  ],
  interests: [
    { name: '3D 작업', description: 'Blender로 공간과 물건을 만들고, 움직임을 붙여 웹에서 사용할 수 있는 장면으로 연결합니다.' },
    { name: '심레이싱과 베이스', description: '관심사를 담은 방에 심레이싱 장비와 베이스를 놓았습니다. 좋아하는 것들도 만드는 작업의 소재가 됩니다.' },
  ],
};
