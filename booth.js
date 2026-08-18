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

  // 실시간 방문 카운트 리스닝 구독
  supabase
    .channel(`realtime-booth-${activeBoothId}`)
    .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'stamps', 
        filter: `club_id=eq.${activeBoothId}` 
    }, () => {
        if (typeof window.showNotification === "function") {
          window.showNotification("새로운 학생이 도장을 찍었습니다!", "success");
        }
        updateBoothVisitorMetrics();
    })
    .subscribe();

  // 단일 기기 세션 감지 실시간 리스너
  setupSingleSessionWatcher();
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

/**
 * 버튼 누르면 작동하는 1분 유효 커스텀 OTP 생성기
 */
async function handleGenerateNewOTP() {
  if (!activeBoothId) return;

  const newOtp = Math.floor(100000 + Math.random() * 900000).toString(); // 6자리 난수
  const expiresAt = new Date(Date.now() + 60 * 1000).toISOString(); // 1분 세팅

  const { error } = await supabase
    .from("clubs_status")
    .upsert({
      club_id: activeBoothId,
      current_otp: newOtp,
      otp_expires_at: expiresAt,
      last_login_at: new Date().toISOString()
    }, { onConflict: 'club_id' });

  if (!error) {
    const encryptedPayload = btoa(`${activeBoothId}:${newOtp}`);
    if (typeof window.makeQRCodeOnUI === "function") {
      window.makeQRCodeOnUI(encryptedPayload);
    }
    if (typeof window.showNotification === "function") {
      window.showNotification("1분 동안 유효한 새 QR 코드가 발급되었습니다.", "success");
    }
  } else {
    if (typeof window.showNotification === "function") {
      window.showNotification("OTP 서버 동기화 실패", "error");
    }
  }
}

async function updateBoothVisitorMetrics() {
  if (!activeBoothId) return;

  const { count, error } = await supabase
    .from("stamps")
    .select("*", { count: "exact", head: true })
    .eq("club_id", activeBoothId);

  if (error) return;

  if (document.getElementById("booth-visitor-count")) {
    document.getElementById("booth-visitor-count").innerText = `${count || 0}명`;
  }
}
