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
    setupStudentLifecycleSync();
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
  try {
    const { error } = await supabase.rpc('register_student', {
      p_student_id: currentStudent.id,
      p_name: currentStudent.name
    });
    return !error;
  } catch (e) {
    return false;
  }
}

/**
 * 학생 화면 라이프사이클 동기화기
 * 💡 학생 기기에서는 Supabase Realtime(WebSocket) 동시 접속 한도(Free 200명)를 점유하지 않고,
 *    QR 스캔 시점의 즉각적인 HTTP RPC 검증 및 화면 복귀(visibilitychange) 시점의 가벼운 REST 갱신으로 100% 안전하게 처리합니다.
 */
let isLifecycleSyncAttached = false;

function setupStudentLifecycleSync() {
  if (isLifecycleSyncAttached) return;
  isLifecycleSyncAttached = true;

  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "visible" && currentStudent) {
      await fetchStudentStamps();
      if (typeof currentStudentNav !== "undefined" && currentStudentNav === 'ranking') {
        fetchStudentLeaderboard();
      }
    }
  });
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

  showNotification("학생 정보 등록 중...", "info");
  try {
    const { error: regError } = await supabase.rpc('register_student', {
      p_student_id: studentId,
      p_name: name
    });

    if (regError) {
      showNotification("학생 등록 중 서버 통신 오류가 발생했습니다.", "error");
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
  document.getElementById("student-info-display").innerText = `${currentStudent.id} ${currentStudent.name}`;
  showNotification(window.APP_CONFIG?.messages?.welcomeStudent?.replace("{name}", name) || `환영합니다, ${name} 학생!`, "success");

  await fetchAndRenderClubsDynamic();
  await fetchStudentStamps();
  setupStudentLifecycleSync();
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

  const { data, error } = await supabase.rpc('get_student_stamps', {
    p_student_id: currentStudent.id
  });

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

// ---------------------------------------------------------
// 📱 학생 QR 코드 제시 시 1.5초 스마트 감지 폴링 엔진
// ---------------------------------------------------------
let qrModalPollingInterval = null;
let qrModalPollingTimeout = null;
let lastKnownStampCount = 0;

function startQrModalPolling() {
  stopQrModalPolling();
  lastKnownStampCount = window.userStamps ? window.userStamps.length : 0;

  // 1.5초 간격으로 스탬프 적립 여부 체크
  qrModalPollingInterval = setInterval(async () => {
    if (!currentStudent) return;
    const prevCount = lastKnownStampCount;

    await fetchStudentStamps();
    const currentCount = window.userStamps ? window.userStamps.length : 0;

    // 새로운 도장이 적립되었음을 감지!
    if (currentCount > prevCount) {
      stopQrModalPolling();

      // UI 축하 효과 및 오버레이 활성화
      const overlay = document.getElementById("qr-success-overlay");
      const desc = document.getElementById("qr-success-desc");
      if (overlay) {
        overlay.classList.remove("hidden");
        overlay.classList.add("flex");
      }
      if (desc) {
        desc.innerText = `스탬프 ${currentCount}개 적립 완료!`;
      }

      if (typeof window.triggerConfettiAnimation === "function") {
        window.triggerConfettiAnimation();
      }
      if (typeof window.playFanfareSound === "function") {
        window.playFanfareSound();
      }
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
      showNotification("🎉 스탬프가 성공적으로 적립되었습니다!", "success");

      // 1.5초 후 QR 모달 자동 닫기
      setTimeout(() => {
        if (typeof window.closeStudentQrModal === "function") {
          window.closeStudentQrModal();
        }
      }, 1500);
    }
  }, 1500);

  // 안전장치: 최대 60초 후 자동 폴링 중단
  qrModalPollingTimeout = setTimeout(() => {
    stopQrModalPolling();
  }, 60000);
}
window.startQrModalPolling = startQrModalPolling;

function stopQrModalPolling() {
  if (qrModalPollingInterval) {
    clearInterval(qrModalPollingInterval);
    qrModalPollingInterval = null;
  }
  if (qrModalPollingTimeout) {
    clearTimeout(qrModalPollingTimeout);
    qrModalPollingTimeout = null;
  }
}
window.stopQrModalPolling = stopQrModalPolling;

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
      const { data: myRankRes, error: myRankErr } = await supabase.rpc('get_my_rank', {
        p_student_id: currentStudent ? currentStudent.id : null
      });
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
