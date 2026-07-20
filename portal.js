let currentRole = "L2";

// 기존 세션이 유효한지 체크 후 즉시 페이지 점프 가드
document.addEventListener("DOMContentLoaded", async () => {
  checkExistingSession();
});

/**
 * 접속 권한 그룹 변경 토글러
 */
function setLoginRole(role) {
  currentRole = role;
  const btnL2 = document.getElementById("btn-role-l2");
  const btnL3 = document.getElementById("btn-role-l3");
  const selectWrapper = document.getElementById("booth-select-wrapper");

  if (role === "L2") {
    btnL2.className = "py-3 px-4 rounded-xl border font-bold text-xs flex items-center justify-center space-x-1.5 transition-all bg-indigo-600/10 border-indigo-500/50 text-indigo-300";
    btnL3.className = "py-3 px-4 rounded-xl border border-slate-800 text-slate-400 font-bold text-xs flex items-center justify-center space-x-1.5 transition-all hover:bg-slate-800 hover:text-slate-200";
    selectWrapper.classList.remove("hidden");
  } else {
    btnL2.className = "py-3 px-4 rounded-xl border border-slate-800 text-slate-400 font-bold text-xs flex items-center justify-center space-x-1.5 transition-all hover:bg-slate-800 hover:text-slate-200";
    btnL3.className = "py-3 px-4 rounded-xl border font-bold text-xs flex items-center justify-center space-x-1.5 transition-all bg-indigo-600/10 border-indigo-500/50 text-indigo-300";
    selectWrapper.classList.add("hidden");
  }
}

/**
 * 🔥 [핵심 보안 개조] Supabase Auth 연동 포털 로그인 핸들러
 */
async function handlePortalLogin(event) {
  event.preventDefault();

  const passwordInput = document.getElementById("login-password").value;
  const selectedBoothId = document.getElementById("login-booth-select").value;

  // 1. 선택한 그룹에 맞춰 고유 내부 이메일 계정 스트링 합성
  let targetEmail = "";
  if (currentRole === "L3") {
    targetEmail = "admin@festival.com"; // L3 마스터 이메일 고정
  } else {
    targetEmail = `${selectedBoothId}@festival.com`; // L2 부스ID 이메일 조합
  }

  // 2. Supabase Cloud 실제 인증 시도
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: targetEmail,
    password: passwordInput
  });

  if (authError) {
    showNotification("보안 인증 키가 올바르지 않거나 등록되지 않은 계정입니다.", "error");
    return;
  }

  // 3. 인증 성공 시, users 테이블에서 해당 유저의 2단계 승인 승인 여부(is_approved) 최종 교차 검증
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role, is_approved, club_id")
    .eq("student_id", targetEmail)
    .single();

  if (profileError || !profile) {
    showNotification("유저 프로필 조회에 실패했습니다.", "error");
    await supabase.auth.signOut();
    return;
  }

  // 🚨 [방어벽] 관제탑(L3)이 승인 버튼을 아직 안 눌러 준 신규 L2 운영진 접근 원천 차단
  if (!profile.is_approved) {
    showNotification("아직 관제탑(L3)의 가입 승인이 완료되지 않은 전용 계정입니다.", "error");
    await supabase.auth.signOut();
    return;
  }

  // 4. 모든 보안 장벽을 통과하면 하위 페이지 호환용 브릿지 토큰 보존 및 리다이렉트
  createSecureSession(profile.role, profile.club_id);
  showNotification("마스터 권한 인증 성공! 안전 통로를 개방합니다.", "success");

  setTimeout(() => {
    if (profile.role === "L3") {
      window.location.href = "./admin.html";
    } else {
      window.location.href = `./booth.html?boothId=${profile.club_id}`;
    }
  }, 800);
}

function createSecureSession(role, boothId) {
  const token = {
    role: role,
    boothId: boothId,
    authTime: new Date().getTime()
  };
  sessionStorage.setItem("session_token", JSON.stringify(token));
}

function checkExistingSession() {
  const rawToken = sessionStorage.getItem("session_token");
  if (rawToken) {
    try {
      const token = JSON.parse(rawToken);
      const now = new Date().getTime();
      // 12시간 이내 유효 세션 검사 후 패스워드 입력 없이 자동 진입 패스 처리
      if (now - token.authTime < 12 * 60 * 60 * 1000) {
        if (token.role === "L3") {
          window.location.href = "./admin.html";
        } else if (token.role === "L2" && token.boothId) {
          window.location.href = `./booth.html?boothId=${token.boothId}`;
        }
      }
    } catch (e) {
      sessionStorage.removeItem("session_token");
    }
  }
}
