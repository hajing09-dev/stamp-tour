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
  fetchAllAdminMetrics();
  loadPendingBooths();

  // 실시간 모니터링 매핑 체인 가동
  supabase
    .channel('realtime-admin-hub')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stamps' }, (payload) => {
        fetchAllAdminMetrics();
        addLiveAuditLogOnUI(payload.new.club_id, "SUCCESS", `학번 [${payload.new.student_id}] 스탬프 즉각 적립 성공.`);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stamp_logs' }, (payload) => {
        if (payload.new.status !== "SUCCESS") {
            fetchAllAdminMetrics();
            addLiveAuditLogOnUI(payload.new.club_id, "THREAT", `학번 [${payload.new.student_id}] 인증 거부! 사유: ${payload.new.status}`);
        }
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'users', filter: "role=eq.L2" }, () => {
        loadPendingBooths();
    })
    .subscribe();
});

async function fetchAllAdminMetrics() {
  const { count: totalStamps } = await supabase.from("stamps").select("*", { count: "exact", head: true });
  if (document.getElementById("metric-total-stamps")) {
    document.getElementById("metric-total-stamps").innerText = totalStamps || 0;
  }

  const { count: totalThreats } = await supabase.from("stamp_logs").select("*", { count: "exact", head: true }).neq("status", "SUCCESS");
  if (document.getElementById("metric-threats-blocked")) {
    document.getElementById("metric-threats-blocked").innerText = totalThreats || 0;
  }

  // 🔥 DB에서 실시간 부스 목록 긁어와 대시보드 통계 숫자 매핑 업데이트
  const { data: clubs } = await supabase.from("clubs").select("club_id");
  if (clubs) {
    for (const club of clubs) {
      const { count: boothCount } = await supabase.from("stamps").select("*", { count: "exact", head: true }).eq("club_id", club.club_id);
      const visitorEl = document.getElementById(`visitors-${club.club_id}`);
      if (visitorEl) visitorEl.innerText = `${boothCount || 0}명`;
    }
  }
}

async function loadPendingBooths() {
  const { data: pendingUsers } = await supabase.from("users").select("student_id, name, club_id").eq("role", "L2").eq("is_approved", false);
  const container = document.getElementById("pending-booths-list");
  if (!container) return;
  
  container.innerHTML = "";
  if (!pendingUsers || pendingUsers.length === 0) {
    container.innerHTML = `<p class="text-[11px] text-slate-500 py-4 text-center italic">승인 대기 중인 부스가 없습니다.</p>`;
    return;
  }

  pendingUsers.forEach(user => {
    const row = `
      <div class="flex justify-between items-center bg-slate-900 border border-slate-800 p-3 rounded-xl mb-2">
        <div>
          <p class="text-xs font-bold text-slate-200">${user.name} (${user.student_id.split('@')[0]})</p>
          <p class="text-[10px] text-indigo-400 font-semibold">담당 부스: ${user.club_id}</p>
        </div>
        <button onclick="approveBoothManager('${user.student_id}')" class="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all">승인</button>
      </div>
    `;
    container.insertAdjacentHTML("beforeend", row);
  });
}

async function approveBoothManager(managerEmail) {
  const { error } = await supabase.from("users").update({ is_approved: true }).eq("student_id", managerEmail);
  if (!error) { alert("승인 완료!"); loadPendingBooths(); }
}

function addLiveAuditLogOnUI(clubId, type, message) {
  if (typeof window.addAuditLog === "function") window.addAuditLog(clubId, type, message);
}
