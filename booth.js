let activeBoothId = null;
let currentManagerEmail = null;

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  activeBoothId = urlParams.get("boothId")?.trim();
  if (!activeBoothId) {
    window.location.href = "./portal.html";
    return;
  }

  const isAllowed = await validateBoothAccess(activeBoothId);
  if (!isAllowed) return;

  const { data: booth, error: boothError } = await supabase
    .from("clubs")
    .select("name")
    .eq("club_id", activeBoothId)
    .single();

  if (boothError) {
    if (typeof window.showNotification === "function") {
      window.showNotification("부스 정보를 불러오지 못했습니다.", "error");
    }
    return;
  }

  if (booth) {
    document.getElementById("header-booth-title").innerText = booth.name;
  }

  await updateBoothVisitorMetrics();
  await loadRecentBoothVisitors();

  // 실시간 방문 카운트 리스닝 구독
  supabase
    .channel(`realtime-booth-${activeBoothId}`)
    .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'stamps', 
        filter: `club_id=eq.${activeBoothId}` 
    }, () => {
        updateBoothVisitorMetrics();
        loadRecentBoothVisitors();
    })
    .subscribe();

  // 단일 기기 세션 감지 실시간 리스너
  setupSingleSessionWatcher();

  // 기본적으로 카메라 스캐너 초기화 및 가동
  initBoothScanner();
});

async function validateBoothAccess(expectedBoothId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.email) {
    sessionStorage.removeItem("session_token");
    localStorage.removeItem("current_session_token");
    window.location.href = "./portal.html";
    return false;
  }

  currentManagerEmail = session.user.email;
  const localSessionId = localStorage.getItem("current_session_token");

  const { data: profile, error } = await supabase
    .from("users")
    .select("role, is_approved, club_id, active_session_id")
    .eq("student_id", session.user.email)
    .single();

  if (
    error ||
    !profile ||
    !profile.is_approved ||
    profile.role !== "L2" ||
    profile.club_id !== expectedBoothId ||
    (localSessionId && profile.active_session_id && profile.active_session_id !== localSessionId)
  ) {
    await handleSessionTermination();
    return false;
  }

  return true;
}

/**
 * 단일 기기 세션 감지기 (Realtime & Polling)
 */
function setupSingleSessionWatcher() {
  if (!currentManagerEmail) return;

  const localSessionId = localStorage.getItem("current_session_token");

  // 1. Supabase Realtime으로 users 테이블의 active_session_id 변경 감지
  supabase
    .channel(`realtime-session-${activeBoothId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'users',
      filter: `student_id=eq.${currentManagerEmail}`
    }, (payload) => {
      if (payload.new && payload.new.active_session_id && payload.new.active_session_id !== localSessionId) {
        handleSessionTermination();
      }
    })
    .subscribe();

  // 2. 주기적 백업 polling (15초마다)
  setInterval(async () => {
    const { data: profile } = await supabase
      .from("users")
      .select("active_session_id")
      .eq("student_id", currentManagerEmail)
      .single();

    if (profile && profile.active_session_id && profile.active_session_id !== localSessionId) {
      handleSessionTermination();
    }
  }, 15000);
}

async function handleSessionTermination() {
  const modal = document.getElementById("duplicate-session-modal");
  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  }

  if (window.supabase) {
    await supabase.auth.signOut();
  }
  sessionStorage.removeItem("session_token");
  localStorage.removeItem("current_session_token");

  setTimeout(() => {
    window.location.href = "./portal.html";
  }, 3000);
}

// ---------------------------------------------------------
// 📷 부스 운영진 학생 QR 스캔 및 지급 컨트롤러
// ---------------------------------------------------------
let boothQrScanner = null;
let isScanProcessing = false;
let lastScannedPayload = null;
let lastScannedTimestamp = 0;

/**
 * 카메라 스캐너 초기화 및 가동
 */
function initBoothScanner() {
  const readerEl = document.getElementById("booth-qr-reader");
  if (!readerEl) return;

  if (boothQrScanner) {
    try {
      const isRunning = boothQrScanner.isScanning || (boothQrScanner.getState && boothQrScanner.getState() === 2);
      if (isRunning) {
        boothQrScanner.stop().catch(() => {}).finally(() => {
          boothQrScanner = null;
          startScannerEngine();
        });
        return;
      }
    } catch (e) {}
    boothQrScanner = null;
  }
  startScannerEngine();
}

function startScannerEngine() {
  try {
    boothQrScanner = new Html5Qrcode("booth-qr-reader");
    const config = { fps: 15, qrbox: { width: 220, height: 220 } };

    boothQrScanner.start(
      { facingMode: "environment" },
      config,
      onStudentQrDetected,
      () => {}
    ).catch(err => {
      console.warn("후면 카메라 시작 실패, 기본 카메라로 재시도:", err);
      if (!boothQrScanner) return;
      boothQrScanner.start(
        { facingMode: "user" },
        config,
        onStudentQrDetected,
        () => {}
      ).catch(e => {
        const statusEl = document.getElementById("scan-status-text");
        if (statusEl) statusEl.innerText = "카메라 권한 필요 (학번 직접 입력 이용 가능)";
        if (typeof window.showNotification === "function") {
          window.showNotification("카메라 권한을 확인해 주세요. 학번 직접 입력 모드를 이용할 수 있습니다.", "error");
        }
      });
    });
  } catch (e) {
    console.error("Scanner init error:", e);
  }
}

function restartBoothScanner() {
  if (boothQrScanner) {
    try {
      const isRunning = boothQrScanner.isScanning || (boothQrScanner.getState && boothQrScanner.getState() === 2);
      if (isRunning) {
        boothQrScanner.stop().catch(() => {}).finally(() => {
          boothQrScanner = null;
          initBoothScanner();
        });
        return;
      }
    } catch (e) {}
    boothQrScanner = null;
  }
  initBoothScanner();
}
window.restartBoothScanner = restartBoothScanner;

/**
 * QR 스캔 감지 콜백
 */
async function onStudentQrDetected(decodedText) {
  if (isScanProcessing) return;

  const now = Date.now();
  // 동일한 학생 QR 연속 중복 스캔 방지 (3초 쿨다운)
  if (decodedText === lastScannedPayload && (now - lastScannedTimestamp) < 3000) {
    return;
  }

  isScanProcessing = true;
  lastScannedPayload = decodedText;
  lastScannedTimestamp = now;

  const statusEl = document.getElementById("scan-status-text");
  if (statusEl) statusEl.innerText = "스캔 감지! 처리 중...";

  try {
    await grantStampToStudent(decodedText);
  } finally {
    setTimeout(() => {
      isScanProcessing = false;
      if (statusEl) statusEl.innerText = "카메라 스캔 가동 중";
    }, 1500);
  }
}

/**
 * 학생에게 스탬프 지급 처리 RPC 호출
 */
async function grantStampToStudent(studentInput) {
  if (!activeBoothId) return;

  try {
    const { data: res, error } = await supabase.rpc('booth_grant_stamp', {
      p_student_id: studentInput
    });

    if (error) {
      if (typeof window.showNotification === "function") {
        window.showNotification("서버 통신 오류가 발생했습니다.", "error");
      }
      if (typeof window.showFeedbackBanner === "function") {
        window.showFeedbackBanner("ERROR", "통신 오류", error.message);
      }
      return;
    }

    if (res.status === 'SUCCESS') {
      if (typeof window.showNotification === "function") {
        window.showNotification(`[${res.student_id} ${res.student_name}] 스탬프 지급 완료!`, "success");
      }
      if (typeof window.showFeedbackBanner === "function") {
        window.showFeedbackBanner("SUCCESS", "스탬프 적립 성공!", `${res.student_name} (${res.student_id}) · 총 ${res.total_stamps}개`);
      }
      if (typeof window.playBeepSound === "function") {
        window.playBeepSound("success");
      }
      if (typeof window.triggerBoothConfetti === "function") {
        window.triggerBoothConfetti();
      }

      await updateBoothVisitorMetrics();
      await loadRecentBoothVisitors();

    } else if (res.status === 'ALREADY_STAMPED') {
      if (typeof window.showNotification === "function") {
        window.showNotification(`이미 적립된 학생입니다. (${res.student_name})`, "info");
      }
      if (typeof window.showFeedbackBanner === "function") {
        window.showFeedbackBanner("WARNING", "이미 적립 완료된 학생", `${res.student_name} (${res.student_id}) · 누적 ${res.total_stamps}개`);
      }
      if (typeof window.playBeepSound === "function") {
        window.playBeepSound("warning");
      }
    } else {
      if (typeof window.showNotification === "function") {
        window.showNotification(res.message || "스탬프 지급 실패", "error");
      }
      if (typeof window.showFeedbackBanner === "function") {
        window.showFeedbackBanner("ERROR", "스탬프 지급 거부", res.message || "처리 실패");
      }
      if (typeof window.playBeepSound === "function") {
        window.playBeepSound("error");
      }
    }
  } catch (err) {
    console.error("Grant stamp error:", err);
  }
}
window.grantStampToStudent = grantStampToStudent;

/**
 * 부스 누적 방문자 수 메트릭 갱신
 */
async function updateBoothVisitorMetrics() {
  if (!activeBoothId) return;

  const { count, error } = await supabase
    .from("stamps")
    .select("*", { count: "exact", head: true })
    .eq("club_id", activeBoothId);

  if (error) return;

  const countEl = document.getElementById("booth-visitor-count");
  if (countEl) {
    countEl.innerText = `${count || 0}`;
  }
}

/**
 * 최근 적립 학생 피드 로딩
 */
async function loadRecentBoothVisitors() {
  if (!activeBoothId) return;

  const feedContainer = document.getElementById("booth-recent-feed");
  if (!feedContainer) return;

  const { data: recentStamps, error } = await supabase
    .from("stamps")
    .select("student_id, created_at")
    .eq("club_id", activeBoothId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error || !recentStamps || recentStamps.length === 0) {
    feedContainer.innerHTML = `
      <div class="text-center py-3 text-[11px] text-slate-400 dark:text-zinc-500">
        아직 적립된 학생이 없습니다.
      </div>
    `;
    return;
  }

  // 사용자 이름 매핑
  const studentEmails = recentStamps.map(s => s.student_id);
  const { data: users } = await supabase
    .from("users")
    .select("student_id, name")
    .in("student_id", studentEmails);

  const nameMap = new Map();
  if (users) {
    users.forEach(u => nameMap.set(u.student_id, u.name));
  }

  feedContainer.innerHTML = recentStamps.map(s => {
    const rawId = s.student_id.split("@")[0];
    const name = nameMap.get(s.student_id) || nameMap.get(rawId) || "참가자";
    const timeStr = new Date(s.created_at).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });

    return `
      <div class="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-[#18181b] border border-slate-200/60 dark:border-[#27272a]">
        <div class="flex items-center space-x-2">
          <div class="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-[10px]">
            ✓
          </div>
          <span class="font-mono font-bold text-slate-900 dark:text-zinc-100">${rawId}</span>
          <span class="text-slate-600 dark:text-zinc-300 font-medium">${name}</span>
        </div>
        <span class="text-[10px] font-mono text-slate-400 dark:text-zinc-500">${timeStr}</span>
      </div>
    `;
  }).join("");
}
