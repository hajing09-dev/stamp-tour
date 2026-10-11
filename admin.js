let metricRefreshTimer = null;
let currentAdminEmail = null;
let currentAdminTab = "dashboard";
let cachedAdminLeaderboard = [];

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
  await loadInitialAuditLogs(); // 과거 20건 블랙박스 로그 선행 로딩
  renderCreditsMembers();

  // 실시간 모니터링 매핑 체인 가동
  supabase
    .channel('realtime-admin-hub')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stamps' }, (payload) => {
        scheduleMetricsRefresh();
        addLiveAuditLogOnUI(payload.new.club_id, "SUCCESS", `학번 [${payload.new.student_id}] 스탬프 즉각 적립 성공.`);
        if (currentAdminTab === "ranking") {
          fetchAdminLeaderboard();
        }
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stamp_logs' }, (payload) => {
        if (payload.new.status !== "SUCCESS") {
            scheduleMetricsRefresh();
            addLiveAuditLogOnUI(payload.new.club_id, "THREAT", `학번 [${payload.new.student_id}] 인증 거부! 사유: ${payload.new.status}`);
        }
    })
    .subscribe();

  // 단일 기기 세션 감지 실시간 리스너
  setupAdminSessionWatcher();
});

/**
 * 상단 탭 전환 제어 (실시간 관제탑 ↔ 스탬프 랭킹 & 경품 관리)
 */
function switchAdminTab(tabName) {
  currentAdminTab = tabName;
  const dashboardView = document.getElementById("admin-view-dashboard");
  const rankingView = document.getElementById("admin-view-ranking");
  const btnDashboard = document.getElementById("admin-tab-btn-dashboard");
  const btnRanking = document.getElementById("admin-tab-btn-ranking");

  const activeClass = "flex-1 py-2 px-3 rounded-lg text-center transition-all bg-white dark:bg-[#121215] text-slate-900 dark:text-zinc-100 shadow-sm flex items-center justify-center space-x-1.5";
  const inactiveClass = "flex-1 py-2 px-3 rounded-lg text-center transition-all text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 flex items-center justify-center space-x-1.5";

  if (tabName === "dashboard") {
    if (dashboardView) dashboardView.classList.remove("hidden");
    if (rankingView) rankingView.classList.add("hidden");
    if (btnDashboard) btnDashboard.className = activeClass;
    if (btnRanking) btnRanking.className = inactiveClass;
  } else {
    if (dashboardView) dashboardView.classList.add("hidden");
    if (rankingView) rankingView.classList.remove("hidden");
    if (btnDashboard) btnDashboard.className = inactiveClass;
    if (btnRanking) btnRanking.className = activeClass;
    fetchAdminLeaderboard();
  }
  lucide.createIcons();
}

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

/**
 * 대시보드 4개 핵심 메트릭 갱신
 */
async function fetchAllAdminMetrics() {
  // 1. 전체 등록 부스 수
  const { data: clubs, error: clubsError } = await supabase.from("clubs").select("club_id");
  if (clubsError || !clubs) return;

  const totalClubs = clubs.length;
  const clubIds = clubs.map((club) => club.club_id);
  const clubIdSet = new Set(clubIds);

  const activeBoothsEl = document.getElementById("metric-active-booths");
  if (activeBoothsEl) activeBoothsEl.innerText = totalClubs;

  // 2. 총 스탬프 적립 건수 & 참여 학생 수
  const { data: stamps, error: stampsError } = await supabase.from("stamps").select("club_id, student_id");
  if (stampsError || !stamps) return;

  const totalStamps = stamps.length;
  const totalStampsEl = document.getElementById("metric-total-stamps");
  if (totalStampsEl) totalStampsEl.innerText = totalStamps || 0;

  // 고유 참여 학생 수 집계
  const participantSet = new Set();
  const countByClub = new Map();

  for (const stamp of stamps) {
    if (stamp.student_id) participantSet.add(stamp.student_id);
    if (clubIdSet.has(stamp.club_id)) {
      countByClub.set(stamp.club_id, (countByClub.get(stamp.club_id) || 0) + 1);
    }
  }

  const participantsEl = document.getElementById("metric-total-participants");
  if (participantsEl) participantsEl.innerText = participantSet.size;

  // 3. 부스별 적립 완료 학생 수 반영
  for (const clubId of clubIds) {
    const visitorEl = document.getElementById(`visitors-${toSafeDomId(clubId)}`);
    if (visitorEl) visitorEl.innerText = `${countByClub.get(clubId) || 0}명`;
  }

  // 4. 보안 차단/오류 로그 집계
  const { count: totalThreats, error: threatError } = await supabase
    .from("stamp_logs")
    .select("*", { count: "exact", head: true })
    .neq("status", "SUCCESS");
  const threatsEl = document.getElementById("metric-threats-blocked");
  if (threatsEl) threatsEl.innerText = threatError ? 0 : (totalThreats || 0);
}

/**
 * 관리자용 실시간 랭킹 & 경품 관리 리더보드 데이터 로드
 */
async function fetchAdminLeaderboard() {
  const tbody = document.getElementById("admin-ranking-tbody");
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="5" class="py-12 text-center text-slate-400 dark:text-zinc-500">
        <i data-lucide="loader" class="w-5 h-5 mx-auto mb-2 animate-spin text-sky-500"></i>
        <span>실시간 랭킹 집계 중...</span>
      </td>
    </tr>
  `;
  lucide.createIcons();

  try {
    const { data: stamps, error: stampsError } = await supabase
      .from("stamps")
      .select("student_id, created_at");

    if (stampsError || !stamps) {
      tbody.innerHTML = `<tr><td colspan="5" class="py-10 text-center text-rose-500">스탬프 내역을 불러오지 못했습니다.</td></tr>`;
      return;
    }

    const { data: users } = await supabase
      .from("users")
      .select("student_id, name")
      .eq("role", "L1");

    const nameMap = new Map();
    if (users) {
      users.forEach(u => nameMap.set(u.student_id, u.name));
    }

    // 학생별 스탬프 개수 및 최근 적립 시점 집계
    const statsMap = new Map();
    stamps.forEach(s => {
      const email = s.student_id;
      if (!statsMap.has(email)) {
        statsMap.set(email, { count: 0, lastTime: s.created_at });
      }
      const item = statsMap.get(email);
      item.count += 1;
      if (new Date(s.created_at) > new Date(item.lastTime)) {
        item.lastTime = s.created_at;
      }
    });

    const list = Array.from(statsMap.entries()).map(([email, data]) => {
      const rawId = email.split("@")[0];
      const name = nameMap.get(email) || nameMap.get(rawId) || "이름 미등록";
      return {
        email,
        studentId: rawId,
        name,
        count: data.count,
        lastTime: data.lastTime
      };
    });

    // 1순위: 스탬프 수 DESC, 2순위: 먼저 달성한 시간 ASC
    list.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return new Date(a.lastTime) - new Date(b.lastTime);
    });

    // Dense Rank 계산
    let currentRank = 1;
    for (let i = 0; i < list.length; i++) {
      if (i > 0) {
        const prev = list[i - 1];
        if (list[i].count === prev.count && list[i].lastTime === prev.lastTime) {
          list[i].rank = prev.rank;
        } else {
          currentRank = i + 1;
          list[i].rank = currentRank;
        }
      } else {
        list[i].rank = 1;
      }
    }

    cachedAdminLeaderboard = list;

    const totalCountEl = document.getElementById("admin-ranking-total-count");
    if (totalCountEl) totalCountEl.innerText = `${list.length}명`;

    renderAdminLeaderboardRows(cachedAdminLeaderboard);
  } catch (err) {
    console.error("랭킹 집계 오류:", err);
    tbody.innerHTML = `<tr><td colspan="5" class="py-10 text-center text-rose-500">랭킹 계산 중 오류가 발생했습니다.</td></tr>`;
  }
}

function renderAdminLeaderboardRows(dataList) {
  const tbody = document.getElementById("admin-ranking-tbody");
  if (!tbody) return;

  if (dataList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-12 text-center text-slate-400 dark:text-zinc-500 text-xs">
          일치하는 학생 데이터가 없습니다.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = "";
  dataList.forEach(item => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50/70 dark:hover:bg-[#18181b]/50 transition-colors";

    // 랭킹 뱃지 스타일
    let rankBadge = `<span class="font-mono font-bold text-slate-500 dark:text-zinc-400">${item.rank}</span>`;
    if (item.rank === 1) {
      rankBadge = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-400/20 text-amber-600 dark:text-amber-400 font-bold text-xs">🥇 1</span>`;
    } else if (item.rank === 2) {
      rankBadge = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-300/30 text-slate-700 dark:text-zinc-300 font-bold text-xs">🥈 2</span>`;
    } else if (item.rank === 3) {
      rankBadge = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/20 text-amber-800 dark:text-amber-500 font-bold text-xs">🥉 3</span>`;
    }

    const formattedTime = item.lastTime ? new Date(item.lastTime).toLocaleString("ko-KR", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }) : "-";

    tr.innerHTML = `
      <td class="py-3 px-4 text-center">${rankBadge}</td>
      <td class="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-zinc-100 select-all">${item.studentId}</td>
      <td class="py-3 px-4 font-bold text-slate-900 dark:text-zinc-100">${item.name}</td>
      <td class="py-3 px-4 text-center">
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-500/20">
          ${item.count}개
        </span>
      </td>
      <td class="py-3 px-4 text-right text-[11px] font-mono text-slate-400 dark:text-zinc-500">${formattedTime}</td>
    `;
    tbody.appendChild(tr);
  });
}

function filterAdminLeaderboard() {
  const query = document.getElementById("admin-ranking-search")?.value?.trim().toLowerCase() || "";
  if (!query) {
    renderAdminLeaderboardRows(cachedAdminLeaderboard);
    return;
  }

  const filtered = cachedAdminLeaderboard.filter(item => {
    return (
      item.studentId.toLowerCase().includes(query) ||
      item.name.toLowerCase().includes(query)
    );
  });
  renderAdminLeaderboardRows(filtered);
}

/**
 * 제작 크레딧 모달 제어
 */
function openCreditsModal() {
  const modal = document.getElementById("admin-credits-modal");
  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  }
}

function closeCreditsModal() {
  const modal = document.getElementById("admin-credits-modal");
  if (modal) {
    modal.classList.remove("flex");
    modal.classList.add("hidden");
  }
}

function renderCreditsMembers() {
  const container = document.getElementById("admin-credits-members-container");
  if (!container || container.children.length > 0) return;

  const members = window.APP_CONFIG?.credits?.members || [];
  members.forEach(m => {
    const card = document.createElement("div");
    card.className = "p-2.5 rounded-xl bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-[#27272a] flex flex-col space-y-0.5";
    card.innerHTML = `
      <div class="flex justify-between items-center">
        <span class="font-bold text-slate-900 dark:text-zinc-100 text-xs">${m.name}</span>
        <span class="text-[10px] font-mono text-sky-600 dark:text-sky-400 font-semibold">${m.role}</span>
      </div>
      <p class="text-[11px] text-slate-500 dark:text-zinc-400">${m.desc}</p>
    `;
    container.appendChild(card);
  });
}

function addLiveAuditLogOnUI(clubId, type, message) {
  if (typeof window.addAuditLog === "function") window.addAuditLog(clubId, type, message);
}
