# 사진첩

| 주소 | 내용 |
| --- | --- |
| `/photos` | 사진 홈. **일반**, **우주** 두 목록 |
| `/photos/general`, `/photos/general/:slug` | 일반 앨범 목록과 앨범 |
| `/photos/space` | 우주 사진 전체를 앨범 없이 펼친 그리드, 태그 필터 |
| `/races`, `/races/:slug` | 레이스 기록. 일반과 같은 **앨범 목록 → 앨범 안 사진** 구조 |
| `/admin` | 관리자: 앨범 만들기, 업로드, 순서·공개·대표 사진 |

## 구조

- **API:** `server/api.mjs`. Vercel에서는 `api/index.js` 함수 하나가 받고(`vercel.json`이 `/api/*`를 넘기며 원래 경로는 URL에 그대로 남음), 개발 서버에서는 Vite 미들웨어가 같은 핸들러를 씁니다.
- **DB:** Neon Postgres, 스키마는 `db/migrations/*.sql`. 테이블은 `albums`(general·race, 같은 형식)와 `photos`(general·race·space; space는 앨범 없음)입니다.
- **파일:** Cloudflare R2.
  - 공개 버킷에는 EXIF를 지운 WebP 사본(`photos/<id>/{lg,md,thumb}.webp`, 2560/1280/480px)을 둡니다.
  - 비공개 버킷에는 원본(`originals/<id>/original.<ext>`)을 둡니다. 관리자 화면에서 5분짜리 서명 URL로만 받을 수 있습니다.
  - 브라우저가 presigned URL로 R2에 직접 올리므로 Vercel 요청 크기 제한과 무관합니다.
- **인증:** GitHub OAuth입니다. `ADMIN_GITHUB_LOGINS`에 있는 계정만 들어오며, 7일짜리 HMAC 서명 쿠키를 씁니다. 쓰기 요청은 같은 출처(Origin)만 받습니다.
- **화면:** 앨범 목록과 사진 모두 원래 비율을 살린 메이슨리(높이가 제각각인 그리드)로 보여줍니다. 런타임에 API를 호출합니다. `/races/:slug`, `/photos/general/:slug`는 빌드 때 만든 빈 껍데기(`_album`)를 Vercel rewrite로 돌려주고, 제목·설명·OG 이미지는 불러온 뒤 갱신합니다.
- **캐시:** 공개 GET은 Vercel CDN에만 60초 캐시됩니다(`CDN-Cache-Control`). 브라우저는 매번 다시 확인합니다. 업로드가 반영되기까지 최대 약 1분 걸립니다.

## 로컬 개발

```sh
npm run dev          # /api 포함. DB=PGlite(.local/pgdata), 파일=.local/gallery-storage, 로그인 없이 관리자
npm test             # API 테스트 포함 (in-memory PGlite)
```

처음 실행하면 마이그레이션과 레이스 예시 4건이 자동으로 들어갑니다. 초기화하려면 `.local/pgdata`와 `.local/gallery-storage`를 지웁니다.
`.env.local`에 실제 값을 넣으면 그 서비스(Neon/R2/GitHub)를 대신 씁니다.

## 배포 전 설정 (한 번)

1. **Neon:** Vercel → Storage → Neon 연결(`DATABASE_URL` 자동 등록). 그다음 로컬에서 실행합니다.
   ```sh
   npx vercel env pull .env.local
   node --env-file=.env.local scripts/db-migrate.mjs --seed   # 스키마 + 레이스 예시 4건
   ```
2. **R2:** 버킷 2개를 만듭니다.
   - 공개용(예: `hangyu-photos`): 커스텀 도메인 또는 r2.dev 공개 접근을 켭니다.
   - 원본용(예: `hangyu-photo-originals`): 비공개로 둡니다.
   - R2 API 토큰(Object Read & Write, 두 버킷)을 발급합니다.
   - **두 버킷 모두 CORS**를 설정합니다.
     ```json
     [{ "AllowedOrigins": ["https://hangyu.blog", "http://127.0.0.1:5173"], "AllowedMethods": ["PUT", "GET", "HEAD"], "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 3600 }]
     ```
3. **GitHub OAuth App:** Settings → Developer settings → OAuth Apps에서 만듭니다.
   - Homepage: `https://hangyu.blog`
   - Callback: `https://hangyu.blog/api/auth/callback`
4. **Vercel 환경 변수:** `.env.example`의 항목을 모두 등록합니다. 하나라도 비면 API가 503으로 응답합니다.
5. 배포 후 `/admin` → GitHub 로그인 → 일반·레이스 탭에서 앨범을 만들고 사진을 올립니다.

## 알아둘 점

- 업로드 변환은 브라우저 canvas가 합니다. Chrome에서는 HEIC를 열 수 없으니 JPEG로 변환해서 올립니다(Safari는 가능).
- 랜딩(`/`)의 검색은 빌드 시점의 레이스 예시만 압니다. 다른 페이지의 검색은 API의 최신 앨범을 씁니다.
- sitemap에는 목록 페이지만 들어가고 개별 앨범 주소는 들어가지 않습니다(런타임 데이터).
