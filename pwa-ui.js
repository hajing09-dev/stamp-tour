/* Preserve optional home-screen installation without blocking the stamp flow. */
(() => {
  "use strict";
  let prompt = null;
  const root = document.getElementById("club-festival-suite");
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const banner = document.createElement("aside");
  banner.className = "ft-install-banner";
  banner.hidden = true;
  banner.innerHTML = '<span>홈 화면에 추가해 편하게 도장을 모아요.</span><button type="button" class="ft-link-button" data-install>추가</button><button type="button" class="ft-icon-button" aria-label="앱 추가 안내 닫기" data-dismiss>×</button>';
  root.prepend(banner);
  const dismissed = () => { try { return localStorage.getItem("pwa_banner_dismissed") === "true"; } catch (_) { return false; } };
  const show = () => { if (!standalone && !dismissed()) banner.hidden = false; };
  window.addEventListener("beforeinstallprompt", event => { event.preventDefault(); prompt = event; show(); });
  banner.querySelector("[data-dismiss]").addEventListener("click", () => {
    banner.hidden = true;
    try { localStorage.setItem("pwa_banner_dismissed", "true"); } catch (_) {}
  });
  banner.querySelector("[data-install]").addEventListener("click", async () => {
    if (prompt) {
      try {
        await prompt.prompt();
        if ((await prompt.userChoice).outcome === "accepted") banner.hidden = true;
      } finally { prompt = null; }
      return;
    }
    const guide = document.createElement("div");
    guide.className = "ft-layer";
    guide.innerHTML = '<section class="ft-modal" role="dialog" aria-modal="true" aria-label="홈 화면에 추가"><div class="ft-modal-top"><h2>홈 화면에 추가</h2><button type="button" class="ft-icon-button" aria-label="닫기">×</button></div><p>브라우저의 공유 또는 메뉴 버튼을 누르고 <strong>홈 화면에 추가</strong>를 선택해 주세요.</p></section>';
    const panel = root.querySelector("#ft-page"), previous = document.activeElement;
    panel.inert = true; document.body.classList.add("ft-scroll-lock"); root.append(guide);
    const close = () => { guide.remove(); panel.inert = false; document.body.classList.remove("ft-scroll-lock"); if (previous?.isConnected) previous.focus(); };
    const button = guide.querySelector("button");
    button.addEventListener("click", close);
    guide.addEventListener("keydown", event => { if (event.key === "Escape") close(); if (event.key === "Tab") { event.preventDefault(); button.focus(); } });
    button.focus();
  });
  if (ios) show();
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch(() => { /* Installation is optional. */ });
    });
  }
})();
