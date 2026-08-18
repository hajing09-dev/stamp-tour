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
  const { data: clubs, error } = await supabase.from("clubs").select("club_id, name");
  if (error || !clubs) {
    showNotification("부스 목록을 불러오지 못했습니다.", "error");
    return;
  }

  // 총 부스 개수를 목표 스탬프 수로 자동 치환 계산
  window.targetStampsCount = clubs.length;
  document.getElementById("target-count-desc").innerText = `목표: ${clubs.length}개 완료`;

  if (typeof window.renderBoothCards === "function") {
    window.renderBoothCards(clubs.map(c => ({ id: c.club_id, name: c.name })));
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
