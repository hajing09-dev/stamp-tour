/**
 * In-App Webview Escape & Blocking Module
 * 카카오톡/인스타그램/네이버/라인 등 인앱 브라우저에서 카메라 권한 차단 문제 예방 및 외부 브라우저(Safari/Chrome) 전환
 */

(function () {
  const ua = navigator.userAgent || navigator.vendor || window.opera || "";
  const isKakao = /KAKAOTALK/i.test(ua);
  const isInstagram = /Instagram/i.test(ua);
  const isLine = /Line\//i.test(ua);
  const isNaver = /NAVER/i.test(ua);
  const isFacebook = /FBAN|FBAV/i.test(ua);
  const isKakaostory = /KAKAOSTORY/i.test(ua);
  const isGeneralInApp = isInstagram || isLine || isNaver || isFacebook || isKakaostory;

  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);

  // 1. 카카오톡 인앱 브라우저인 경우: 외부 브라우저로 자동 탈출 딥링크 시도
  if (isKakao) {
    const currentUrl = window.location.href;
    if (isAndroid) {
      // 안드로이드: 크롬 인텐트 호출
      const cleanUrl = currentUrl.replace(/^https?:\/\//i, "");
      const chromeIntent = `intent://${cleanUrl}#Intent;scheme=https;package=com.android.chrome;end`;
      window.location.href = chromeIntent;
      return;
    } else if (isIOS) {
      // iOS: 사파리 호출 커스텀 스킴
      window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(currentUrl)}`;
      return;
    }
  }

  // 2. 기타 인앱 브라우저 (인스타, 네이버, 라인 등) 감지 시 안내 모달 표시
  if (isGeneralInApp) {
    document.addEventListener("DOMContentLoaded", () => {
      renderInAppWarningModal();
    });
  }

  function renderInAppWarningModal() {
    // 중복 생성 방지
    if (document.getElementById("inapp-blocking-modal")) return;

    const modal = document.createElement("div");
    modal.id = "inapp-blocking-modal";
    modal.className = "fixed inset-0 bg-slate-950/95 backdrop-blur-xl z-[9999] flex flex-col justify-center items-center p-6 text-center text-slate-100 animate-in fade-in duration-300";

    modal.innerHTML = `
      <div class="max-w-sm w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
        <div class="w-16 h-16 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-2xl mx-auto flex items-center justify-center">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
        </div>

        <div class="space-y-2">
          <h3 class="text-lg font-black text-slate-100 tracking-tight">외부 브라우저 접속 필요</h3>
          <p class="text-xs text-slate-400 leading-relaxed">
            현재 앱 내 브라우저에서는 <strong>QR 스캔 카메라 권한</strong>이 지원되지 않습니다.<br>
            원활한 스탬프 투어를 위해 <strong class="text-indigo-400">Safari</strong> 또는 <strong class="text-indigo-400">Chrome</strong>으로 열어주세요.
          </p>
        </div>

        <div class="space-y-3 pt-2">
          <button id="btn-copy-url" class="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-extrabold py-3.5 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 transition-all active:scale-[0.98] shadow-lg shadow-indigo-950/50">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
            </svg>
            <span id="btn-copy-text">웹 주소 (URL) 복사하기</span>
          </button>

          <p class="text-[11px] text-slate-500 leading-normal">
            우측 상단/하단 메뉴(<strong>···</strong>)의<br><strong>[다른 브라우저로 열기]</strong> 또는 <strong>[Safari로 열기]</strong>를 눌러도 됩니다.
          </p>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const btnCopy = document.getElementById("btn-copy-url");
    const btnText = document.getElementById("btn-copy-text");

    btnCopy.addEventListener("click", async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(window.location.href);
        } else {
          const tempInput = document.createElement("input");
          tempInput.value = window.location.href;
          document.body.appendChild(tempInput);
          tempInput.select();
          document.execCommand("copy");
          document.body.removeChild(tempInput);
        }
        btnText.innerText = "✓ 복사 완료! 브라우저 주소창에 붙여넣기";
        btnCopy.classList.remove("from-indigo-600", "to-violet-600");
        btnCopy.classList.add("bg-emerald-600");
      } catch (e) {
        prompt("아래 주소를 복사하여 브라우저에 붙여넣어 주세요:", window.location.href);
      }
    });
  }
})();
