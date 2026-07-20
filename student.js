let currentStudent = null;
let registeredStamps = [];

document.addEventListener("DOMContentLoaded", async () => {
  const savedUser = localStorage.getItem("student_session");
  if (savedUser) {
    currentStudent = JSON.parse(savedUser);
    document.getElementById("student-info-display").innerText = `${currentStudent.id} ${currentStudent.name}`;
    await fetchStudentStamps();
  } else {
    promptStudentLogin(); // 가상 회원가입/로그인 유도
  }
});

// [가상 회원가입/로그인 처리] 토큰 방식 치트키 반영!
async function promptStudentLogin() {
  const studentId = prompt("학번 5자리를 입력하세요 (예: 20101):");
  const name = prompt("이름을 입력하세요:");
  if (!studentId || !name) return;

  const fakeEmail = `${studentId}@festival.com`;
  const fakePassword = btoa(encodeURIComponent(`${studentId}_${name}`));

  // 로그인 시도 후 실패 시 회원가입
  let { error } = await supabase.auth.signInWithPassword({ email: fakeEmail, password: fakePassword });
  if (error) {
    await supabase.auth.signUp({
      email: fakeEmail,
      password: fakePassword,
      options: { data: { student_id: studentId, name: name, role: "L1" } }
    });
  }

  currentStudent = { id: studentId, name: name };
  localStorage.setItem("student_session", JSON.stringify(currentStudent));
  window.location.reload();
}

async function fetchStudentStamps() {
  const { data } = await supabase.from("stamps").select("club_id");
  registeredStamps = data ? data.map(item => item.club_id) : [];
  syncStampsToUI();
}

// 💥 [핵심 리팩토링] QR 스캔 완료 시 서버 RPC 호출로 완전 대체!
async function processStampVerification(base64Payload) {
  try {
    const decoded = atob(base64Payload);
    const [clubId, otpCode] = decoded.split(":");

    // 데이터베이스 RPC(check_otp_and_stamp)에 검증 전권 위임!
    const { data: rpcResult, error } = await supabase.rpc('check_otp_and_stamp', {
      p_club_id: clubId,
      p_input_otp: otpCode
    });

    if (error) { showNotification("통신 에러가 발생했습니다.", "error"); return; }

    // 서버의 판정 결과에 따른 분기
    if (rpcResult === 'SUCCESS') {
      showNotification("인증 성공! 도장이 적립되었습니다.", "success");
      registeredStamps.push(clubId);
      syncStampsToUI();
    } else if (rpcResult === 'ALREADY_STAMPED') {
      showNotification("이미 스탬프를 획득한 부스입니다.", "info");
    } else {
      showNotification("유효하지 않거나 만료된 보안 코드입니다.", "error");
    }
  } catch (err) {
    showNotification("올바르지 않은 QR 코드 규격입니다.", "error");
  }
}
