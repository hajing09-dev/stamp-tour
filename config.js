/**
 * Festival Stamp Tour - Application Configuration & i18n
 * 축제 명칭, 부스 목표, 시스템 안내 문구 및 에러 메시지 중앙 관리 모듈
 * 
 * 💡 본 저장소를 포크하여 사용 시, 아래 APP_CONFIG 내의 설정값만 수정하면
 *    Supabase 연결, 행사 명칭, 학번 자릿수, 텍스트 문구, 부스 아이콘까지
 *    모든 화면에 자동으로 100% 동적 반영됩니다.
 */

window.APP_CONFIG = {
  // 1. Supabase 클라우드 데이터베이스 연결 설정
  // 💡 포크 후 본인의 Supabase 프로젝트 URL과 Publishable Anon Key로 교체해 주세요.
  supabase: {
    url: "https://ivhdgijhvvvdcxsfmlpd.supabase.co/",
    anonKey: "sb_publishable_hMMfcKDUhJvNJzq5MFaA8A_u2tM7Nks"
  },

  // 2. 인증 및 학생 식별 규칙 설정
  auth: {
    domain: "@festival.com",          // 내부 식별용 가상 이메일 도메인
    studentIdPattern: "^\\d{4,8}$",   // 학번 정규식 (기본: 4~8자리 숫자, 필요시 "^[A-Za-z0-9]{4,10}$" 등으로 변경 가능)
    studentIdPlaceholder: "학번을 입력하세요 (예: 20101)",
    studentIdHelp: "4~8자리 숫자 학번"
  },

  // 3. 행사 기본 브랜드 및 헤더 메타 정보
  festival: {
    title: "동아리 발표회",
    subTitle: "동아리제 스탬프 투어",
    categoryChip: "함께 만드는 동아리제",
    heroTitle: "우리 동아리의<br><span class=\"ft-highlight\">반짝이는 순간들!</span>",
    heroSubtitle: "모으는 재미가 있는 동아리 발표회",
    heroSticker: "LET'S<br>COLLECT!",
    loginArtBadge: "CLUB DAY",
    adminHeaderSticker: "GOOD<br>CLUB DAY!",
    copyright: "© 2026 Festival Stamp Tour System. All Rights Reserved."
  },

  // 4. 부스별 전용 아이콘 오버라이드 맵 (Lucide 아이콘 이름)
  // 💡 DB 수정 없이 특정 부스 ID에 원하는 아이콘을 바로 지정할 수 있습니다.
  boothIcons: {
    "booth01": "robot",
    "booth02": "music",
    "booth03": "gift",
    "booth04": "soup",
    "booth05": "camera",
    "club-code": "code-xml"
  },

  // 5. 학생 화면 3단 탭 메뉴 라벨
  menu: {
    main: "도장판",
    ranking: "학생 랭킹",
    clubs: "동아리 랭킹",
    credits: "크레딧"
  },

  // 6. 명예의 전당 / 시상대(Podium) 헤더 문구
  podium: {
    student: {
      badge: "HALL OF FAME",
      title: "오늘의 반짝이는 주인공",
      desc: "부스를 누비며 모은 소중한 도장들"
    },
    club: {
      badge: "CLUB RANKING",
      title: "오늘의 인기 동아리",
      desc: "학생들이 가장 많이 만난 동아리 부스"
    }
  },

  // 7. 학생 화면(L1) 세부 텍스트
  student: {
    loginTitle: "나만의 <span class=\"ft-highlight\">도장판</span>을<br>채워볼까요?",
    loginDesc: "동아리를 만나고, 오늘의 순간을 모아요.",
    loginButton: "동아리 투어 시작",
    progressLabel: "나의 도장 컬렉션",
    scanButton: "내 스탬프 QR 코드 제시하기",
    qrModalTitle: "내 스탬프 적립 QR",
    qrModalDesc: "부스 운영진에게 이 화면의 QR 코드를 보여주세요.",
    qrModalHint: "스캔 즉시 자동으로 도장이 적립돼요.",
    gridHeading: "어떤 도장을 모아볼까?",
    emptyBooths: "아직 등록된 부스가 없어요.",
    locationDefault: "위치 안내 준비 중"
  },

  // 8. 완주 축하 연출 텍스트
  completion: {
    bannerTitle: "도장판을 모두 채웠어요!",
    bannerButton: "축하 보기",
    modalTitle: "도장판이<br><span class=\"ft-highlight\">반짝반짝 완성!</span>",
    modalDesc: "모든 부스를 만났어요.<br>오늘의 발견을 오래 기억해 주세요.",
    prizeNote: "경품 조건과 수령 방법은<br>행사 안내 확정 후 표시됩니다."
  },

  // 9. 부스 운영진 화면(L2) 세부 텍스트
  booth: {
    title: "방문 학생에게<br><span class=\"ft-highlight\">스탬프를 지급해 주세요.</span>",
    desc: "학생이 제시한 QR을 스캔하거나, 학번을 직접 입력할 수 있어요.",
    tabScan: "카메라 스캔 모드",
    tabManual: "학번 직접 입력",
    scanStatusWaiting: "학생의 스탬프 QR 코드를 프레임에 맞춰주세요",
    btnRestartCamera: "카메라 다시 시작",
    manualLabel: "학생 학번",
    manualHelp: "카메라 인식이 어려울 때 학번을 직접 입력해 주세요.",
    btnGrantStamp: "스탬프 즉시 지급",
    statVisitorCount: "누적 적립 학생",
    statStatusLabel: "실시간 관제 상태",
    statStatusRunning: "정상 가동",
    recentFeedTitle: "방금 적립된 학생",
    recentFeedEmpty: "아직 적립된 학생이 없어요."
  },

  // 10. 관리자 화면(L3) 텍스트
  admin: {
    title: "오늘의 축제, <span class=\"ft-highlight\">한눈에.</span>",
    desc: "학생들의 방문과 도장 적립 현황을 실시간으로 확인해요.",
    tabDashboard: "실시간 관제탑",
    tabRanking: "스탬프 랭킹 & 경품 관리",
    metricTotalStamps: "총 도장 적립",
    metricParticipants: "참여 학생",
    metricFailed: "인증 실패 기록",
    boothStatusTitle: "부스별 도장 현황",
    auditLogTitle: "최근 인증 기록",
    searchPlaceholder: "학번 또는 이름 검색...",
    btnLogout: "로그아웃"
  },

  // 11. 포털 로그인 화면 텍스트
  portal: {
    mobileTitle: "설렘을 더하는<br><span class=\"ft-highlight\">운영진 로그인</span>",
    mobileDesc: "담당하는 역할을 선택해 주세요.",
    desktopTitle: "학생들의 하루에<br><span class=\"ft-highlight\">설렘을 더하는 일.</span>",
    desktopDesc: "참여 현황부터 도장 랭킹까지 한곳에서 운영해요.",
    roleBooth: "부스 담당자",
    roleAdmin: "총괄 관리자",
    boothSelectLabel: "담당 부스",
    passwordLabel: "비밀번호",
    passwordPlaceholder: "운영진 비밀번호",
    btnLogin: "관리 화면 들어가기",
    btnBackToStudent: "학생 화면으로 돌아가기"
  },

  // 12. 제작 크레딧(Credits) 정보
  credits: {
    title: "제작 크레딧",
    subtitle: "Festival Stamp Tour System",
    teamName: "FESTIVAL DEV & DESIGN TEAM",
    description: "본 스탬프 투어 및 실시간 보안 관제 플랫폼은 참가자들의 즐거운 축제 경험과 공정한 이벤트 운영을 위해 제작되었습니다.",
    members: [
      {
        role: "Project Architecture & Full-stack",
        name: "개발 총괄",
        desc: "시스템 아키텍처, 실시간 보안 검증 파이프라인 및 DB 설계"
      },
      {
        role: "UI/UX & Design System",
        name: "디자인 총괄",
        desc: "미니멀 스티커북 테마 및 반응형 인터랙션 구현"
      },
      {
        role: "Security & Infrastructure",
        name: "인프라 / 보안",
        desc: "Supabase DB 최적화 및 보안 검증 체계"
      }
    ],
    techStack: "HTML5 · CSS3 (Custom Stickerbook) · Vanilla JS · Supabase (PostgreSQL)",
    repoNotice: "본 시스템은 오픈소스 기반으로 커스텀이 가능하도록 설계되었습니다."
  }
};
