let currentStudent = null;
let registeredStamps = [];
let deferredPwaPrompt = null;

document.addEventListener("DOMContentLoaded", async () => {
  // 1. 서비스 워커 및 PWA 감지 초기화
  initPwaEngine();

  // 2. 학생 세션 복원
  const savedUser = localStorage.getItem("student_session");
  
  if (savedUser) {
    currentStudent = JSON.parse(savedUser);
    window.currentStudent = currentStudent;
    document.getElementById("student-info-display").innerText = `${currentStudent.id} ${currentStudent.name}`;
    document.getElementById("student-sub-display").innerText = window.APP_CONFIG?.student?.subDisplaySyncing || "스탬프 Tour 실시간 동기화 중";
    
    // DB 기반 동적 드로잉 파이프라인 가동 전에 Auth 세션 보장
    await ensureStudentAuthSession();
    await fetchAndRenderClubsDynamic();
    await fetchStudentStamps();
    subscribeStudentStamps();
  } else {
    openLoginModal();
  }
});

/**
 * PWA 서비스 워커 및 홈 화면 추가 배너 제어기
 */
function initPwaEngine() {
  // 서비스 워커 등록
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(err => {
        console.warn('ServiceWorker 등록 실패 (무시 가능):', err);
      });
    });
  }

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isDismissed = localStorage.getItem('pwa_banner_dismissed') === 'true';

  if (isStandalone || isDismissed) {
    return; // 이미 앱으로 실행 중이거나 사용자가 닫았으면 배너 미노출
  }

  const banner = document.getElementById('pwa-install-banner');
  const btnInstall = document.getElementById('btn-pwa-install');

  // Android / Chrome: beforeinstallprompt 이벤트 포착
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPwaPrompt = e;
    if (banner) banner.classList.remove('hidden');
  });

  if (btnInstall) {
    btnInstall.addEventListener('click', async () => {
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isIOS) {
        // iOS: 사파리 홈 화면 추가 안내 모달 표시
        const iosModal = document.getElementById('ios-pwa-modal');
        if (iosModal) iosModal.classList.replace('hidden', 'flex');
      } else if (deferredPwaPrompt) {
        deferredPwaPrompt.prompt();
        const { outcome } = await deferredPwaPrompt.userChoice;
        if (outcome === 'accepted') {
          if (banner) banner.classList.add('hidden');
        }
        deferredPwaPrompt = null;
      } else {
        alert("브라우저 메뉴에서 [홈 화면에 추가] 또는 [앱 설치]를 선택해 주세요.");
      }
    });
  }

  // iOS Safari 브라우저인 경우 배너 기본 노출
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) && !window.MSStream;
  if (isIOS && !isStandalone && !isDismissed && banner) {
    banner.classList.remove('hidden');
  }
}

async function ensureStudentAuthSession() {
  if (!currentStudent) return false;
  const fakeEmail = `${currentStudent.id}@festival.com`;
  const fakePassword = btoa(encodeURIComponent(`${currentStudent.id}_${currentStudent.name}`));

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.email === fakeEmail) return true;

    // L2/L3 등 다른 계정 세션이 공유 스토리지에 있으면 강제 로그아웃
    if (session) {
      await supabase.auth.signOut();
    }

    let { error: signInError } = await supabase.auth.signInWithPassword({
      email: fakeEmail,
      password: fakePassword
    });

    if (signInError) {
      let { error: signUpError } = await supabase.auth.signUp({
        email: fakeEmail,
        password: fakePassword,
        options: { data: { student_id: currentStudent.id, name: currentStudent.name, role: "L1" } }
      });
      if (signUpError) return false;
    }

    await supabase.from("users").upsert({
      student_id: fakeEmail,
      name: currentStudent.name,
      role: "L1",
      is_approved: true
    }, { onConflict: "student_id" });

    return true;
  } catch (e) {
    return false;
  }
}

function subscribeStudentStamps() {
  if (!currentStudent) return;
  const fakeEmail = `${currentStudent.id}@festival.com`;

  supabase
    .channel(`realtime-student-${currentStudent.id}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'stamps',
      filter: `student_id=eq.${fakeEmail}`
    }, () => {
      fetchStudentStamps();
    })
    .subscribe();
}

function openLoginModal() {
  const modal = document.getElementById("login-modal");
  if (modal) modal.classList.replace("hidden", "flex");
}

function closeLoginModal() {
  const modal = document.getElementById("login-modal");
  if (modal) modal.classList.replace("flex", "hidden");
}

/**
 * HTML 회원 정보 등록 폼 서브밋 핸들러
 */
async function handleRegister(event) {
  event.preventDefault();
  
  const studentId = document.getElementById("login-student-id").value.trim();
  const name = document.getElementById("login-student-name").value.trim();

  if (!/^\d{5}$/.test(studentId)) {
    showNotification("학번 5자리를 완벽히 입력해 주세요.", "error");
    return;
  }
  if (!name) {
    showNotification("이름을 입력해 주세요.", "error");
    return;
  }

  const fakeEmail = `${studentId}@festival.com`;
  const fakePassword = btoa(encodeURIComponent(`${studentId}_${name}`));

  showNotification("보안 세션 생성 중...", "info");
  try {
    const { data: { session: existingSession } } = await supabase.auth.getSession();
    if (existingSession && existingSession.user?.email !== fakeEmail) {
      await supabase.auth.signOut();
    }

    // Supabase Auth 연동 (기존 유저면 로그인, 없으면 가입)
    let { error: signInError } = await supabase.auth.signInWithPassword({
      email: fakeEmail,
      password: fakePassword
    });

    if (signInError) {
      let { error: signUpError } = await supabase.auth.signUp({
        email: fakeEmail,
        password: fakePassword,
        options: { data: { student_id: studentId, name: name, role: "L1" } }
      });

      if (signUpError) {
        showNotification("인증 세션 수립 실패", "error");
        return;
      }
    }

    // users 테이블 명의 동기화 (중복 가입 멱등 처리)
    const { error: profileError } = await supabase.from("users").upsert({
      student_id: fakeEmail,
      name: name,
      role: "L1",
      is_approved: true
    }, { onConflict: "student_id" });

    if (profileError) {
      showNotification("사용자 프로필 동기화 실패", "error");
      return;
    }
  } catch (e) {
    showNotification("인증 처리 중 오류가 발생했습니다.", "error");
    return;
  }

  currentStudent = { id: studentId, name: name };
  window.currentStudent = currentStudent;
  localStorage.setItem("student_session", JSON.stringify(currentStudent));
  
  closeLoginModal();
  showNotification(`${name}님, 스탬프 투어를 시작합니다!`, "success");
  
  document.getElementById("student-info-display").innerText = `${studentId} ${name}`;
  document.getElementById("student-sub-display").innerText = window.APP_CONFIG?.student?.subDisplayStarted || "스탬프 투어가 시작되었습니다!";
  await fetchAndRenderClubsDynamic();
  await fetchStudentStamps();
}

/**
 * DB에서 부스 리스트를 셀렉트해와 동적으로 도장판 그리게 명령
 */
async function fetchAndRenderClubsDynamic() {
  const { data: clubs, error } = await supabase.from("clubs").select("club_id, name, location");
  if (error || !clubs) {
    showNotification("부스 목록을 불러오지 못했습니다.", "error");
    return;
  }

  // 총 부스 개수를 목표 스탬프 수로 자동 치환 계산
  window.targetStampsCount = clubs.length;
  document.getElementById("target-count-desc").innerText = `목표: ${clubs.length}개 완료`;

  if (typeof window.renderBoothCards === "function") {
    window.renderBoothCards(clubs.map(c => ({ id: c.club_id, name: c.name, location: c.location })));
  }
  if (typeof window.renderBoothSelectOptions === "function") {
    window.renderBoothSelectOptions(clubs.map(c => ({ id: c.club_id, name: c.name })));
  }
}

async function fetchStudentStamps() {
  if (!currentStudent) return;

  const fakeEmail = `${currentStudent.id}@festival.com`;
  const { data, error } = await supabase
    .from("stamps")
    .select("club_id")
    .eq("student_id", fakeEmail);

  if (error) {
    showNotification("스탬프 데이터를 불러오지 못했습니다.", "error");
    return;
  }

  window.userStamps = data ? data.map(item => item.club_id) : [];
  if (typeof window.syncStampsToUI === "function") {
    window.syncStampsToUI();
  }
  if (typeof currentStudentNav !== "undefined" && currentStudentNav === 'ranking') {
    fetchStudentLeaderboard();
  }
}

async function processStampVerification(base64Payload) {
  try {
    const decoded = atob(base64Payload);
    const [clubId, otpCode] = decoded.split(":");
    if (!clubId || !/^\d{6}$/.test(otpCode || "")) {
      showNotification("유효하지 않은 인증 코드 형식입니다.", "error");
      return;
    }

    if (window.userStamps.includes(clubId)) {
      showNotification("이미 스탬프를 획득한 동아리 부스입니다.", "info");
      return;
    }

    // 서버 사이드 RPC 내장 보안 검증 전 Auth 세션 최종 확인
    await ensureStudentAuthSession();

    const { data: rpcResult, error } = await supabase.rpc('check_otp_and_stamp', {
      p_club_id: clubId,
      p_input_otp: otpCode
    });

    if (error) { showNotification("서버 통신 장애 발생", "error"); return; }

    if (rpcResult === 'SUCCESS') {
      showNotification(window.APP_CONFIG?.messages?.stampSuccess || "인증 성공! 도장이 적립되었습니다.", "success");
      await fetchStudentStamps();
    } else if (rpcResult === 'ALREADY_STAMPED') {
      showNotification(window.APP_CONFIG?.messages?.stampAlreadyExists || "이미 적립 완료된 부스입니다.", "info");
    } else if (rpcResult === 'ERROR_EXPIRED_CODE') {
      showNotification(window.APP_CONFIG?.messages?.stampExpiredCode || "만료된 인증 코드입니다. 새 코드를 찍어주세요.", "error");
    } else if (rpcResult === 'ERROR_NOT_A_STUDENT') {
      showNotification(window.APP_CONFIG?.messages?.stampNotStudent || "학생 계정으로 로그인 후 도장을 찍어주세요.", "error");
    } else if (rpcResult === 'ERROR_UNAUTHORIZED') {
      showNotification("인증 세션 수립에 실패했습니다. 다시 시도해 주세요.", "error");
    } else {
      showNotification("올바르지 않은 보안 코드입니다.", "error");
    }
  } catch (err) {
    showNotification("유효하지 않은 QR 코드 규격입니다.", "error");
  }
}

// ---------------------------------------------------------
// 3단 메뉴 내비게이션 (도장판 / 실시간 랭킹 / 제작 크레딧)
// ---------------------------------------------------------
let currentStudentNav = 'main';

function switchStudentNav(tab) {
  currentStudentNav = tab;
  const tabs = ['main', 'ranking', 'credits'];

  tabs.forEach(t => {
    const btn = document.getElementById(`student-tab-${t}`);
    const view = document.getElementById(`view-student-${t}`);
    
    if (t === tab) {
      if (btn) {
        btn.className = "student-tab-btn py-2 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all bg-white dark:bg-[#18181b] text-sky-600 dark:text-sky-400 shadow-sm border border-slate-200/60 dark:border-zinc-700/60";
      }
      if (view) view.classList.remove("hidden");
    } else {
      if (btn) {
        btn.className = "student-tab-btn py-2 px-2.5 rounded-lg text-xs font-medium flex items-center justify-center space-x-1.5 transition-all text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 border border-transparent";
      }
      if (view) view.classList.add("hidden");
    }
  });

  // 하단 스캔 바는 도장판(main)에서만 노출
  const bottomBar = document.getElementById("student-bottom-bar");
  if (bottomBar) {
    if (tab === 'main') {
      bottomBar.classList.remove("hidden");
    } else {
      bottomBar.classList.add("hidden");
    }
  }

  if (tab === 'ranking') {
    fetchStudentLeaderboard();
  } else if (tab === 'credits') {
    renderStudentCredits();
  }

  if (window.lucide) window.lucide.createIcons();
}
window.switchStudentNav = switchStudentNav;

/**
 * 실시간 랭킹 리더보드 데이터 조회 및 렌더링
 */
async function fetchStudentLeaderboard() {
  const container = document.getElementById("student-leaderboard-container");
  const refreshIcon = document.getElementById("ranking-refresh-icon");
  const myRankEl = document.getElementById("student-my-rank");
  const myStampsEl = document.getElementById("student-my-stamps");

  if (refreshIcon) refreshIcon.classList.add("animate-spin");

  try {
    // 1. 본인 순위 조회 (RPC get_my_rank 우선)
    let myRankData = null;
    try {
      const { data: myRankRes, error: myRankErr } = await supabase.rpc('get_my_rank');
      if (!myRankErr && myRankRes && myRankRes.length > 0) {
        myRankData = myRankRes[0];
      }
    } catch (e) {
      console.warn("get_my_rank RPC 호출 경고:", e);
    }

    // 본인 순위 배너 갱신
    const currentStampCount = window.userStamps?.length || 0;
    if (myRankData && myRankData.rank) {
      if (myRankEl) myRankEl.innerText = `${myRankData.rank}위`;
      if (myStampsEl) myStampsEl.innerText = `적립 ${myRankData.stamp_count}개`;
    } else {
      if (myRankEl) myRankEl.innerText = currentStampCount > 0 ? "집계 중" : "순위 외";
      if (myStampsEl) myStampsEl.innerText = `적립 ${currentStampCount}개`;
    }

    // 2. 전체 TOP 20 리더보드 조회 (RPC get_stamp_leaderboard)
    const { data: leaderboard, error: rpcError } = await supabase.rpc('get_stamp_leaderboard', { p_limit: 20 });

    if (rpcError) {
      console.warn("get_stamp_leaderboard RPC 오류:", rpcError);
      if (container) {
        container.innerHTML = `
          <div class="py-8 text-center text-xs text-slate-400 dark:text-zinc-500">
            <i data-lucide="info" class="w-5 h-5 mx-auto text-sky-500 mb-1.5"></i>
            <p>실시간 랭킹 산출 준비 중입니다.</p>
            <p class="text-[10px] text-slate-400 dark:text-zinc-600 mt-0.5">스탬프를 먼저 모아보세요!</p>
          </div>
        `;
      }
      return;
    }

    if (!leaderboard || leaderboard.length === 0) {
      if (container) {
        container.innerHTML = `
          <div class="py-8 text-center text-xs text-slate-400 dark:text-zinc-500">
            <i data-lucide="award" class="w-6 h-6 mx-auto text-slate-300 dark:text-zinc-600 mb-1.5"></i>
            <p>${window.APP_CONFIG?.ranking?.emptyLeaderboard || "아직 등록된 랭킹 데이터가 없습니다."}</p>
            <p class="text-[10px] text-slate-400 dark:text-zinc-600 mt-0.5">첫 번째 스탬프의 주인공이 되어보세요!</p>
          </div>
        `;
      }
      return;
    }

    // 마스킹 학번 생성 기준 (현재 유저와 매칭하여 하이라이트 여부 결정)
    const myMaskedId = currentStudent?.id ? (
      currentStudent.id.length >= 4 
        ? `${currentStudent.id.substring(0, 3)}**`
        : `${currentStudent.id.substring(0, 1)}**`
    ) : null;

    let html = "";
    leaderboard.forEach(item => {
      const isMe = myMaskedId && (item.masked_student_id === myMaskedId);
      const rankNum = Number(item.rank);

      // 메달 및 뱃지 스타일
      let rankBadgeHtml = "";
      if (rankNum === 1) {
        rankBadgeHtml = `
          <div class="w-7 h-7 rounded-lg bg-amber-400/15 dark:bg-amber-400/20 text-amber-600 dark:text-amber-400 border border-amber-400/40 flex items-center justify-center font-bold text-xs shadow-xs">
            🥇
          </div>
        `;
      } else if (rankNum === 2) {
        rankBadgeHtml = `
          <div class="w-7 h-7 rounded-lg bg-slate-200/70 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-300 dark:border-zinc-700 flex items-center justify-center font-bold text-xs shadow-xs">
            🥈
          </div>
        `;
      } else if (rankNum === 3) {
        rankBadgeHtml = `
          <div class="w-7 h-7 rounded-lg bg-amber-700/10 dark:bg-amber-700/20 text-amber-700 dark:text-amber-500 border border-amber-700/30 flex items-center justify-center font-bold text-xs shadow-xs">
            🥉
          </div>
        `;
      } else {
        rankBadgeHtml = `
          <div class="w-7 h-7 rounded-lg bg-slate-50 dark:bg-[#18181b] text-slate-500 dark:text-zinc-400 border border-slate-200/70 dark:border-[#27272a] flex items-center justify-center font-mono font-bold text-xs">
            ${rankNum}
          </div>
        `;
      }

      const rowBg = isMe 
        ? "bg-sky-50/70 dark:bg-sky-950/25 border-sky-400/50 dark:border-sky-800/60 shadow-xs" 
        : "bg-slate-50/50 dark:bg-[#18181b]/50 border-slate-200/60 dark:border-[#27272a]/80 hover:bg-slate-50 dark:hover:bg-[#18181b]";

      html += `
        <div class="flex items-center justify-between p-2.5 rounded-xl border ${rowBg} transition-all">
          <div class="flex items-center space-x-2.5 min-w-0">
            ${rankBadgeHtml}
            <div class="min-w-0">
              <div class="flex items-center space-x-1.5">
                <span class="font-mono text-xs font-bold text-slate-900 dark:text-zinc-100">${item.masked_student_id}</span>
                <span class="text-xs text-slate-600 dark:text-zinc-300 font-medium truncate">${item.masked_name}</span>
                ${isMe ? '<span class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-sky-500 text-white leading-tight">나</span>' : ''}
              </div>
            </div>
          </div>
          <div class="flex items-center space-x-2 shrink-0">
            <span class="text-xs font-mono font-bold text-sky-600 dark:text-sky-400 bg-white dark:bg-[#121215] border border-slate-200 dark:border-[#27272a] px-2 py-0.5 rounded-md">
              ${item.stamp_count}개
            </span>
          </div>
        </div>
      `;
    });

    if (container) container.innerHTML = html;

  } catch (err) {
    console.error("Leaderboard fetch error:", err);
  } finally {
    if (refreshIcon) {
      setTimeout(() => { refreshIcon.classList.remove("animate-spin"); }, 400);
    }
    if (window.lucide) window.lucide.createIcons();
  }
}
window.fetchStudentLeaderboard = fetchStudentLeaderboard;

/**
 * 제작진 크레딧 뷰 렌더링
 */
function renderStudentCredits() {
  const credits = window.APP_CONFIG?.credits;
  if (!credits) return;

  const subtitleEl = document.getElementById("student-credits-subtitle");
  const teamNameEl = document.getElementById("student-credits-team-name");
  const descEl = document.getElementById("student-credits-desc");
  const techStackEl = document.getElementById("student-credits-tech-stack");
  const repoNoticeEl = document.getElementById("student-credits-repo-notice");
  const membersContainer = document.getElementById("student-credits-members-container");

  if (subtitleEl && credits.subtitle) subtitleEl.innerText = credits.subtitle;
  if (teamNameEl && credits.teamName) teamNameEl.innerText = credits.teamName;
  if (descEl && credits.description) descEl.innerText = credits.description;
  if (techStackEl && credits.techStack) techStackEl.innerText = credits.techStack;
  if (repoNoticeEl && credits.repoNotice) repoNoticeEl.innerText = credits.repoNotice;

  if (membersContainer && Array.isArray(credits.members)) {
    membersContainer.innerHTML = credits.members.map(m => `
      <div class="bg-white dark:bg-[#121215] border border-slate-200/90 dark:border-[#27272a] rounded-xl p-3.5 shadow-xs space-y-1 hover:border-slate-300 dark:hover:border-zinc-700 transition-all">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-mono font-semibold text-sky-600 dark:text-sky-400 tracking-wide uppercase bg-sky-50 dark:bg-sky-950/60 border border-sky-100 dark:border-sky-900/40 px-2 py-0.5 rounded-md">${m.role}</span>
          <span class="text-xs font-bold text-slate-900 dark:text-zinc-100">${m.name}</span>
        </div>
        <p class="text-[11px] text-slate-500 dark:text-zinc-400 leading-snug pt-0.5">${m.desc || ""}</p>
      </div>
    `).join("");
  }

  if (window.lucide) window.lucide.createIcons();
}
window.renderStudentCredits = renderStudentCredits;
