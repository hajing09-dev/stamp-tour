document.addEventListener("DOMContentLoaded", async () => {
  // 관리자 권한 확인 및 초기화
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    alert("로그인이 필요합니다.");
    window.location.href = "./portal.html";
    return;
  }

  // L3 총괄 관리자 권한 및 승인 여부 검증
  const { data: profile } = await supabase
    .from("users")
    .select("role, is_approved")
    .eq("student_id", session.user.email)
    .single();

  if (!profile || profile.role !== 'L3' || !profile.is_approved) {
    alert("총괄 관리자(L3) 권한이 없거나 승인되지 않은 계정입니다.");
    window.location.href = "./portal.html";
    return;
  }

  console.log("L3 통합 관제탑 실시간 연동 개시...");

  // 1. 대시보드 메트릭 및 승인 대기 명단 초기화 로드
  fetchAllAdminMetrics();
  loadPendingBooths();

  // 2. 실시간 모니터링 채널 구축 (전체 테이블 구독)
  supabase
    .channel('realtime-admin-hub')
    // 쾅! 도장이 찍힐 때마다 대시보드 숫자를 새로고침하고 로그 보드에 기록
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stamps' }, (payload) => {
        fetchAllAdminMetrics();
        addLiveAuditLogOnUI(payload.new.club_id, "SUCCESS", `학번 [${payload.new.student_id}] 스탬프 즉각 적립 성공.`);
    })
    // 🚨 누군가 치팅을 시도하거나 에러가 나면 실시간으로 관제탑에 사이렌 로그 출력
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stamp_logs' }, (payload) => {
        if (payload.new.status !== "SUCCESS") {
            fetchAllAdminMetrics();
            addLiveAuditLogOnUI(payload.new.club_id, "THREAT", `학번 [${payload.new.student_id}] 인증 거부! 입력 코드: ${payload.new.input_code} (${payload.new.status})`);
        }
    })
    // 👤 새로운 부스 운영진이 가입하면 승인 대기 명단 실시간 새로고침
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'users', filter: "role=eq.L2" }, () => {
        loadPendingBooths();
    })
    .subscribe();
});

/**
 * 대시보드 핵심 통계 메트릭 실시간 일괄 수신
 */
async function fetchAllAdminMetrics() {
  // 1. 총 적립 건수 카운트
  const { count: totalStamps } = await supabase
    .from("stamps")
    .select("*", { count: "exact", head: true });
    
  if (document.getElementById("metric-total-stamps")) {
    document.getElementById("metric-total-stamps").innerText = totalStamps || 0;
  }

  // 2. 보안 차단 로그 건수 카운트
  const { count: totalThreats } = await supabase
    .from("stamp_logs")
    .select("*", { count: "exact", head: true })
    .neq("status", "SUCCESS");

  if (document.getElementById("metric-threats-blocked")) {
    document.getElementById("metric-threats-blocked").innerText = totalThreats || 0;
  }

  // 3. 설정된 부스별 실시간 도장 개수 카운트
  if (window.FESTIVAL_CONFIG) {
    for (const club of window.FESTIVAL_CONFIG.clubs) {
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
 * 🔑 승인 대기 중(is_approved = false)인 L2 부스 운영진 목록 로드
 */
async function loadPendingBooths() {
  const { data: pendingUsers, error } = await supabase
    .from("users")
    .select("student_id, name, club_id")
    .eq("role", "L2")
    .eq("is_approved", false);

  if (error) return;

  const container = document.getElementById("pending-booths-list");
  if (!container) return;
  
  container.innerHTML = "";

  if (pendingUsers.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-500 py-2">승인 대기 중인 부스가 없습니다.</p>`;
    return;
  }

  pendingUsers.forEach(user => {
    const row = `
      <div class="flex justify-between items-center bg-slate-900 border border-slate-800 p-3 rounded-xl mb-2">
        <div>
          <p class="text-xs font-bold text-slate-200">${user.name} (${user.student_id})</p>
          <p class="text-[10px] text-indigo-400 font-semibold">담당 부스: ${user.club_id}</p>
        </div>
        <button onclick="approveBoothManager('${user.student_id}')" class="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all">
          승인
        </button>
      </div>
    `;
    container.insertAdjacentHTML("beforeend", row);
  });
}

/**
 * 🔘 [관리자 권한 행사] 버튼 클릭 시 특정 운영진을 최종 승인(is_approved = true) 처리
 */
async function approveBoothManager(managerEmail) {
  const { error } = await supabase
    .from("users")
    .update({ is_approved: true })
    .eq("student_id", managerEmail);

  if (error) {
    alert("승인 처리 중 오류가 발생했습니다.");
  } else {
    alert("성공적으로 승인되었습니다. 해당 부스 화면이 실시간으로 열립니다.");
    loadPendingBooths();
  }
}

/**
 * 실시간 감사 스트림판에 로그 한 줄을 꽂아주는 브릿지 함수
 */
function addLiveAuditLogOnUI(clubId, type, message) {
  if (typeof window.addAuditLog === "function") {
    window.addAuditLog(clubId, type, message);
  }
}
