/**
 * ====================================================================
 * 스탬프 투어 - Supabase 실시간 백엔드 컨트롤러 (app.js)
 * ====================================================================
 * L1(학생 PWA), L2(부스), L3(관리자) 화면의 실시간 DB 통신 및
 * OTP 보안 검증 로직을 총괄하는 코어 자바스크립트 파일입니다.
 */

// 1. Supabase 접속 설정 (자신의 Supabase 대시보드에서 복사하여 기입하세요)
const SUPABASE_URL = "https://qmcebhdmcsjdwvyuumcp.supabase.co/"; // 예: "https://your-project.supabase.co"
const SUPABASE_ANON_KEY = "sb_publishable_mKcWj5buZLsya7ObcKsC1A_LbDfH2xp"; // 예: "your-anon-public-key"

let supabase = null;
let isDemoMode = false;

// 2. 통합 초기화 및 세션 체크
document.addEventListener("DOMContentLoaded", async () => {
  // Supabase 클라이언트 초기화 시도
  if (SUPABASE_URL && SUPABASE_ANON_KEY && typeof window.supabase !== "undefined") {
    try {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log("Supabase 연동 성공!");
    } catch (err) {
      console.error("Supabase 초기화 실패, 데모 모드로 실행합니다:", err);
      isDemoMode = true;
    }
  } else {
    console.warn("⚠️ Supabase 설정 값 또는 라이브러리가 존재하지 않아 [가상 데모 모드]로 작동합니다.");
    isDemoMode = true;
  }

  // 초기화 완료 후 각 페이지에 맞는 이벤트 바인딩 및 데이터 조회 개시
  initAppRouter();
});

/**
 * 접속한 HTML 페이지를 감지하여 알맞은 초기화 함수를 라우팅합니다.
 */
function initAppRouter() {
  const path = window.location.pathname;
  
  if (path.includes("index.html") || path === "/" || path === "") {
    initStudentPage();
  } else if (path.includes("booth.html")) {
    initBoothPage();
  } else if (path.includes("admin.html")) {
    initAdminPage();
  }
}

// ====================================================================
// 📱 L1: 학생용 (Student) 실시간 로직
// ====================================================================

let currentStudent = null;
let registeredStamps = [];

async function initStudentPage() {
  console.log("L1 학생 페이지 연동 개시...");
  
  // 1. 로컬 저장소에서 기존 학생 로그인 세션 로드
  const savedUser = localStorage.getItem("student_session");
  if (savedUser) {
    currentStudent = JSON.parse(savedUser);
    document.getElementById("student-info-display").innerText = `${currentStudent.id} ${currentStudent.name}`;
    document.getElementById("student-sub-display").innerText = "안전하게 실시간 보안 연결됨";
    
    // 이전에 획득한 스탬프 목록 가져오기
    await fetchStudentStamps();
  } else {
    // 세션이 없으면 학번/이름 등록 모달 열기 (간이 구현)
    promptStudentLogin();
  }
}

/**
 * 학번 및 이름 임시 세션 등록 프롬프트
 */
function promptStudentLogin() {
  const studentId = prompt("학번 5자리를 입력하세요 (예: 20101):");
  if (!studentId || studentId.length !== 5) {
    alert("올바른 학번이 아닙니다. 페이지를 새로고침하여 다시 시도해 주세요.");
    return;
  }
  const name = prompt("이름을 입력하세요:");
  if (!name) {
     alert("이름은 필수 입력 항목입니다.");
     return;
  }

  currentStudent = { id: studentId, name: name };
  localStorage.setItem("student_session", JSON.stringify(currentStudent));
  
  // 즉시 동기화
  document.getElementById("student-info-display").innerText = `${currentStudent.id} ${currentStudent.name}`;
  
  // DB에 학생 정보가 없으면 가입(Upsert) 처리
  syncStudentToDatabase(currentStudent);
  fetchStudentStamps();
}

/**
 * 유저 정보를 Supabase users 테이블에 실시간 싱크
 */
async function syncStudentToDatabase(student) {
  if (isDemoMode) return;

  const { error } = await supabase
    .from("users")
    .upsert({
      student_id: student.id,
      name: student.name,
      role: "L1"
    }, { onConflict: 'student_id' });

  if (error) console.error("유저 동기화 실패:", error);
}

/**
 * 특정 학생이 획득한 스탬프 내역을 DB에서 가져옴
 */
async function fetchStudentStamps() {
  if (!currentStudent) return;

  if (isDemoMode) {
    // 데모 모드일 때는 로컬스토리지 임시 보관 정보 사용
    const localStamps = localStorage.getItem(`stamps_${currentStudent.id}`);
    registeredStamps = localStamps ? JSON.parse(localStamps) : [];
    syncStampsToUI();
    return;
  }

  const { data, error } = await supabase
    .from("stamps")
    .select("club_id")
    .eq("student_id", currentStudent.id);

  if (error) {
    console.error("스탬프 정보 수신 실패:", error);
    return;
  }

  registeredStamps = data.map(item => item.club_id);
  syncStampsToUI();
}

/**
 * 획득한 스탬프 정보를 화면 UI에 뿌려주는 공통 함수
 */
function syncStampsToUI() {
  const total = window.FESTIVAL_CONFIG ? window.FESTIVAL_CONFIG.targetStamps : 4;
  const current = registeredStamps.length;

  document.getElementById("stamps-acquired").innerText = current;
  const percent = (current / total) * 100;
  document.getElementById("progress-bar").style.width = `${percent}%`;
  document.getElementById("progress-text").innerHTML = `${current} <span class="text-xs text-slate-500 font-medium">/ ${total}</span>`;

  // 도장 쾅 오버레이 켜기
  registeredStamps.forEach(clubId => {
    const card = document.getElementById(`card-${clubId}`);
    if (card) {
      const overlay = card.querySelector(".stamp-overlay");
      if (overlay) overlay.classList.remove("hidden");
    }
  });
}

/**
 * [가장 중요] QR 스캔 또는 수동 OTP 입력 시 보안 검증 처리 함수
 * @param {string} base64Payload - 암호화된 "[부스ID]:[실시간OTP]" 문자열
 */
async function processStampVerification(base64Payload) {
  if (!currentStudent) {
    showNotification("사용자 세션이 만료되었습니다. 로그인을 다시 하세요.", "error");
    return;
  }

  try {
    // 1. 패킷 디코딩
    const decoded = atob(base64Payload);
    const [clubId, otpCode] = decoded.split(":");

    if (!clubId || !otpCode) throw new Error("인증 패킷 훼손");

    // 중복 체크
    if (registeredStamps.includes(clubId)) {
      showNotification("이미 스탬프를 획득한 동아리 부스입니다.", "error");
      return;
    }

    if (isDemoMode) {
      // 데모 모드 전용 가상 성공 처리
      registeredStamps.push(clubId);
      localStorage.setItem(`stamps_${currentStudent.id}`, JSON.stringify(registeredStamps));
      syncStampsToUI();
      showNotification("인증 성공 (데모) - 도장이 찍혔습니다!", "success");
      return;
    }

    // 2. [Supabase 실시간 검증 핵심]
    // clubs_status 테이블에서 현재 부스가 게시한 실시간 OTP 상태를 읽어와 비교함
    const { data: statusData, error: statusErr } = await supabase
      .from("clubs_status")
      .select("current_otp, otp_expires_at")
      .eq("club_id", clubId)
      .single();

    if (statusErr || !statusData) {
      showNotification("부스 검증 데이터 접근에 실패했습니다.", "error");
      return;
    }

    const now = new Date();
    const expiryTime = new Date(statusData.otp_expires_at);

    // 3. 시간 만료 여부 및 코드 일치성 대조
    if (now > expiryTime) {
      showNotification("만료된 QR코드입니다. 부스 화면의 새 코드를 찍어주세요.", "error");
      insertAuditLog(currentStudent.id, clubId, otpCode, "EXPIRED_OTP");
      return;
    }

    if (statusData.current_otp !== otpCode) {
      showNotification("보안 인증 코드가 일치하지 않습니다.", "error");
      insertAuditLog(currentStudent.id, clubId, otpCode, "INVALID_OTP");
      
      // 누적 어뷰징 체크 및 디스코드 경보 트리거링 판단
      checkAbuseAndNotify(currentStudent.id, clubId, otpCode);
      return;
    }

    // 4. 검증 합격 시 트랜잭션 수립 (스탬프 적립 및 감사 로그 인서트)
    const { error: stampErr } = await supabase
      .from("stamps")
      .insert({
        student_id: currentStudent.id,
        club_id: clubId
      });

    if (stampErr) {
      showNotification("스탬프 적립 처리 도중 오류가 발생했습니다.", "error");
      return;
    }

    // 감사 로그 기록
    await insertAuditLog(currentStudent.id, clubId, otpCode, "SUCCESS");

    // 동적 데이터 갱신
    registeredStamps.push(clubId);
    syncStampsToUI();
    showNotification("인증 성공! 도장이 적립되었습니다.", "success");

  } catch (err) {
    console.error("인증 처리 치명적 장애:", err);
    showNotification("유효하지 않은 보안 규격입니다.", "error");
    if (!isDemoMode) {
      insertAuditLog(currentStudent?.id || "GUEST", "UNKNOWN", base64Payload, "SECURITY_BREACH");
    }
  }
}

/**
 * 실시간 감사 블랙박스 로그 테이블 인서트 헬퍼
 */
async function insertAuditLog(studentId, clubId, code, status) {
  if (isDemoMode) return;
  
  await supabase
    .from("stamp_logs")
    .insert({
      student_id: studentId,
      club_id: clubId,
      input_code: code,
      status: status
    });
}

/**
 * 악성 실패 로그를 수집하여 디스코드 사이렌 웹훅 송신 여부 결정
 */
async function checkAbuseAndNotify(studentId, clubId, code) {
  if (isDemoMode) return;

  const limit = window.FESTIVAL_CONFIG?.security?.abuseLimit || 3;

  // 최근 5분 내의 실패(INVALID_OTP) 로그 개수를 카운팅
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  
  const { count, error } = await supabase
    .from("stamp_logs")
    .select("*", { count: "exact", head: true })
    .eq("student_id", studentId)
    .eq("status", "INVALID_OTP")
    .gte("created_at", fiveMinutesAgo);

  if (!error && count >= limit) {
    // 디스코드 비상 경보망 발송
    sendDiscordSiren(studentId, clubId, count);
  }
}

/**
 * 디스코드 보안 실시간 웹훅 연계 송출기
 */
async function sendDiscordSiren(studentId, clubId, count) {
  const webhookUrl = window.FESTIVAL_CONFIG?.security?.discordWebhookUrl || "";
  if (!webhookUrl) return;

  const payload = {
    embeds: [{
      title: "🚨 [보안 관제 시스템] 치팅 공격 징후 포착",
      color: 15548997, // 이머전시 레드
      fields: [
        { name: "대상 학생 학번", value: studentId, inline: true },
        { name: "타깃 부스 ID", value: clubId, inline: true },
        { name: "5분 내 실패 횟수", value: `${count}회 연속 돌파`, inline: true },
        { name: "위협 진단", value: "무차별 대입 공격(Brute-Force) 또는 패킷 조작 적립 시도 의심", inline: false }
      ],
      timestamp: new Date().toISOString()
    }]
  };

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error("디스코드 웹훅 연합 전송 실패:", err);
  }
}


// ====================================================================
// 💻 L2: 부스용 (Booth Terminal) 실시간 로직
// ====================================================================

let activeBoothId = null;

async function initBoothPage() {
  console.log("L2 부스 대시보드 페이지 연동 개시...");
  
  const urlParams = new URLSearchParams(window.location.search);
  activeBoothId = urlParams.get("boothId");

  if (!activeBoothId || isDemoMode) return;

  // 1. 실시간 누적 방문 학생 수 수집 및 갱신 구독
  updateBoothVisitorMetrics();

  // Supabase의 Realtime 기능 활성화 (stamps 테이블의 특정 부스 행 삽입 실시간 감지)
  supabase
    .channel(`realtime-booth-${activeBoothId}`)
    .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'stamps', 
        filter: `club_id=eq.${activeBoothId}` 
    }, (payload) => {
        console.log("새로운 실시간 방문자 유입 감지!", payload);
        // 토스트 알림 울려주고 실시간 수치 갱신
        showNotification("새로운 학생의 스탬프 도장이 승인되었습니다!", "success");
        updateBoothVisitorMetrics();
    })
    .subscribe();
}

/**
 * 내 부스 고유의 누적 방문 완료 학생 수를 카운팅하여 갱신
 */
async function updateBoothVisitorMetrics() {
  if (isDemoMode || !activeBoothId) return;

  const { count, error } = await supabase
    .from("stamps")
    .select("*", { count: "exact", head: true })
    .eq("club_id", activeBoothId);

  if (!error) {
    document.getElementById("booth-visitor-count").innerText = `${count}명`;
  }
}

/**
 * 30초 갱신 타이머마다 부스가 생성한 신규 OTP를 Supabase에 동기화
 */
async function syncBoothOTPToDatabase(boothId, newOtp, expirySeconds) {
  if (isDemoMode) return;

  const expiresAt = new Date(Date.now() + expirySeconds * 1000).toISOString();

  const { error } = await supabase
    .from("clubs_status")
    .upsert({
      club_id: boothId,
      current_otp: newOtp,
      otp_expires_at: expiresAt,
      last_login_at: new Date().toISOString()
    }, { onConflict: 'club_id' });

  if (error) {
    console.error("OTP DB 동기화 실패:", error);
  }
}


// ====================================================================
// 🛠️ L3: 관리자용 (Admin Control) 실시간 로직
// ====================================================================

async function initAdminPage() {
  console.log("L3 통합 관제탑 페이지 연동 개시...");
  if (isDemoMode) return;

  // 1. 초기 통계치 수집
  fetchAllAdminMetrics();

  // 2. 실시간 모니터링 채널 수립 (전체 테이블 구독)
  supabase
    .channel('realtime-admin-hub')
    // 스탬프 획득 실시간 추적
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stamps' }, (payload) => {
        fetchAllAdminMetrics();
        addLiveAuditLogOnUI(payload.new.club_id, "SUCCESS", `학번 [${payload.new.student_id}] 스탬프 즉각 적립 성공.`);
    })
    // 어뷰징 및 공격 로그 실시간 추적
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stamp_logs' }, (payload) => {
        if (payload.new.status !== "SUCCESS") {
            fetchAllAdminMetrics();
            addLiveAuditLogOnUI(payload.new.club_id, "THREAT", `학번 [${payload.new.student_id}] 인증 거부 감지됨. 입력 코드: ${payload.new.input_code}`);
        }
    })
    .subscribe();
}

/**
 * 관리자 핵심 통계 및 카드 메트릭 일괄 실시간 수신
 */
async function fetchAllAdminMetrics() {
  if (isDemoMode) return;

  // 1. 총 적립 건수 카운트
  const { count: totalStamps, error: err1 } = await supabase
    .from("stamps")
    .select("*", { count: "exact", head: true });
    
  if (!err1) document.getElementById("metric-total-stamps").innerText = totalStamps;

  // 2. 보안 제어 차단 로그 건수 카운트
  const { count: totalThreats, error: err2 } = await supabase
    .from("stamp_logs")
    .select("*", { count: "exact", head: true })
    .neq("status", "SUCCESS");

  if (!err2) document.getElementById("metric-threats-blocked").innerText = totalThreats;

  // 3. 부스별 데이터 개별 카운트 업데이트
  const config = window.FESTIVAL_CONFIG;
  if (config) {
    for (const club of config.clubs) {
      const { count: boothCount } = await supabase
        .from("stamps")
        .select("*", { count: "exact", head: true })
        .eq("club_id", club.id);
      
      const visitorEl = document.getElementById(`visitors-${club.id}`);
      if (visitorEl) {
        visitorEl.innerText = `${boothCount || 0}명`;
      }
    }
  }
}

/**
 * 실시간 DB 감지 결과를 UI 감사 스트림판에 직접 연결해 주는 프론트엔드 바인딩 함수
 */
function addLiveAuditLogOnUI(clubId, type, message) {
  // admin.html 파일 내에 존재하는 addAuditLog 전역 함수 호출 유도
  if (typeof window.addAuditLog === "function") {
    window.addAuditLog(clubId, type, message);
  }
}


// ====================================================================
// 공용 외부 노출 전역 브릿지 (HTML 스크립트 결합용)
// ====================================================================
window.BACKEND = {
  processStampVerification,
  syncBoothOTPToDatabase,
  isDemoMode: () => isDemoMode
};

