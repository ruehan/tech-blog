메인 룸 웹 에셋 · v27

room.glb
방 한 개와 책·모니터·시뮬레이터·베이스의 구조를 정리한 인터랙션용 파일입니다.
167개 노드, 101개 메시, 50개 재질, 약 13.3만 삼각형입니다.
우드 컬러/노멀 이미지 4개가 파일 안에 들어 있으며, 외부 이미지 경로가 필요하지 않습니다.
표준 glTF 이동·회전·크기·모프 애니메이션 22개를 포함합니다.

manifest.json
상호작용 루트, 카메라, 애니메이션 이름·길이, 재질의 초기값과 원래 조명 설정을 담았습니다.
웹에서 오브젝트 이름을 추측하는 대신 interaction_roots와 nodes 항목을 사용하세요.

runtime-tracks.json
Blender 재질의 발광·색상 변화와 면광원의 밝기는 표준 glTF 애니메이션에 포함되지 않습니다.
이를 빠뜨리지 않도록 원래 장면에서 24fps로 추출한 값과 대상 노드/재질 번호를 함께 제공합니다.
Music_Idle과 Music_Hover_Exit는 발광 변화만 있으므로 이 파일에만 동작이 있습니다.
오프닝의 조명 깜빡임, 화면 점등, 앰프 표시등 및 모니터 밝기도 이 파일을 연결해야 완성됩니다.
이를 실행하는 웹 코드는 아직 만들지 않았습니다.

사용할 클립
Room_Opening: 3초 오프닝. 카메라·화면의 형태 변화는 GLB, 밝기 변화는 sidecar에 있습니다.
Room_Ambient_Idle: 20초 동안 네 코너의 반응이 엇갈려 나오는 반복 동작.
Book / Monitor / Simulator / Music:
  _Idle: 개별 5초 반복.
  _Hover_Enter: 0.5초 진입.
  _Hover_Hold: 머무는 상태. Music은 짧은 줄 떨림을 끝내고 멈춥니다.
  _Hover_Exit: 0.5초 복귀.
Book_Click: 책 펼치기와 글 표시 면의 이동, 카메라 연출.
Music_Click: 음악 코너 진입·연주·방 전체 복귀.
Monitor_Portal_Approach / Simulator_Portal_Approach: 방 안 모니터까지의 접근.
Lights_On / Lights_Off: 벽 스위치의 회전 + sidecar 조명/발광 상태.

여러 클립을 모두 동시에 재생하지 마세요.
해당 오브젝트에 Hover나 Click을 재생할 때 그 오브젝트의 Idle을 멈추거나 섞어 전환합니다.
Hover_Enter 마지막 상태를 유지하거나 Hover_Hold를 적용하고, 떠날 때 Hover_Exit로 복귀합니다.
재질 상태도 같은 클립 시간으로 재생하고, 종료 시 manifest의 material_rest_state로 복원합니다.
개별 Idle과 통합 Room_Ambient_Idle은 같은 오브젝트를 조절하므로 중복 재생하지 않습니다.

카메라는 WEB_Camera_Main이며 glTF 기준 미터 단위, +Y가 위쪽입니다.
카메라 이동은 GLB에 있지만 렌즈 변화는 runtime-tracks의 카메라 항목도 함께 적용합니다.
실제 글 내용과 클릭 판정, 포털 월드 교체는 이후 웹 프로젝트에서 연결합니다.

room-export.blend
웹으로 내보낼 구조·PBR 재질·원래 면광원 설정을 살펴보는 작은 정리본입니다.
이 파일은 정지 상태의 검토용이며, 편집 가능한 원본 애니메이션은 blog-room-v26.blend에 있습니다.

room-glb-verified.png
실제로 room.glb를 다시 불러와 원본 조명과 함께 렌더링한 확인 이미지입니다.

GLB에 Blender 렌더 결과 전체가 저장되는 것은 아닙니다.
이 파일은 움직임을 유지하는 PBR 모델입니다. 면광원, 그림자, 환경광, 톤 매핑은 웹에서 설정해야 합니다.
Blender 면광원의 와트 값을 웹 렌더러의 intensity에 그대로 넣으면 밝기가 맞지 않을 수 있습니다.
재질/조명 애니메이션 확장 지원을 가정하지 않도록 표준 GLB와 별도 상태 데이터를 분리했습니다.
