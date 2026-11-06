피아노가 추가된 메인 룸 · v28

room-with-piano.glb는 v27 메인 룸에 88건반 그랜드 피아노와 벤치를 추가한 파일입니다.
기존 방의 메시·재질·애니메이션 대상 번호를 유지하여 runtime-tracks.json 연결을 보존했습니다.
Music_Click의 카메라 경로와 렌즈는 새 피아노를 피하도록 v28 원본에서 다시 추출했습니다.

피아노 동작:
  Piano_Demo — 8초 건반 연주. 피아노 건반만 움직입니다.
  Press_<음 이름> — 88개 건반 각각의 누르기/유지/복귀.
  Piano_Performance — 14초, 방 전체 → 피아노 접근 → 건반 연주 → 방 전체 복귀.
  Piano_Performance는 WEB_Camera_Main도 제어하며 렌즈 값은 runtime-tracks.json에 있습니다.
같은 건반에 Demo/Performance/개별 Press를 동시에 적용하지 마세요. 소리는 포함하지 않았습니다.

기존 Room_Opening, Room_Ambient_Idle, Book/Monitor/Simulator/Music Idle·Hover·Click,
포털 접근과 조명 토글 클립도 포함되어 있습니다. 호버/클릭 시 해당 대상의 Idle을 멈추거나
전환하고, 종료 시 manifest의 재질 초기값을 복원합니다. 개별 Idle과 통합 Idle을 중복 재생하지 마세요.

조명 깜빡임, 화면/표시등의 밝기, 렌즈 변화는 별도 상태 데이터입니다.
GLB 뷰어가 JSON을 자동으로 실행하지 않으므로 이후 웹에서 같은 시간에 연결해야 합니다.
면광원·환경광·그림자·톤 매핑 역시 웹 렌더러에서 설정합니다. 이 파일은 베이크 버전이 아닙니다.

manifest.json에는 기존 연결 정보, 88건반 MIDI 번호/노드 이름, 피아노 배치가 있습니다.
runtime-tracks.json은 v28의 Music_Click 경로에 맞춘 렌즈와 새 Piano_Performance 렌즈를 포함합니다.
merge-report.json에는 원본 번호 보존 여부와 카메라 변경 내역을 기록했습니다.

편집 가능한 전체 원본은 상위 폴더의 blog-room-v28.blend입니다.
기존 데스크톱·서킷·차량 월드는 blog-room-v27/worlds 파일을 계속 사용합니다.
웹 클릭 로직과 페이지·글 UI는 아직 구현하지 않았습니다.
