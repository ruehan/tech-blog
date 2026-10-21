export type WorldId = 'room' | 'desktop' | 'circuit';
export type ViewId = 'overview' | 'car' | 'cockpit';
// Exported RacingPortal_CockpitCamera from worlds-manifest.json, in glTF coordinates.
export const cockpitCamera = { position: [-3, 0.85, -0.10] as const, fov: 0.8648155331611633 * 180 / Math.PI };
export function defaultView(world: WorldId): ViewId { return world === 'circuit' ? 'cockpit' : 'overview'; }
export const worlds = {
  room: { number: '01', label: '나의 방', english: 'THE ROOM', title: '작은 방,\n넓은 취향.', description: '개발하고, 연주하고, 달리는 곳.\n오브젝트를 눌러 조금 더 가까이 들여다보세요.', file: 'interactive/room.glb' },
  desktop: { number: '02', label: '컴퓨터', english: 'THE DESKTOP', title: '생각이\n만들어지는 곳.', description: '화면 너머, 또 하나의 작은 세계.\nProjects 폴더를 눌러 열어보세요.', file: 'worlds/computer-desktop.glb', position: [0, 2.8, 8], target: [0, 2.8, -6], fov: 35.05, min: 8, max: 45 },
  circuit: { number: '03', label: '서킷', english: 'APEX CIRCUIT', title: '다음 코너를\n향해서.', description: '굽이치는 트랙과 출발선 위의 머신.\n시점을 바꿔 서킷과 차량을 둘러보세요.', file: 'worlds/apex-circuit.glb', position: [260, 310, 330], target: [-90, 0, -95], fov: 43, min: 8, max: 850 },
} satisfies Record<WorldId, { number: string; label: string; english: string; title: string; description: string; file: string; position?: number[]; target?: number[]; fov?: number; min?: number; max?: number }>;

export function asset(path: string) { return `${import.meta.env.BASE_URL}assets/${path}`; }
