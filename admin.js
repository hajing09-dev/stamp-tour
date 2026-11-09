/* Responsive C administration with original read access and realtime subscriptions. */
(() => {
  "use strict";
  const ui = window.StampTourUI.create("admin");
  const {
    root,
    panel,
    state,
    logs,
    config,
    booths,
    colors,
    I,
    E,
    statusbar,
    totals,
    rankData,
    podium,
    mount,
    render,
    toast,
  } = ui;

  function logRows() {
    const warning = state.logsError ? `<div class="ft-alert" role="alert">${E(state.logsError)}<button type="button" class="ft-link-button" data-action="retry">다시 시도</button></div>` : "";
    if (!logs.length)
      return warning || `<div class="ft-empty">${I("inbox")}<p>${state.logsCleared ? "현재 화면의 기록을 비웠어요." : "아직 인증 기록이 없어요."}</p></div>`;
    const shown = state.logsExpanded ? logs : logs.slice(0, 6);
    return `${warning}${shown.map((l) => `<div class="ft-log-row"><span class="ft-log-time">${E(l.time)}</span><div><div class="ft-log-top"><b>${E(booths.find(booth => booth.id === l.club_id)?.name || l.club_id || "시스템")}</b><span class="ft-log-badge ${l.ok ? "" : "fail"}">${l.ok ? "적립 완료" : "인증 실패"}</span></div><span class="ft-log-message">${E(l.message)}</span></div></div>`).join("")}${logs.length > 6 ? `<button type="button" class="ft-link-button cursor-interaction" style="width:100%;margin-top:9px" data-action="expand-logs">${state.logsExpanded ? "기록 접기" : `이전 기록 ${logs.length - 6}건 더 보기`}${I(state.logsExpanded ? "chevron-up" : "chevron-down")}</button>` : ""}`;
  }

  function dashboard() {
    const t = totals();
    return `<div class="ft-admin-heading"><div><span class="ft-eyebrow">${E(config.eventName)} · 운영 현황</span><h1>오늘의 축제, <span class="ft-highlight">한눈에.</span></h1><p>학생들의 방문과 도장 적립 현황을 확인해요.</p></div><span class="ft-header-sticker" aria-hidden="true">GOOD<br>CLUB DAY!</span></div><section class="ft-metrics" aria-label="행사 주요 지표">${[
      [t.stamps, "건", "전체 도장 적립", "stamp"],
      [booths.length, "개", "등록된 부스", "store"],
      [t.participants, "명", "도장 참여 학생", "users"],
      [t.failed, "건", "인증 실패 기록", "shield-alert"],
    ]
      .map(
        ([value, unit, label, icon]) =>
          `<div class="ft-metric"><div class="ft-metric-title"><span>${label}</span>${I(icon)}</div><div class="ft-metric-value"><b>${value}</b><span>${unit}</span></div></div>`,
      )
      .join(
        "",
      )}</section><div class="ft-dashboard-grid"><section class="ft-admin-box"><div class="ft-section-heading"><h2>부스별 도장 현황</h2><span>${booths.length}개 부스</span></div>${booths.map((b, i) => `<div class="ft-admin-booth"><div class="ft-admin-booth-left"><span class="ft-admin-booth-icon" style="background:${colors[i % 4]}">${I(b.icon)}</span><div><h3>${E(b.name)}</h3><small>${E(b.location || "위치 안내 준비 중")}</small></div></div><div class="ft-admin-booth-count">${t.counts[i] ?? "—"}명<small>적립 완료</small></div></div>`).join("")}</section><section class="ft-admin-box"><div class="ft-section-heading"><h2>최근 인증 기록</h2><button type="button" class="ft-link-button cursor-interaction" data-action="clear-logs">화면 비우기</button></div>${logRows()}</section></div><p class="ft-admin-note">참여 학생은 도장을 한 번 이상 적립한 학생 수예요. 인증 실패 기록에는 중복 적립·만료 코드도 포함됩니다.</p>`;
  }

  function mobileRankRows() {
    const rows = rankData().filter(
      (p) => !state.search || p.name.includes(state.search) || p.id.includes(state.search),
    );
    return rows.length
      ? rows
          .map(
            (p) =>
              `<div class="ft-rank-row"><span>${p.rank}</span><div><b>${E(p.name)}</b><div class="ft-eyebrow">${E(p.id)} · 최근 ${p.time}</div></div><b>${p.count}개</b></div>`,
          )
          .join("")
      : '<div class="ft-empty">검색 결과가 없어요.</div>';
  }

  function adminTableRows() {
    const rows = rankData().filter(
      (p) => !state.search || p.name.includes(state.search) || p.id.includes(state.search),
    );
    return rows.length
      ? rows
          .map(
            (p) =>
              `<tr><td>${p.rank <= 3 ? `<span class="ft-table-medal ${p.rank === 2 ? "silver" : p.rank === 3 ? "bronze" : ""}">${p.rank}</span>` : p.rank}</td><td>${E(p.id)}</td><td>${E(p.name)}</td><td><b>${p.count}개</b></td><td>${E(p.time)}</td></tr>`,
          )
          .join("")
      : '<tr><td colspan="5"><div class="ft-empty">검색 결과가 없어요.</div></td></tr>';
  }

  function adminRanking() {
    return `${state.rankingLoading ? `<p class="ft-small-note" role="status">랭킹을 불러오고 있어요…</p>` : ""}${state.rankingError ? `<p class="ft-alert" role="alert">${E(state.rankingError)}</p>` : ""}<div class="ft-admin-heading"><div><span class="ft-eyebrow">${E(config.eventName)} · 참여 학생</span><h1>반짝이는 도장 <span class="ft-highlight">랭킹</span></h1><p>학생별 적립 수와 최근 적립 시각을 확인해요.</p></div></div><div class="ft-admin-fame">${podium(true)}</div><div class="ft-admin-box"><div class="ft-search-row"><label class="ft-search" for="ft-admin-search">${I("search")}<input id="ft-admin-search" value="${E(state.search)}" placeholder="학번 또는 이름으로 검색" aria-label="참여 학생 검색"></label><span class="ft-chip">총 참여 학생 ${totals().participants}명</span><button type="button" class="ft-secondary cursor-interaction" data-action="refresh">${I("rotate-cw")}새로고침</button></div><div class="ft-ranking-table-wrap"><table class="ft-ranking-table"><thead><tr><th>순위</th><th>학번</th><th>이름</th><th>도장 수</th><th>최근 적립</th></tr></thead><tbody id="ft-desktop-ranking-body">${adminTableRows()}</tbody></table></div><div class="ft-mobile-rank" id="ft-mobile-ranking-body">${mobileRankRows()}</div><p class="ft-admin-note">도장 수 내림차순, 동점이면 마지막 적립 시각이 빠른 순서예요. 상위 3명은 전체 랭킹 기준입니다.</p></div>`;
  }

  function admin() {
    const desktop = state.adminDevice === "desktop";
    return `<article class="ft-admin-app ${desktop ? "ft-admin-desktop" : ""}">${desktop ? "" : statusbar()}<header class="ft-admin-top"><div class="ft-brand"><span class="ft-brandmark">${I("sparkles")}</span><div><span class="ft-header-label">총괄 관리자</span>${E(config.eventName)}</div></div><button type="button" class="ft-secondary cursor-interaction" data-action="logout">${I("log-out")}로그아웃</button></header><div class="ft-admin-layout"><nav class="ft-sidebar" aria-label="관리자 메뉴">${desktop ? '<p class="ft-sidebar-label">운영 공간</p>' : ""}<button type="button" class="cursor-interaction" data-action="admin-tab" data-tab="dashboard" ${state.adminTab === "dashboard" ? 'aria-current="page"' : ""}>${I("layout-dashboard")}운영 현황</button><button type="button" class="cursor-interaction" data-action="admin-tab" data-tab="ranking" ${state.adminTab === "ranking" ? 'aria-current="page"' : ""}>${I("trophy")}학생 랭킹</button><button type="button" class="cursor-interaction" data-action="credits">${I("heart-handshake")}크레딧</button>${desktop ? `<div class="ft-sidebar-footer"><span>${I("sparkles")}</span><b>함께 만드는<br>반짝이는 하루.</b><p>CLUB FESTIVAL<br>운영진 전용</p></div>` : ""}</nav><main class="ft-admin-main">${state.adminTab === "ranking" ? adminRanking() : dashboard()}<p class="ft-small-note">${E(window.APP_CONFIG?.festival?.copyright || "")}</p></main></div>${desktop ? "" : ""}</article>`;
  }


  const service = window.StampTourService;
  let active = false, ending = false, booting = false, stops = [], refreshTimer = null;
  let epoch = 0, refreshFlight = null, refreshAgain = false, logGeneration = 0;
  const seenLogs = new Set();
  function dispose() {
    active = false; ++epoch;
    clearTimeout(refreshTimer); refreshTimer = null;
    stops.splice(0).forEach(stop => stop());
  }
  async function terminate() {
    if (ending) return;
    ending = true; dispose();
    state.ready = false; state.error = "로그인 권한이 만료됐어요."; render();
    ui.showModal("로그인이 종료됐어요", `<p>다른 기기에서 로그인했거나 현재 권한이 만료됐어요.</p><button type="button" class="ft-primary" data-action="session-exit">다시 로그인</button>`, { dismissible: false });
    try { await service.logout(); } catch (_) {}
  }
  function mergeLogs(records) {
    for (const row of records) {
      const key = row.id != null ? String(row.id) : `${row.created_at}|${row.student_id}|${row.club_id}|${row.status}`;
      if (seenLogs.has(key)) continue;
      seenLogs.add(key);
      logs.push({ ...row, ok: row.status === "SUCCESS", time: new Date(row.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }), message: row.status === "SUCCESS" ? `${String(row.student_id).split("@")[0]} 학생 도장 적립 완료` : `${String(row.student_id).split("@")[0]} 인증 결과: ${row.status}` });
    }
    logs.sort((a,b) => Date.parse(b.created_at)-Date.parse(a.created_at) || Number(b.id)-Number(a.id));
    if (logs.length > 200) logs.splice(200); // Display limit only; database records remain unchanged.
  }
  async function loadLogs() {
    const ticket = epoch, generation = logGeneration;
    try {
      const records = await service.initialLogs();
      if (!active || ticket !== epoch || generation !== logGeneration) return;
      mergeLogs(records); state.logsError = "";
    } catch (error) { if (active && ticket === epoch && generation === logGeneration) state.logsError = error.message; }
  }
  async function refreshData() {
    if (!active) return;
    if (refreshFlight) { refreshAgain = true; return refreshFlight; }
    const ticket = epoch, wantsRanking = state.adminTab === "ranking";
    if (wantsRanking) { state.rankingLoading = true; state.rankingError = ""; render(); }
    refreshFlight = (async () => {
      const [metrics, ranking] = await Promise.allSettled([service.metrics(), wantsRanking ? service.adminRanking() : Promise.resolve(null)]);
      if (!active || ticket !== epoch) return;
      if (metrics.status === "fulfilled") { state.metrics = { ...metrics.value, counts: booths.map(booth => metrics.value.counts.get(booth.id) || 0) }; state.error = ""; }
      else { state.error = metrics.reason.message; state.metrics = { stamps: "—", participants: "—", failed: "—", counts: [] }; }
      if (wantsRanking) {
        if (ranking.status === "fulfilled") state.ranking = ranking.value;
        else { state.ranking = []; state.rankingError = ranking.reason.message; }
        state.rankingLoading = false;
      }
      render();
    })();
    try { await refreshFlight; }
    finally { refreshFlight = null; if (refreshAgain && active) { refreshAgain = false; scheduleRefresh(); } }
  }
  function scheduleRefresh() {
    if (!active || refreshTimer) return;
    refreshTimer = setTimeout(() => { refreshTimer = null; refreshData(); }, 300);
  }
  async function init() {
    if (booting || ending) return;
    booting = true; dispose();
    try {
      const current = await service.staffAccess("L3");
      if (!current) { ui.navigate("portal.html?role=admin"); return; }
      const clubs = await service.clubs();
      booths.splice(0, booths.length, ...clubs);
      active = true; state.error = "";
      stops.push(service.watchStaff(current, terminate));
      // Subscribe before the initial query and merge by log ID to avoid gaps/duplicates.
      stops.push(service.watchAdmin(scheduleRefresh, record => {
        if (!active) return;
        state.logsCleared = false; mergeLogs([record]);
        if (state.ready && state.adminTab === "dashboard") render();
        scheduleRefresh();
      }));
      await Promise.all([loadLogs(), refreshData()]);
      if (active) { state.ready = true; render(); }
    } catch (error) { if (error.code === "ACCESS_DENIED") await terminate(); else { state.error = error.message; render(); } }
    finally { booting = false; }
  }
  mount({
    view: admin, onRefresh: async () => { await Promise.all([loadLogs(), refreshData()]); if (active) render(); },
    async onLogout() {
      if (ending) return;
      ending = true;
      try { await service.logout(); dispose(); ui.navigate("portal.html?role=admin"); }
      catch (error) { ending = false; throw error; }
    },
    async onAction(action, button) {
      if (action === "retry") { if (active) { await Promise.all([loadLogs(), refreshData()]); render(); } else await init(); return; }
      if (!active) return;
      if (action === "admin-tab") {
        state.adminTab = button.dataset.tab; state.search = ""; render();
        if (state.adminTab === "ranking") await refreshData();
      } else if (action === "clear-logs") {
        ++logGeneration; logs.splice(0); state.logsCleared = true; render(); toast("현재 화면의 기록만 비웠어요.");
      } else if (action === "expand-logs") { state.logsExpanded = !state.logsExpanded; render(); }
    },
  });
  window.addEventListener("pagehide", dispose, { once: true });
  window.addEventListener("pageshow", event => { if (event.persisted) location.reload(); });
  init();
  root.addEventListener("input", (event) => {
    if (event.target.id !== "ft-admin-search") return;
    state.search = event.target.value.trim();
    panel.querySelector("#ft-mobile-ranking-body").innerHTML = mobileRankRows();
    panel.querySelector("#ft-desktop-ranking-body").innerHTML = adminTableRows();
  });
})();
