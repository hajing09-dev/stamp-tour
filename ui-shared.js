/* C sticker-book presentation. Display state comes from the existing Supabase service. */
(() => {
  "use strict";
  const config = { eventName: window.APP_CONFIG?.festival?.subTitle || window.APP_CONFIG?.festival?.title || "동아리 발표회" };
  const colors = ["#dcc9f3", "#ffe18c", "#c5e5d4", "#ffd4be"];
  const I = (name) => `<i data-lucide="${name}" aria-hidden="true"></i>`;
  const E = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );

  window.StampTourUI = { create };

  function create(page) {
    const root = document.getElementById("club-festival-suite");
    const panel = document.getElementById("ft-page");
    const params = new URLSearchParams(window.location.search);
    const booths = [], logs = [];
    const state = {
      role: page === "portal" ? (params.get("role") === "admin" ? "admin" : "booth") : page,
      page: "loading", ready: false, error: "", studentTab: ["main","ranking","clubs"].includes(params.get("tab")) ? params.get("tab") : "main",
      adminTab: params.get("tab") === "ranking" ? "ranking" : "dashboard", adminDevice: "desktop",
      stamps: [], studentName: "", studentId: "", booth: params.get("boothId") || "",
      manual: false, expires: 0, issues: 0, expiredRendered: false, search: "",
      logsExpanded: false, ranking: [], studentPodium: [], myRank: null, rankingLoading: false, rankingError: "",
      clubRanking: [], clubRankingLoading: false, clubRankingError: "",
      metrics: { stamps: 0, participants: 0, counts: [], failed: 0 }, decor: 100,
    };
    let view, onAction, onSubmit, onRefresh, onLogout, onRender, onModalClose, toastTimer, previousFocus, modalDismissible = true;
    const brand = () =>
      `<div class="ft-brand"><span class="ft-brandmark">${I("sparkles")}</span><span>${E(config.eventName)}</span></div>`;
    // OS status bars and home indicators belong to the device, not the web page.
    const statusbar = () => "";
    const sparks = () =>
      `<span class="ft-spark" style="left:14px;top:90px;width:20px;height:20px" aria-hidden="true"></span><span class="ft-spark lavender" style="right:22px;top:103px;width:14px;height:14px" aria-hidden="true"></span><span class="ft-spark coral" style="left:41px;top:157px;width:10px;height:10px" aria-hidden="true"></span>`;
    const maskName = (name) => name.slice(0, 1) + "*" + (name.length > 2 ? name.slice(-1) : "");
    const remaining = () =>
      state.expires ? Math.max(0, Math.ceil((state.expires - Date.now()) / 1000)) : 0;
    const syncIcons = () => window.lucide?.createIcons({ attrs: { width: 20, height: 20 } });

    // Presentation selectors consume data already authorized by app-service.
    function rankData() { return state.ranking; }
    function totals() { return state.metrics; }
    function persist() { /* Authentication and stamps are managed by app-service, never by the presentation. */ }
    function render() {
      if (!view) return;
      const focused = panel.contains(document.activeElement) ? document.activeElement : null;
      const id = focused?.id, cursor = focused?.selectionStart;
      const warning = state.error ? `<div class="ft-alert" role="alert">${E(state.error)}<button type="button" class="ft-link-button" data-action="retry">다시 시도</button></div>` : "";
      panel.innerHTML = state.ready ? warning + view() : `<article class="ft-phone"><div class="ft-empty" role="status">${I("loader-circle")}화면을 불러오고 있어요…</div>${warning}</article>`;
      syncIcons();
      if (state.ready) onRender?.();
      const restored = id ? document.getElementById(id) : null;
      if (restored && focused && !focused.isConnected) {
        restored.focus({ preventScroll: true });
        if (typeof cursor === "number" && typeof restored.setSelectionRange === "function") restored.setSelectionRange(cursor, cursor);
      }
    }
    function mount(options) {
      ({ view, onAction, onSubmit, onRefresh, onLogout, onRender, onModalClose } = options);
      render();
    }
    function navigate(url) {
      window.location.assign(url);
    }
    function toast(message) {
      root.querySelectorAll(".ft-toast").forEach((element) => element.remove());
      const box = document.createElement("div");
      box.className = "ft-toast";
      box.setAttribute("role", "status");
      box.textContent = message;
      root.append(box);
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => box.remove(), 4000);
    }
    function showModal(title, body, options = {}) {
      closeModal(false);
      modalDismissible = options.dismissible !== false;
      previousFocus = document.activeElement;
      const layer = document.createElement("div");
      layer.className = "ft-layer";
      layer.innerHTML = `<section class="ft-modal" role="dialog" aria-modal="true" aria-label="${E(title)}"><div class="ft-modal-top"><h2>${E(title)}</h2><button type="button" class="ft-icon-button cursor-interaction" aria-label="닫기" data-action="close-modal">${I("x")}</button></div>${body}</section>`;
      if (!modalDismissible) layer.querySelector("[data-action=close-modal]")?.remove();
      root.append(layer);
      panel.inert = true;
      document.body.classList.add("ft-scroll-lock");
      syncIcons();
      layer.querySelector("input,select,button")?.focus();
    }
    function closeModal(restoreFocus = true) {
      const closingLayer = root.querySelector(".ft-layer");
      if (closingLayer) { Promise.resolve(onModalClose?.()).catch(() => {}); closingLayer.remove(); }
      panel.inert = false;
      document.body.classList.remove("ft-scroll-lock");
      if (restoreFocus && previousFocus?.isConnected) previousFocus.focus();
    }

    function podium(admin = false, kind = "student") {
      const club = kind === "club";
      let top;
      if (!club && !admin) top = state.studentPodium;
      else {
        const groups = new Map();
        for (const row of club ? state.clubRanking : rankData()) {
          if (!row.rank || row.rank > 3) continue;
          const group = groups.get(row.rank);
          if (group) group.memberCount++;
          else groups.set(row.rank, { ...row, memberCount: 1 });
        }
        top = [...groups.values()].sort((a,b) => a.rank - b.rank);
      }
      if (!top.length) return "";
      return `<section class="ft-fame" aria-label="${club ? "동아리" : "학생"} 랭킹 상위 1~3위">${sparks()}<div class="ft-fame-title"><span>${club ? "CLUB RANKING" : "HALL OF FAME"}</span><h2>${club ? "오늘의 인기 동아리" : "오늘의 반짝이는 주인공"}</h2><p>${club ? "학생들이 가장 많이 만난 동아리 부스" : "부스를 누비며 모은 소중한 도장들"}</p></div><div class="ft-podium">${top.map(p => {
        const representative = club || admin || p.masked ? p.name : maskName(p.name);
        const name = representative + (p.memberCount > 1 ? ` 외 ${p.memberCount - 1}${club ? "곳" : "명"}` : "");
        const score = `${club ? "방문 학생 " : "도장 "}${p.count}${club ? "명" : "개"}`;
        return `<div class="ft-place ft-place-${p.rank}" data-rank="${p.rank}" aria-label="${p.rank}위 ${E(name)}, ${score}"><div class="ft-medal-art">${p.rank === 1 ? `<span class="ft-crown">${I("crown")}</span>` : ""}<div class="ft-medal-seal">${p.rank}</div></div><span class="ft-winner-name">${E(name)}</span><span class="ft-winner-id">${E(club ? p.location || "동아리 부스" : admin || p.masked ? p.id : p.id.slice(0, 3) + "**")}</span><div class="ft-podium-block"><div>${p.count}${club ? "명" : "개"}<small>${["GOLD", "SILVER", "BRONZE"][p.rank - 1]}</small></div></div></div>`;
      }).join("")}</div></section>`;
    }

    function loginArt(kind) {
      return `<div class="ft-login-art" aria-hidden="true"><div class="ft-login-halo"></div><div class="ft-login-stamp"><div>${I(kind === "student" ? "stamp" : kind === "booth" ? "scan-line" : "layout-dashboard")}</div><span>CLUB DAY</span></div><div class="ft-login-orbit ft-orbit-1">${I("music-2")}</div><div class="ft-login-orbit ft-orbit-2">${I("palette")}</div><span class="ft-spark" style="top:95px;left:60px;width:22px;height:22px"></span><span class="ft-spark lavender" style="right:48px;top:6px;width:16px;height:16px"></span></div>`;
    }

    function credits() {
      const data = window.APP_CONFIG?.credits || {};
      return `<section class="ft-credits"><span class="ft-chip">${I("heart-handshake")}${E(data.teamName || "함께 만드는 동아리제")}</span><h2>${E(data.title || "제작 크레딧")}</h2><p>${E(data.description || "")}</p>${(data.members || []).map(member => `<div class="ft-credit-row"><b>${E(member.role)}</b><span>${E(member.name)}<small>${E(member.desc || "")}</small></span></div>`).join("")}<p class="ft-small-note">${E(data.techStack || "")}</p><p class="ft-small-note">${E(data.repoNotice || "")}</p></section>`;
    }

    root.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button || button.disabled) return;
      const action = button.dataset.action;
      try {
        if (action === "close-modal" && modalDismissible) closeModal();
        else if (action === "credits") showModal("제작 크레딧", credits());
        else if (action === "refresh") await onRefresh?.();
        else if (action === "logout") {
          if (onLogout) await onLogout();
          else { await window.StampTourService.logout(); navigate(`portal.html?role=${page === "admin" ? "admin" : "booth"}`); }
        } else if (action === "go-student") navigate("index.html");
        else if (action === "session-exit") navigate("portal.html");
        else await onAction?.(action, button);
      } catch (error) { toast(error.message || "처리하지 못했어요. 다시 시도해 주세요."); }
    });
    const submitting = new WeakSet();
    root.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.target;
      if (submitting.has(form)) return;
      submitting.add(form);
      const buttons = [...form.querySelectorAll('[type="submit"]')];
      buttons.forEach(button => button.disabled = true);
      form.setAttribute("aria-busy", "true");
      const errorBox = form.querySelector(".ft-error");
      if (errorBox) errorBox.textContent = "";
      try { await onSubmit?.(form); }
      catch (error) { if (errorBox?.isConnected) errorBox.textContent = error.message; else toast(error.message); }
      finally { submitting.delete(form); form.removeAttribute("aria-busy"); buttons.forEach(button => button.disabled = false); }
    });
    root.addEventListener("keydown", (event) => {
      const layer = root.querySelector(".ft-layer");
      if (!layer) return;
      if (event.key === "Escape" && modalDismissible) {
        closeModal();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...layer.querySelectorAll("button,input,select,a[href]")].filter(
        (element) => !element.disabled,
      );
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    });

    return {
      root,
      panel,
      state,
      logs,
      config,
      booths,
      colors,
      I,
      E,
      brand,
      statusbar,
      sparks,
      maskName,
      remaining,
      syncIcons,
      rankData,
      totals,
      persist,
      render,
      mount,
      navigate,
      toast,
      showModal,
      closeModal,
      podium,
      loginArt,
      credits,
    };
  }
})();
