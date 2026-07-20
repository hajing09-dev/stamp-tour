let metricRefreshTimer = null;
function toSafeDomId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "_");
}

document.addEventListener("DOMContentLoaded", async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = "./portal.html"; return; }

  const { data: profile } = await supabase
    .from("users")
    .select("role, is_approved")
    .eq("student_id", session.user.email)
    .single();

  if (!profile || profile.role !== 'L3' || !profile.is_approved) {
    alert("총괄 관리자(L3) 권한이 없거나 미승인 상태입니다.");
    window.location.href = "./portal.html";
    return;
  }

  console.log("L3 통합 관제탑 실시간 연동 개시...");
  await fetchAllAdminMetrics();
  await loadPendingBooths();

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
    })
    .subscribe();
});

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

  if (document.getElementById("metric-active-booths")) {
    document.getElementById("metric-active-booths").innerText = totalClubs;
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

  let completedUsers = 0;
  if (totalClubs > 0) {
    for (const studentClubs of clubsByStudent.values()) {
      if (studentClubs.size >= totalClubs) completedUsers++;
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
    row.className = "flex justify-between items-center bg-slate-900 border border-slate-800 p-3 rounded-xl mb-2";

    const info = document.createElement("div");
    const title = document.createElement("p");
    title.className = "text-xs font-bold text-slate-200";
    title.textContent = `${user.name} (${(user.student_id || "").split("@")[0]})`;

    const sub = document.createElement("p");
    sub.className = "text-[10px] text-indigo-400 font-semibold";
    sub.textContent = `담당 부스: ${user.club_id}`;

    info.appendChild(title);
    info.appendChild(sub);

    const approveButton = document.createElement("button");
    approveButton.type = "button";
    approveButton.className = "bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all";
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
    alert("승인 완료!");
    loadPendingBooths();
  } else {
    alert("승인 처리 실패");
  }
}

function addLiveAuditLogOnUI(clubId, type, message) {
  if (typeof window.addAuditLog === "function") window.addAuditLog(clubId, type, message);
}
