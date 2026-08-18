/**
 * Festival Stamp Tour - In-App Browser Escape Engine
 * 카카오톡, 라인, 인스타그램, 네이버, 페이스북/페메, X(트위터), 틱톡 등 국내 주요 SNS 인앱브라우저 자동 탈출 및 가이드 모듈
 */

(function () {
  const ua = navigator.userAgent || navigator.vendor || window.opera || "";
  const isAndroid = /android/i.test(ua);
  const isIOS = /iphone|ipad|ipod/i.test(ua);

  // 국내 주요 SNS 및 인앱 브라우저 정밀 감지
  const isKakao = /kakaotalk/i.test(ua);
  const isLine = /line\//i.test(ua);
  const isInstagram = /instagram/i.test(ua);
  const isNaver = /naver(inapp|searchapp)?/i.test(ua);
  const isFacebook = /fb_iab|fb4a|fbav|messenger/i.test(ua); // 페북 & 페메
  const isTwitter = /twitter|tweetbot/i.test(ua);
  const isTiktok = /musical_ly|bytedance/i.test(ua);
  const isGenericInApp = /webview|wv|inapp/i.test(ua);

  const isInAppBrowser = isKakao || isLine || isInstagram || isNaver || isFacebook || isTwitter || isTiktok || isGenericInApp;

  if (!isInAppBrowser) {
    return; // 일반 정규 브라우저(Safari, Chrome 등)는 정상 진행
  }

  const currentUrl = window.location.href;

  // 1. Android 환경: 모든 인앱 브라우저에서 Chrome Intent로 100% 자동 탈출
  if (isAndroid) {
    const rawUrl = currentUrl.replace(/^https?:\/\//i, "");
    const chromeIntent = `intent://${rawUrl}#Intent;scheme=https;package=com.android.chrome;end`;
    window.location.href = chromeIntent;
    return;
  }

  // 2. iOS 환경: 카카오톡 자동 탈출 (전용 스킴)
  if (isIOS && isKakao) {
    window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(currentUrl)}`;
    return;
  }

  // 3. iOS 환경: 라인 자동 탈출 (전용 파라미터)
  if (isIOS && isLine) {
    if (!currentUrl.includes("openExternalBrowser=1")) {
      const sep = currentUrl.includes("?") ? "&" : "?";
      window.location.href = `${currentUrl}${sep}openExternalBrowser=1`;
      return;
    }
  }

  // 4. iOS 환경: 인스타그램, 네이버, 페이스북/페메, X 등 (애플 보안상 강제 실행 불가 -> 맞춤형 가이드 모달)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderInAppModal);
  } else {
    renderInAppModal();
  }

  function renderInAppModal() {
    if (document.getElementById("inapp-blocking-overlay")) return;

    let appName = "인앱 브라우저";
    let menuGuide = "우측 상단 <strong>[ ⋯ ]</strong> 버튼을 누른 후 <strong>[Safari로 열기]</strong>를 선택해 주세요.";
    let arrowPosition = "top-right"; // top-right or bottom-right

    if (isInstagram) {
      appName = "Instagram";
      menuGuide = "우측 상단의 <strong>[ ⋯ ]</strong> 또는 <strong>[공유]</strong> 버튼을 누르고<br><strong>[Safari로 열기]</strong> 또는 <strong>[브라우저에서 열기]</strong>를 선택해 주세요.";
      arrowPosition = "top-right";
    } else if (isNaver) {
      appName = "NAVER 앱";
      menuGuide = "우측 하단의 <strong>[ ⋯ ]</strong> 버튼을 누르고<br><strong>[다른 브라우저로 보기]</strong>를 선택해 주세요.";
      arrowPosition = "bottom-right";
    } else if (isFacebook) {
      appName = "Facebook / 페메";
      menuGuide = "우측 상단(또는 하단)의 <strong>[ ⋯ ]</strong> 버튼을 누르고<br><strong>[브라우저에서 열기]</strong>를 선택해 주세요.";
      arrowPosition = "top-right";
    } else if (isTwitter) {
      appName = "X (트위터)";
      menuGuide = "우측 상단의 <strong>[공유/더보기]</strong> 버튼을 누르고<br><strong>[Safari로 열기]</strong>를 선택해 주세요.";
      arrowPosition = "top-right";
    }

    const overlay = document.createElement("div");
    overlay.id = "inapp-blocking-overlay";
    overlay.className = "fixed inset-0 bg-slate-950/95 z-[99999] flex flex-col items-center justify-center p-6 text-center text-slate-100 font-sans backdrop-blur-lg animate-in fade-in duration-200";

    overlay.innerHTML = `
      <!-- 우측 상단 화살표 안내 -->
      ${arrowPosition === "top-right" ? `
      <div class="absolute top-4 right-4 flex items-center space-x-1.5 bg-indigo-600/30 border border-indigo-400/50 px-3.5 py-2 rounded-2xl animate-bounce">
        <span class="text-xs font-bold text-indigo-300">여기를 탭하세요</span>
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-indigo-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
      </div>` : ""}

      <div class="max-w-sm w-full bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 shadow-2xl space-y-5 relative">
        <div class="w-14 h-14 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-indigo-950/50">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
        </div>

        <div class="space-y-2">
          <div class="inline-block bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">
            ${appName} 감지
          </div>
          <h3 class="text-base font-black text-slate-100 tracking-tight">Safari 기본 브라우저로 접속해 주세요</h3>
          <p class="text-xs text-slate-400 leading-relaxed">
            ${appName} 내부에서는 카메라 권한이 차단되어<br>스탬프 QR 코드 스캔이 동작하지 않습니다.
          </p>
        </div>

        <div class="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 leading-relaxed space-y-1">
          <p class="text-[11px] text-slate-400">${menuGuide}</p>
        </div>

        <div class="space-y-2 pt-1">
          <button id="btn-inapp-copy-url" class="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-extrabold py-3.5 px-4 rounded-2xl text-xs transition-all flex items-center justify-center space-x-2 shadow-lg shadow-indigo-950/50">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>
            <span id="btn-inapp-copy-text">웹사이트 주소 (URL) 복사하기</span>
          </button>
          <p class="text-[10px] text-slate-500">복사 후 Safari 또는 Chrome 주소창에 붙여넣으세요.</p>
        </div>
      </div>

      <!-- 우측 하단 화살표 안내 (네이버용) -->
      ${arrowPosition === "bottom-right" ? `
      <div class="absolute bottom-6 right-6 flex items-center space-x-1.5 bg-indigo-600/30 border border-indigo-400/50 px-3.5 py-2 rounded-2xl animate-bounce">
        <span class="text-xs font-bold text-indigo-300">하단 메뉴 탭</span>
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-indigo-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="7" x2="17" y2="17"></line><polyline points="17 7 17 17 7 17"></polyline></svg>
      </div>` : ""}
    `;

    document.body.appendChild(overlay);

    const btnCopy = document.getElementById("btn-inapp-copy-url");
    if (btnCopy) {
      btnCopy.addEventListener("click", async () => {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(currentUrl);
          } else {
            const tempInput = document.createElement("input");
            tempInput.value = currentUrl;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand("copy");
            document.body.removeChild(tempInput);
          }
          const textSpan = document.getElementById("btn-inapp-copy-text");
          if (textSpan) textSpan.innerText = "✓ 주소가 복사되었습니다!";
          btnCopy.classList.remove("bg-indigo-600");
          btnCopy.classList.add("bg-emerald-600");
          setTimeout(() => {
            if (textSpan) textSpan.innerText = "웹사이트 주소 (URL) 복사하기";
            btnCopy.classList.remove("bg-emerald-600");
            btnCopy.classList.add("bg-indigo-600");
          }, 3000);
        } catch (err) {
          alert("주소 복사 실패: 주소창의 링크를 직접 복사해 주세요.");
        }
      });
    }
  }
})();
