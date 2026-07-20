let currentStudent = null;
let registeredStamps = [];

// 1. 페이지 진입 시 세션 체크 및 초기화
document.addEventListener("DOMContentLoaded", async () => {
  const savedUser = localStorage.getItem("student_session");
  
  if (savedUser) {
    currentStudent = JSON.parse(savedUser);
    document.getElementById("student-info-display").innerText = `${currentStudent.id} ${currentStudent.name}`;
    document.getElementById("student-sub-display").innerText = "스탬프 Tour 실시간 동기화 중";
    
    // DB 기반 동적 드로잉 파이프라인 가동
    await fetchAndRenderClubsDynamic();
    await fetchStudentStamps();
  } else {
    // 예쁜 HTML 내장 로그인 모달 오픈
    openLoginModal();
  }
});

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
  document.getElementById("student-sub-display").innerText = "스탬프 투어가 시작되었습니다!";
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

    // 서버 사이드 RPC 내장 보안 검증 기동
    const { data: rpcResult, error } = await supabase.rpc('check_otp_and_stamp', {
      p_club_id: clubId,
      p_input_otp: otpCode
    });

    if (error) { showNotification("서버 통신 장애 발생", "error"); return; }

    if (rpcResult === 'SUCCESS') {
      showNotification("인증 성공! 도장이 적립되었습니다.", "success");
      await fetchStudentStamps();
    } else if (rpcResult === 'ALREADY_STAMPED') {
      showNotification("이미 적립 완료된 부스입니다.", "info");
    } else if (rpcResult === 'ERROR_EXPIRED_CODE') {
      showNotification("만료된 인증 코드입니다. 새 코드를 찍어주세요.", "error");
    } else {
      showNotification("올바르지 않은 보안 코드입니다.", "error");
    }
  } catch (err) {
    showNotification("유효하지 않은 QR 코드 규격입니다.", "error");
  }
}
