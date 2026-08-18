# 🎪 페스티벌 스탬프 투어 및 통합 보안 관제 시스템 (Festival Stamp Tour & SOC System)

학교 및 기관 축제/행사용 **실시간 QR 스탬프 투어 및 통합 보안 관제 시스템**입니다.  
Vanilla HTML/JS, Tailwind CSS, 그리고 Supabase(PostgreSQL, Auth, Realtime, RPC, RLS)를 기반으로 구축되었습니다.

---

## 🌟 주요 특징 및 기능

### 1. 3계층 역할 분리 및 보안 아키텍처
* **L1 (학생 모듈 - `index.html` / `student.js`):**
  - 학번 5자리 + 이름 기반 스탬프 도장판 자동 동기화
  - 모바일 카메라를 통한 1분 만료 QR 코드 스캔 및 비상 6자리 OTP 수동 인증
  - PWA(Progressive Web App) Standalone 지원 (홈 화면에 앱으로 추가하여 풀스크린 UX 제공)
  - 인앱 브라우저(카카오톡/인스타 등) 감지 시 외부 브라우저(Safari/Chrome) 자동 탈출 및 카메라 차단 우회 가이드 제공
* **L2 (부스 운영진 콘솔 - `booth.html` / `booth.js`):**
  - 부스 방문 학생을 위한 60초 만료 일회용 동적 QR 코드 발급
  - 카메라 고장 학생을 위한 비상 PIN 번호 노출 모드
  - 실시간 방문자 수 및 코드 암호화 주기 카운팅
  - **단일 기기 세션 제어 (1계정 1기기):** 다른 기기에서 중복 로그인 시 이전 기기 즉각 자동 로그아웃
* **L3 (총괄 관리자 관제탑 - `admin.html` / `admin.js`):**
  - 실시간 전체 통계 메트릭 (총 적립 건수, 활성 부스 수, 전 부스 완주 학생 수, 차단된 보안 위협)
  - **과거 블랙박스 로그 20건 선행 로딩** 및 실시간 감사 로그 스트리밍
  - L2 부스 운영진 가입 신청 승인/반려 관리
  - 해킹 시뮬레이션 및 테스트 데이터 주입 도구 탑재
* **통합 인증 포털 (`portal.html` / `portal.js`):**
  - L2 / L3 전용 보안 터널 로그인 및 권한/승인 상태 2단계 교차 검증
  - 고유 세션 ID 발급 및 단일 기기 세션 동기화

### 2. UX 및 디자인 고도화
* **다크 / 라이트 모드 (`theme.js`):** 깜빡임(FOUC) 없는 시스템 테마 감지 및 원클릭 테마 전환 토글 버튼 지원
* **중앙 텍스트/i18n 관리 (`config.js`):** 축제 명칭, 안내 문구, 에러 메시지를 단일 객체(`window.APP_CONFIG`)에서 관리하여 차기 행사 시 유지보수 극대화
* **PWA & 파비콘:** Web App Manifest, Service Worker, 192/512px 앱 아이콘 및 파비콘 완비

---

## 📁 폴더 및 파일 구조

```text
stamp-tour/
├── assets/
│   └── icons/              # Favicon, Apple Touch Icon, PWA 192x192, 512x512 아이콘
├── config.js               # 축제 명칭, 문구 및 다국어 중앙 설정 모듈
├── theme.js                # 다크/라이트 테마 제어 모듈
├── webview-checker.js      # 인앱 브라우저 감지 및 외부 브라우저 탈출 모듈
├── manifest.json           # PWA 웹앱 매니페스트
├── service-worker.js       # PWA 서비스 워커
├── supabase-init.js        # Supabase 클라이언트 전역(window.supabase) 안전 초기화
├── index.html / student.js # [L1] 학생용 스탬프 적립판 및 QR 스캐너
├── booth.html / booth.js   # [L2] 부스 운영진 콘솔 (1분 만료 QR 발급)
├── admin.html / admin.js   # [L3] 총괄 관리자 실시간 보안 통합 관제탑
├── portal.html / portal.js # [공통] L2/L3 통합 보안 로그인 포털
├── schema.sql              # Supabase 전체 DB 세팅 SQL (테이블, RPC, RLS, Realtime)
└── README.md               # 프로젝트 문서
```

---

## 🗄️ 데이터베이스 스키마 명세 (`schema.sql`)

### 1. 테이블 정의
| 테이블명 | 설명 | 주요 컬럼 |
| :--- | :--- | :--- |
| `clubs` | 동아리/부스 기본 정보 | `club_id` (PK), `name`, `created_at` |
| `users` | 사용자/운영진 프로필 및 권한 | `id` (PK), `student_id` (Unique/Email), `name`, `role` (L1/L2/L3), `is_approved`, `club_id`, `active_session_id` |
| `clubs_status` | 부스 실시간 OTP 및 상태 | `club_id` (PK/FK), `current_otp`, `otp_expires_at`, `last_login_at` |
| `stamps` | 학생 스탬프 적립 내역 | `id` (PK), `student_id`, `club_id` (FK), `created_at`, Unique(`student_id`, `club_id`) |
| `stamp_logs` | 실시간 보안 감사 및 시도 로그 | `id` (PK), `student_id`, `club_id`, `status`, `created_at` |

### 2. 핵심 함수 및 보안 로직
* **`check_otp_and_stamp(p_club_id, p_input_otp)` (RPC / SECURITY DEFINER):**
  - 1. L1 학생 권한 검증 (`ERROR_NOT_A_STUDENT` 차단)
  - 2. 부스 6자리 OTP 일치 여부 검증 (`ERROR_WRONG_CODE`)
  - 3. 60초 유효 시간 만료 검증 (`ERROR_EXPIRED_CODE`)
  - 4. 중복 적립 검증 (`ALREADY_STAMPED`)
  - 5. `stamps` 및 `stamp_logs` 원자적 적립 트랜잭션 실행
* **`handle_new_user()` (트리거 함수):**
  - Supabase Auth 회원가입 발생 시 `public.users`에 역할과 승인 상태를 자동으로 동기화

---

## 🚀 시작 및 배포 가이드

### 1. Supabase 프로젝트 설정
1. [Supabase](https://supabase.com) 프로젝트를 생성합니다.
2. 대시보드의 **SQL Editor**에 [`schema.sql`](./schema.sql) 파일의 내용을 붙여넣고 `RUN`을 실행합니다.
3. **Authentication Settings:**
   - 대시보드 `Authentication -> Providers -> Email`에서 **Confirm email** 옵션을 **OFF**로 설정합니다. (가상 이메일 기반 가입 시 429 Rate Limit 방지)
4. **초기 관리자(L3) 계정 생성:**
   - `Authentication -> Users`에서 `admin@festival.com` 유저를 생성합니다.
   - `public.users` 테이블에서 해당 레코드의 `role`을 `'L3'`, `is_approved`를 `true`로 지정합니다.

### 2. 프론트엔드 환경 설정
1. [`supabase-init.js`](./supabase-init.js) 파일을 열어 본인 프로젝트의 URL과 Anon Key를 입력합니다:
   ```javascript
   const SUPABASE_URL = "https://your-project-id.supabase.co/";
   const SUPABASE_ANON_KEY = "your-anon-publishable-key";
   ```
2. 축제 명칭 및 문구를 변경하려면 [`config.js`](./config.js)를 수정합니다.

### 3. 로컬 실행
별도의 빌드 과정 없이 정적 웹 서버(Live Server, Vercel, Netlify, GitHub Pages 등)로 즉시 배포 및 실행이 가능합니다.

```bash
# npx serve를 이용한 로컬 테스트 예시
npx -y serve ./
```

---

## 🔒 라이선스
MIT License. 자유롭게 수정 및 배포할 수 있습니다.