/**
 * Festival Stamp Tour - Application Configuration & i18n
 * 축제 명칭, 부스 목표, 시스템 안내 문구 및 에러 메시지 중앙 관리 모듈
 * 
 * 💡 본 저장소를 포크하여 사용 시, 아래 APP_CONFIG 내의 텍스트와 크레딧 정보를
 *    행사 및 동아리/연구실 명칭에 맞게 자유롭게 수정하여 활용하실 수 있습니다.
 */

window.APP_CONFIG = {
  // 축제 기본 메타 정보
  festival: {
    title: "FESTIVAL STAMP",
    subTitle: "축제 스탬프 투어",
    portalTitle: "FESTIVAL PORTAL",
    adminTitle: "실시간 보안 통합 관제탑",
    boothConsoleTitle: "BOOTH CONSOLE",
    copyright: "© 2026 Festival Stamp Tour System. All Rights Reserved."
  },

  // 학생 화면(L1) 3단 메뉴 내비게이션
  menu: {
    main: "도장판",
    ranking: "실시간 랭킹",
    credits: "크레딧"
  },

  // 학생 화면(L1) 기본 텍스트
  student: {
    badgeTitle: "스탬프 적립판",
    accountLabel: "STUDENT ACCOUNT",
    subDisplayDefault: "도장을 모아 랭킹 경품에 도전하세요!",
    subDisplaySyncing: "스탬프 Tour 실시간 동기화 중",
    subDisplayStarted: "스탬프 투어가 시작되었습니다!",
    targetPrefix: "총 부스: ",
    targetSuffix: "개소 운영 중",
    scanButton: "인증 QR 코드 스캔하기",
    manualHelpButton: "카메라가 안 켜지거나 인식이 안 되나요?",
    loginModalTitle: "학생 정보 등록",
    loginModalDesc: "스탬프 투어를 참여하려면 학번과 이름을 입력해 주세요.",
    studentIdLabel: "학번 (5자리)",
    studentIdPlaceholder: "예: 20101",
    nameLabel: "이름",
    namePlaceholder: "홍길동",
    startButton: "스탬프 투어 시작",
    switchAccount: "계정 전환",
    realtimeBadge: "실시간 동기화"
  },

  // 실시간 랭킹(Leaderboard) 텍스트
  ranking: {
    tabTitle: "실시간 스탬프 랭킹",
    myRankLabel: "나의 현재 순위",
    myRankPrefix: "",
    myRankSuffix: "위",
    myStampPrefix: "적립 완료: ",
    myStampSuffix: "개",
    notRanked: "순위 집계 중",
    topTitle: "실시간 스탬프 랭킹 TOP 20",
    topDesc: "스탬프를 많이 모은 순서대로 경품 수령 대상이 됩니다!",
    tieBreakerNotice: "※ 동점 시 더 먼저 스탬프를 획득한 순서로 정렬됩니다.",
    emptyLeaderboard: "아직 등록된 랭킹 데이터가 없습니다.",
    rankCol: "순위",
    userCol: "참가자",
    stampsCol: "적립 수",
    lastTimeCol: "최근 적립",
    searchPlaceholder: "학번 또는 이름으로 검색...",
    refreshButton: "새로고침",
    prizeGuideTitle: "🎁 경품 수령 안내",
    prizeGuideDesc: "축제 종료 시점의 최종 랭킹 상위권 학생들에게 운영 본부에서 푸짐한 경품을 증정합니다!"
  },

  // 제작 크레딧(Credits) 정보
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
        desc: "Linear / Vercel 미니멀 테마 및 반응형 인터랙션 구현"
      },
      {
        role: "Security & Realtime Infrastructure",
        name: "인프라 / 보안",
        desc: "Supabase Realtime 동기화 및 OTP 암호화 검증 체계"
      }
    ],
    techStack: "HTML5 · Tailwind CSS · Vanilla JS · Supabase (PostgreSQL & Realtime)",
    repoNotice: "본 시스템은 오픈소스 기반으로 커스텀이 가능하도록 설계되었습니다."
  },

  // 완주 축하(L1) 텍스트 (다득점 랭킹 대응)
  completion: {
    bannerBadge: "RANKING LEADER",
    bannerTitle: "모든 부스 도장 완료!",
    bannerDesc: "최상위 랭킹 달성! 운영 본부에서 경품을 확인하세요!",
    bannerButton: "축하 연출",
    modalBadge: "CONGRATULATIONS!",
    modalTitle: "🎉 전 부스 완주 성공! 🎉",
    modalDesc: "축제의 모든 스탬프를 완벽하게 모으셨습니다!<br>지금 바로 <strong class=\"text-sky-600 dark:text-sky-400 font-bold\">운영 본부(경품 수령처)</strong>로 방문하여<br>완주 기념 특별 선물을 수령하세요! 🎁",
    modalCodeLabel: "🏆 완주 인증 번호: ",
    modalReplayButton: "폭죽 & 팡파레 다시 즐기기!",
    modalCloseButton: "스탬프 적립판 확인하기"
  },

  // 부스 운영진(L2) 텍스트
  booth: {
    defaultTitle: "학생용 스탬프 보안 QR 코드",
    defaultDesc: "도용 방지를 위해 아래 버튼을 누르면 1분간 유효한 코드가 발급됩니다.",
    manualModeTitle: "비상 수동 입력 모드 가동 중",
    manualPinLabel: "비상 인증 코드",
    manualPinDesc: "카메라 고장 학생에게 위 6자리 번호를 직접 입력하도록 안내해 주세요.",
    visitorCountLabel: "누적 적립 학생",
    cycleCountLabel: "코드 암호화 주기",
    timerLabel: "보안 만료 임계 시간",
    btnShowManual: "비상 코드 노출",
    btnShowQr: "QR 코드 보기",
    btnRefreshOtp: "코드 즉시 갱신",
    btnLogout: "종료"
  },

  // 관리자 화면(L3) 텍스트
  admin: {
    badge: "SECURITY OPERATION CENTER",
    tabDashboard: "실시간 관제탑",
    tabRanking: "스탬프 랭킹 & 경품 관리",
    metricTotalStamps: "총 스탬프 적립 건수",
    metricActiveBooths: "전체 등록 부스",
    metricTotalParticipants: "스탬프 참여 학생",
    metricThreatsBlocked: "보안 탐지 및 차단",
    boothStatusTitle: "부스별 동적 적립 현황",
    auditLogTitle: "실시간 보안 블랙박스 로그",
    btnLogout: "관제실 퇴장",
    creditsModalTitle: "시스템 제작 크레딧",
    creditsBtn: "제작 크레딧"
  },

  // 포털 화면 텍스트
  portal: {
    title: "통합 권한 인증 포털",
    desc: "본 시스템은 허가된 운영진만 접근할 수 있습니다.<br>부스 권한 또는 관리 코드를 선택하여 접속해 주세요.",
    btnL2: "부스 운영진 (L2)",
    btnL3: "총괄 관리자 (L3)",
    boothSelectLabel: "담당 부스 명칭",
    passwordLabel: "보안 핀 / 비밀번호",
    passwordPlaceholder: "접속 비밀번호를 입력하세요",
    btnLogin: "보안 관리 콘솔 진입"
  },

  // 공통 알림 및 에러 메시지
  messages: {
    authSuccess: "인증 성공! 관리 권한을 위임합니다.",
    authFailed: "액세스 보안 키가 올바르지 않습니다.",
    notApproved: "미승인 상태이거나 프로필이 손상되었습니다.",
    roleMismatch: "요청한 권한과 계정 권한이 일치하지 않습니다.",
    boothMismatch: "권한이 있는 부스 계정으로 다시 로그인해 주세요.",
    sessionTerminatedByOtherDevice: "다른 기기에서 로그인되어 현재 세션이 안전하게 종료되었습니다.",
    cameraPermissionDenied: "카메라 권한 획득에 실패했습니다. 비상 수동 입력을 이용해 주세요.",
    valid6DigitsOtp: "6자리 숫자를 입력하세요.",
    otpGenerated: "1분 동안 유효한 새 QR 코드가 발급되었습니다.",
    stampSuccess: "인증 성공! 도장이 적립되었습니다.",
    stampAlreadyExists: "이미 적립 완료된 부스입니다.",
    stampExpiredCode: "만료된 인증 코드입니다. 새 코드를 찍어주세요.",
    stampNotStudent: "학생 계정으로 로그인 후 도장을 찍어주세요.",
    stampInvalidFormat: "유효하지 않은 QR 코드 규격입니다.",
    copiedToClipboard: "링크가 클립보드에 복사되었습니다! Safari 또는 Chrome 주소창에 붙여넣어 주세요."
  }
};

/**
 * DOM에 data-i18n 속성이 선언된 태그를 찾아 자동으로 텍스트를 바인딩하는 엔진
 */
function initI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const value = getNestedValue(window.APP_CONFIG, key);
    if (value !== undefined) {
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
        if (el.getAttribute("placeholder") !== null) {
          el.setAttribute("placeholder", value);
        } else {
          el.value = value;
        }
      } else {
        el.innerHTML = value;
      }
    }
  });
}

function getNestedValue(obj, path) {
  return path.split(".").reduce((acc, part) => (acc ? acc[part] : undefined), obj);
}

document.addEventListener("DOMContentLoaded", () => {
  initI18n();
});
