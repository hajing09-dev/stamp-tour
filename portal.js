/* Original staff authentication and single-device sessions with the C login layout. */
(() => {
  "use strict";
  const ui = window.StampTourUI.create("portal");
  const {
    root,
    panel,
    state,
    config,
    booths,
    I,
    E,
    brand,
    statusbar,
    loginArt,
    mount,
    render,
    persist,
    navigate,
  } = ui;
  const desktop = window.matchMedia("(min-width: 761px)");

  function portal(role) {
    return `<article class="ft-phone ft-mobile-portal">${statusbar()}<div class="ft-login">${brand()}${loginArt(role)}<div class="ft-login-title"><span class="ft-eyebrow">함께 만드는 동아리제</span><h1>설렘을 더하는<br><span class="ft-highlight">운영진 로그인</span></h1><p>담당하는 역할을 선택해 주세요.</p></div><div class="ft-role-choice" aria-label="운영 역할">${[
      ["booth", "store", "부스 담당자"],
      ["admin", "layout-dashboard", "총괄 관리자"],
    ]
      .map(
        ([key, icon, label]) =>
          `<button type="button" class="cursor-interaction" data-action="portal-role" data-role="${key}" aria-pressed="${role === key}">${I(icon)}${label}</button>`,
      )
      .join(
        "",
      )}</div><form class="ft-form" data-form="portal">${role === "booth" ? `<label for="ft-portal-booth-${role}">담당 부스<select name="booth" id="ft-portal-booth-${role}">${booths.map((b, i) => `<option value="${E(b.id)}" ${b.id === state.booth ? "selected" : ""}>${E(b.name)}</option>`).join("")}</select></label>` : ""}<label for="ft-portal-password-${role}">비밀번호<input type="password" id="ft-portal-password-${role}" name="password" placeholder="운영진 비밀번호" autocomplete="off"></label><div class="ft-error" role="alert"></div><button type="submit" class="ft-primary cursor-interaction">${role === "booth" ? "부스 운영 시작하기" : "관리자 화면 들어가기"}${I("arrow-right")}</button></form><p class="ft-small-note">허가된 운영진 계정의 비밀번호를 입력해 주세요.</p><button type="button" class="ft-link-button cursor-interaction" style="margin:17px auto 0" data-action="go-student">${I("arrow-left")}학생 화면으로 돌아가기</button></div></article>`;
  }

  function desktopPortal() {
    return `<article class="ft-admin-login"><section class="ft-desktop-login-art">${brand()}${loginArt("admin")}<div><span class="ft-chip">${I("heart-handshake")}함께 만드는 동아리제</span><h1>학생들의 하루에<br><span class="ft-highlight">설렘을 더하는 일.</span></h1><p>참여 현황부터 도장 랭킹까지,<br>${E(config.eventName)}를 한곳에서 운영해요.</p></div></section><section class="ft-desktop-login-form"><span class="ft-chip">${I("layout-dashboard")}총괄 관리자 전용</span><h2>관리자 로그인</h2><p>운영진 비밀번호로 관리 화면에 들어가세요.</p>${roleChoices()}<form class="ft-form" data-form="portal"><label for="ft-admin-desktop-password">비밀번호<input type="password" id="ft-admin-desktop-password" name="password" placeholder="운영진 비밀번호" autocomplete="off"></label><div class="ft-error" role="alert"></div><button type="submit" class="ft-primary cursor-interaction">관리자 화면 들어가기 ${I("arrow-right")}</button></form><p class="ft-small-note">허가된 운영진 계정의 비밀번호를 입력해 주세요.</p><a class="ft-link-button" href="index.html">학생 화면으로 돌아가기</a></section></article>`;
  }

  function roleChoices() {
    return `<div class="ft-role-choice" aria-label="운영 역할">${[
      ["booth", "store", "부스 담당자"],
      ["admin", "layout-dashboard", "총괄 관리자"],
    ]
      .map(
        ([role, icon, label]) =>
          `<button type="button" class="cursor-interaction" data-action="portal-role" data-role="${role}" aria-pressed="${state.role === role}">${I(icon)}${label}</button>`,
      )
      .join("")}</div>`;
  }
  function view() {
    const wide = state.role === "admin" && desktop.matches;
    panel.classList.toggle("ft-wide-panel", wide);
    root.classList.toggle("ft-is-admin-desktop", wide);
    return wide ? desktopPortal() : portal(state.role);
  }

  const service = window.StampTourService;
  let signingIn = false;
  async function init() {
    try {
      const current = await service.restoreStaff();
      if (current) { navigate(service.staffRoute(current)); return; }
      const clubs = await service.clubs();
      booths.splice(0, booths.length, ...clubs);
      if (!booths.some(booth => booth.id === state.booth)) state.booth = booths[0]?.id || "";
      state.error = "";
    } catch (error) { state.error = error.message; }
    state.ready = true; render();
  }
  mount({
    view,
    async onAction(action, button) {
      if (action === "retry") { await init(); return; }
      if (action !== "portal-role" || signingIn) return;
      const select = panel.querySelector('select[name="booth"]');
      if (select) state.booth = select.value;
      state.role = button.dataset.role;
      render(); panel.querySelector(`[data-role="${state.role}"]`)?.focus();
    },
    async onSubmit(form) {
      if (form.dataset.form !== "portal" || signingIn) return;
      const data = new FormData(form), password = String(data.get("password") || "").trim();
      const role = state.role === "admin" ? "L3" : "L2";
      const boothId = String(data.get("booth") || state.booth || "");
      if (!password) throw new Error("비밀번호를 입력해 주세요.");
      if (role === "L2" && !booths.some(booth => booth.id === boothId)) throw new Error("담당 부스를 선택해 주세요.");
      signingIn = true;
      try {
        const current = await service.staffLogin(role, boothId, password);
        form.reset();
        navigate(service.staffRoute(current));
      } finally { signingIn = false; }
    },
  });
  desktop.addEventListener("change", () => { if (!signingIn) render(); });
  init();
})();
