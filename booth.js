let activeBoothId = null;

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  activeBoothId = urlParams.get("boothId");
  if (!activeBoothId) return;

  updateBoothVisitorMetrics();

  // 우리 부스에 스탬프 찍히는 것만 실시간 리스닝 (방문자 수 실시간 업)
  supabase
    .channel(`realtime-booth-${activeBoothId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stamps', filter: `club_id=eq.${activeBoothId}` }, () => {
        showNotification("새로운 학생이 도장을 찍었습니다!", "success");
        updateBoothVisitorMetrics();
    })
    .subscribe();
});

// 🔥 [On-Demand 반영] 운영진이 버튼을 누를 때만 딱 1분 짜리 OTP 발급!
async function handleGenerateNewOTP() {
  const newOtp = Math.floor(100000 + Math.random() * 900000).toString(); // 6자리 난수 생성
  const expiresAt = new Date(Date.now() + 60 * 1000).toISOString(); // 1분 뒤 만료

  const { error } = await supabase
    .from("clubs_status")
    .upsert({
      club_id: activeBoothId,
      current_otp: newOtp,
      otp_expires_at: expiresAt
    });

  if (!error) {
    // 프론트엔드 화면에 새 QR 생성하는 함수 호출 (난독화 패킷 전달)
    const encryptedPayload = btoa(`${activeBoothId}:${newOtp}`);
    makeQRCodeOnUI(encryptedPayload); 
    showNotification("1분 동안 유효한 새 QR 코드가 발급되었습니다.", "success");
  }
}

async function updateBoothVisitorMetrics() {
  const { count } = await supabase.from("stamps").select("*", { count: "exact", head: true });
  document.getElementById("booth-visitor-count").innerText = `${count || 0}명`;
}
