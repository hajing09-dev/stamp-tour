/**
 * ====================================================================
 * 스탬프 투어 통합 설정 파일 (festival.config.js)
 * ====================================================================
 * * [주의] 본 파일은 L1(학생), L2(부스), L3(관리자) 모든 화면에서 공통으로 참조합니다.
 * 새로운 부스를 추가하거나 축제 명칭을 변경할 때 이 파일의 내용만 수정하면
 * 전체 애플리케이션에 실시간으로 반영됩니다.
 */

const FESTIVAL_CONFIG = {
  // 1. 축제 및 행사 정보
  eventName: "2026 IT-FESTIVAL",
  targetStamps: 4,               // 경품 수령을 위한 최소 스탬프 획득 개수
  adminPassword: "1234",         // L3 총괄 관리자용 접속 비밀번호

  // 2. 참여 동아리 및 부스 목록 (L2)
  // - id: 내부 데이터베이스 매핑용 고유 키 (영문 대문자 및 언더바 권장)
  // - name: 학생 화면 및 QR 화면에 노출될 실제 부스 이름
  // - password: 각 부스 운영진이 로그인할 때 사용할 4자리 비밀번호
  // - secretKey: TOTP(일회용 보안코드) 생성 시 내부 시드로 사용할 고유 영문 난수
  clubs: [
    {
      id: "CODING_BOOTH",
      name: "코딩 동아리",
      password: "1234",
      secretKey: "secret_seed_totp_key_01"
    },
    {
      id: "DANCE_BOOTH",
      name: "댄스 동아리 Groove",
      password: "1234",
      secretKey: "secret_seed_totp_key_02"
    },
    {
      id: "COOK_BOOTH",
      name: "요리 동아리 맛남",
      password: "1234",
      secretKey: "secret_seed_totp_key_03"
    },
    {
      id: "GAME_BOOTH",
      name: "오락 동아리 Arcade",
      password: "1234",
      secretKey: "secret_seed_totp_key_04"
    }
  ],

  // 3. 보안 및 수동 우회 설정
  security: {
    otpExpirySeconds: 30,         // 일회용 QR 코드 만료 및 갱신 주기 (초)
    abuseLimit: 3,                // 연속 인증 실패 시 차단 및 디스코드 경보 트리거 임계치
    ipTracking: true              // 악성 치팅 유저 역추적을 위한 IP 수집 활성화 여부
  }
};

// 다른 스크립트 파일에서 쉽게 가져다 쓸 수 있도록 브라우저 전역 객체로 등록
if (typeof window !== "undefined") {
  window.FESTIVAL_CONFIG = FESTIVAL_CONFIG;
}

