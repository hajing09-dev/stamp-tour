/**
 * Festival Stamp Tour - Application Configuration & i18n
 * 축제 명칭, 부스 목표, 시스템 안내 문구 및 에러 메시지 중앙 관리 모듈
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

  // 학생 화면(L1) 텍스트
  student: {
    badgeTitle: "스탬프 적립판",
    accountLabel: "STUDENT ACCOUNT",
    subDisplayDefault: "도장을 모아 경품에 도전하세요!",
    subDisplaySyncing: "스탬프 Tour 실시간 동기화 중",
    subDisplayStarted: "스탬프 투어가 시작되었습니다!",
    targetPrefix: "목표: ",
    targetSuffix: "개 완료",
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
    metricTotalStamps: "총 스탬프 적립 건수",
    metricActiveBooths: "연동 활성 부스",
    metricCompletedUsers: "완료 자격 획득자",
    metricThreatsBlocked: "보안 탐지 및 차단",
    boothStatusTitle: "부스별 동적 적립 현황",
    pendingApprovalTitle: "운영진 가입 승인 대기",
    auditLogTitle: "실시간 보안 블랙박스 로그",
    btnLogout: "관제실 퇴장"
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
