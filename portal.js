let currentRole = "L2";

document.addEventListener("DOMContentLoaded", async () => {
  // 🔥 페이지 기동 즉시 DB에서 부스 정보 동적 렌더링
  await fetchDropdownClubs();
  checkExistingSession();
});

async function fetchDropdownClubs() {
  const { data: clubs, error } = await supabase.from("clubs").select("club_id, name");
  if (!error && clubs && typeof window.renderBoothDropdown === "function") {
    window.renderBoothDropdown(clubs.map(c => ({ id: c.club_id, name: c.name })));
  }
}

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
 * 🔥 100% 암호화 서버 검증으로 리팩토링된 안전 로그인 프로세서
 */
async function handlePortalLogin(event) {
  event.preventDefault();

  const passwordInput = document.getElementById("login-password").value;
  const selectedBoothId = document.getElementById("login-booth-select").value;

  let targetEmail = currentRole === "L3" ? "admin@festival.com" : `${selectedBoothId}@festival.com`;

  if (typeof window.showNotification === "function") {
    window.showNotification("권한 터널 접속 검증 중...", "info");
  }

  // Supabase 클라우드 코어 인증 요청
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: targetEmail,
    password: passwordInput
  });

  if (authError) {
    if (typeof window.showNotification === "function") window.showNotification("액세스 보안 키가 올바르지 않습니다.", "error");
    return;
  }

  // 2단계 자물쇠: users 테이블에서 L3 승인 도장이 찍혔는지 교차 검증
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role, is_approved, club_id")
    .eq("student_id", targetEmail)
    .single();

  if (profileError || !profile || !profile.is_approved) {
    if (typeof window.showNotification === "function") {
      window.showNotification("미승인 상태이거나 프로필이 손상되었습니다.", "error");
    }
    await supabase.auth.signOut();
    return;
  }

  createSecureSession(profile.role, profile.club_id);
  if (typeof window.showNotification === "function") window.showNotification("인증 성공! 관리 권한을 위임합니다.", "success");

  setTimeout(() => {
    window.location.href = profile.role === "L3" ? "./admin.html" : `./booth.html?boothId=${profile.club_id}`;
  }, 800);
}

function createSecureSession(role, boothId) {
  const token = { role: role, boothId: boothId, authTime: new Date().getTime() };
  sessionStorage.setItem("session_token", JSON.stringify(token));
}

function checkExistingSession() {
  const rawToken = sessionStorage.getItem("session_token");
  if (rawToken) {
    try {
      const token = JSON.parse(rawToken);
      const now = new Date().getTime();
      if (now - token.authTime < 12 * 60 * 60 * 1000) {
        window.location.href = token.role === "L3" ? "./admin.html" : `./booth.html?boothId=${token.boothId}`;
      }
    } catch (e) { sessionStorage.removeItem("session_token"); }
  }
}
