let metricRefreshTimer = null;
let currentAdminEmail = null;

function toSafeDomId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "_");
}

document.addEventListener("DOMContentLoaded", async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = "./portal.html"; return; }

  currentAdminEmail = session.user.email;
  const localSessionId = localStorage.getItem("current_session_token");

  const { data: profile } = await supabase
    .from("users")
    .select("role, is_approved, active_session_id")
    .eq("student_id", session.user.email)
    .single();

  if (!profile || profile.role !== 'L3' || !profile.is_approved || (localSessionId && profile.active_session_id && profile.active_session_id !== localSessionId)) {
    await handleAdminSessionTermination();
    return;
  }

  console.log("L3 통합 관제탑 실시간 연동 개시...");
  await fetchAllAdminMetrics();
  await loadPendingBooths();
  await loadInitialAuditLogs(); // 과거 20건 블랙박스 로그 선행 로딩

  // 실시간 모니터링 매핑 체인 가동
  supabase
    .channel('realtime-admin-hub')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stamps' }, (payload) => {
        scheduleMetricsRefresh();
        addLiveAuditLogOnUI(payload.new.club_id, "SUCCESS", `학번 [${payload.new.student_id}] 스탬프 즉각 적립 성공.`);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stamp_logs' }, (payload) => {
        if (payload.new.status !== "SUCCESS") {
            scheduleMetricsRefresh();
            addLiveAuditLogOnUI(payload.new.club_id, "THREAT", `학번 [${payload.new.student_id}] 인증 거부! 사유: ${payload.new.status}`);
        }
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'users', filter: "role=eq.L2" }, () => {
        loadPendingBooths();
        scheduleMetricsRefresh();
    })
    .subscribe();

  // 단일 기기 세션 감지 실시간 리스너
  setupAdminSessionWatcher();
});

/**
 * 과거 20건 블랙박스 로그 선행 로딩
 */
async function loadInitialAuditLogs() {
  const { data: logs, error } = await supabase
    .from("stamp_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !logs || logs.length === 0) return;

  // 과거 로그는 오래된 순서대로 추가하여 최신 로그가 맨 위에 오도록 정렬
  const reversedLogs = [...logs].reverse();
  reversedLogs.forEach(log => {
    let type = "SUCCESS";
    let message = `학번 [${log.student_id}] 적립 요청 성공`;
    if (log.status !== "SUCCESS") {
      type = log.status.includes("SIMULATED") || log.status.includes("EXPIRED") ? "THREAT" : "WARNING";
      message = `학번 [${log.student_id}] 인증 거부: ${log.status}`;
    }
    if (typeof window.addAuditLog === "function") {
      window.addAuditLog(log.club_id, type, message, log.created_at);
    }
  });
}

/**
 * 단일 기기 세션 감지기 (Realtime & Polling)
 */
function setupAdminSessionWatcher() {
  if (!currentAdminEmail) return;
  const localSessionId = localStorage.getItem("current_session_token");

  // 1. Realtime 감지
  supabase
    .channel('realtime-admin-session')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'users',
      filter: `student_id=eq.${currentAdminEmail}`
    }, (payload) => {
      if (payload.new && payload.new.active_session_id && payload.new.active_session_id !== localSessionId) {
        handleAdminSessionTermination();
      }
    })
    .subscribe();

  // 2. 백업 polling (15초)
  setInterval(async () => {
    const { data: profile } = await supabase
      .from("users")
      .select("active_session_id")
      .eq("student_id", currentAdminEmail)
      .single();

    if (profile && profile.active_session_id && profile.active_session_id !== localSessionId) {
      handleAdminSessionTermination();
    }
  }, 15000);
}

async function handleAdminSessionTermination() {
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

function scheduleMetricsRefresh() {
  if (metricRefreshTimer) return;
  metricRefreshTimer = setTimeout(async () => {
    metricRefreshTimer = null;
    await fetchAllAdminMetrics();
  }, 300);
}

async function fetchAllAdminMetrics() {
  const { data: clubs, error: clubsError } = await supabase.from("clubs").select("club_id");
  if (clubsError || !clubs) return;

  const totalClubs = clubs.length;
  const clubIds = clubs.map((club) => club.club_id);
  const clubIdSet = new Set(clubIds);

  // 🔥 [개선] 연동 활성 부스 계산: 승인된 L2 운영진이 배정되어 있거나 clubs_status에 최근 활동이 있는 부스
  const { data: activeManagers } = await supabase
    .from("users")
    .select("club_id")
    .eq("role", "L2")
    .eq("is_approved", true);

  const { data: clubStatuses } = await supabase
    .from("clubs_status")
    .select("club_id, otp_expires_at, last_login_at");

  const activeClubSet = new Set();
  if (activeManagers) {
    activeManagers.forEach(m => { if (m.club_id) activeClubSet.add(m.club_id); });
  }
  if (clubStatuses) {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    clubStatuses.forEach(cs => {
      const lastLogin = cs.last_login_at ? new Date(cs.last_login_at) : null;
      if (lastLogin && lastLogin > tenMinutesAgo) {
        activeClubSet.add(cs.club_id);
      }
    });
  }

  // 활성 부스가 없으면 등록된 전체 부스 개수를 폴백으로 표시
  const activeBoothsCount = activeClubSet.size > 0 ? activeClubSet.size : totalClubs;
  if (document.getElementById("metric-active-booths")) {
    document.getElementById("metric-active-booths").innerText = activeBoothsCount;
  }

  const { data: stamps, error: stampsError } = await supabase.from("stamps").select("club_id, student_id");
  if (stampsError || !stamps) return;

  const totalStamps = stamps.length;
  if (document.getElementById("metric-total-stamps")) {
    document.getElementById("metric-total-stamps").innerText = totalStamps || 0;
  }

  const { count: totalThreats, error: threatError } = await supabase
    .from("stamp_logs")
    .select("*", { count: "exact", head: true })
    .neq("status", "SUCCESS");
  if (document.getElementById("metric-threats-blocked")) {
    document.getElementById("metric-threats-blocked").innerText = threatError ? 0 : (totalThreats || 0);
  }

  const countByClub = new Map();
  const clubsByStudent = new Map();

  for (const stamp of stamps) {
    if (!clubIdSet.has(stamp.club_id)) continue;
    countByClub.set(stamp.club_id, (countByClub.get(stamp.club_id) || 0) + 1);

    if (!clubsByStudent.has(stamp.student_id)) {
      clubsByStudent.set(stamp.student_id, new Set());
    }
    clubsByStudent.get(stamp.student_id).add(stamp.club_id);
  }

  for (const clubId of clubIds) {
    const visitorEl = document.getElementById(`visitors-${toSafeDomId(clubId)}`);
    if (visitorEl) visitorEl.innerText = `${countByClub.get(clubId) || 0}명`;
  }

  const { data: students, error: studentsError } = await supabase
    .from("users")
    .select("student_id")
    .eq("role", "L1")
    .eq("is_approved", true);

  let completedUsers = 0;
  if (totalClubs > 0) {
    if (!studentsError && students) {
      for (const student of students) {
        const studentClubs = clubsByStudent.get(student.student_id);
        if (studentClubs && studentClubs.size >= totalClubs) completedUsers++;
      }
    } else {
      for (const studentClubs of clubsByStudent.values()) {
        if (studentClubs.size >= totalClubs) completedUsers++;
      }
    }
  }
  if (document.getElementById("metric-completed-users")) {
    document.getElementById("metric-completed-users").innerText = completedUsers;
  }
}

async function loadPendingBooths() {
  const { data: pendingUsers, error } = await supabase
    .from("users")
    .select("student_id, name, club_id")
    .eq("role", "L2")
    .eq("is_approved", false);
  const container = document.getElementById("pending-booths-list");
  if (!container) return;
  
  container.innerHTML = "";
  if (error) {
    container.innerHTML = `<p class="text-[11px] text-rose-500 py-4 text-center italic">승인 대기 목록을 불러오지 못했습니다.</p>`;
    return;
  }

  if (!pendingUsers || pendingUsers.length === 0) {
    container.innerHTML = `<p class="text-[11px] text-slate-500 py-4 text-center italic">승인 대기 중인 부스가 없습니다.</p>`;
    return;
  }

  pendingUsers.forEach(user => {
    const row = document.createElement("div");
    row.className = "flex justify-between items-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl mb-2";

    const info = document.createElement("div");
    const title = document.createElement("p");
    title.className = "text-xs font-bold text-slate-800 dark:text-slate-200";
    title.textContent = `${user.name} (${(user.student_id || "").split("@")[0]})`;

    const sub = document.createElement("p");
    sub.className = "text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold";
    sub.textContent = `담당 부스: ${user.club_id}`;

    info.appendChild(title);
    info.appendChild(sub);

    const approveButton = document.createElement("button");
    approveButton.type = "button";
    approveButton.className = "bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all shadow-md shadow-indigo-950/20";
    approveButton.textContent = "승인";
    approveButton.addEventListener("click", () => approveBoothManager(user.student_id));

    row.appendChild(info);
    row.appendChild(approveButton);
    container.appendChild(row);
  });
}

async function approveBoothManager(managerEmail) {
  const { error } = await supabase.from("users").update({ is_approved: true }).eq("student_id", managerEmail);
  if (!error) {
    if (typeof window.showNotification === "function") {
      window.showNotification("부스 운영진 승인 완료!", "success");
    } else {
      alert("승인 완료!");
    }
    loadPendingBooths();
    fetchAllAdminMetrics();
  } else {
    alert("승인 처리 실패");
  }
}

function addLiveAuditLogOnUI(clubId, type, message) {
  if (typeof window.addAuditLog === "function") window.addAuditLog(clubId, type, message);
}
