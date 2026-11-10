/* Student UI with original Supabase authentication, RPC verification and lifecycle sync. */
(() => {
  "use strict";
  const ui = window.StampTourUI.create("student");
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
    brand,
    statusbar,
    sparks,
    rankData,
    maskName,
    podium,
    credits,
    loginArt,
    mount,
    render,
    persist,
    toast,
    showModal,
    closeModal,
  } = ui;

  function studentLogin() {
    const sConf = window.APP_CONFIG?.student || {};
    const aConf = window.APP_CONFIG?.auth || {};
    const title = sConf.loginTitle || "나만의 <span class=\"ft-highlight\">도장판</span>을<br>채워볼까요?";
    const desc = sConf.loginDesc || "동아리를 만나고, 오늘의 순간을 모아요.";
    const btnText = sConf.loginButton || "동아리 투어 시작";
    const placeholder = aConf.studentIdPlaceholder || "학번을 입력하세요 (예: 20101)";
    const help = aConf.studentIdHelp || "4~8자리 숫자 학번";

    return `<article class="ft-phone"><div class="ft-login">${brand()}${loginArt("student")}<div class="ft-login-title"><h1>${title}</h1><p>${E(desc)}</p></div><form class="ft-form" data-form="student"><label for="ft-student-id">학번<input id="ft-student-id" name="studentId" inputmode="numeric" maxlength="12" autocomplete="off" placeholder="${E(placeholder)}"><small>${E(help)}</small></label><label for="ft-student-name">이름<input id="ft-student-name" name="name" maxlength="20" autocomplete="off" placeholder="이름을 입력해 주세요"></label><div class="ft-error" role="alert"></div><button type="submit" class="ft-primary cursor-interaction">${E(btnText)} ${I("arrow-right")}</button></form><p class="ft-small-note">학번과 이름으로 기존 도장판을 다시 불러올 수 있어요.</p></div></article>`;
  }

  function progress() {
    const n = state.stamps.length;
    const label = window.APP_CONFIG?.student?.progressLabel || "나의 도장 컬렉션";
    return `<section class="ft-progress-card"><div class="ft-progress-top"><div><span class="ft-progress-label">${E(label)}</span><div class="ft-count">${n}<span> / ${booths.length}</span></div></div><div class="ft-progress-sticker" aria-hidden="true">${I((booths.length > 0 && n === booths.length) ? "party-popper" : "sparkles")}</div></div><div class="ft-progress" role="progressbar" aria-label="도장 수집" aria-valuemin="0" aria-valuemax="${booths.length}" aria-valuenow="${n}"><div style="width:${(booths.length ? n / booths.length : 0) * 100}%"></div></div><div class="ft-progress-note"><span>${(booths.length > 0 && n === booths.length) ? "모든 순간을 모았어요!" : `완주까지 ${booths.length - n}개 남았어요`}</span><span>${Math.round((booths.length ? n / booths.length : 0) * 100)}%</span></div></section>`;
  }

  function stampGrid() {
    const cConf = window.APP_CONFIG?.completion || {};
    const sConf = window.APP_CONFIG?.student || {};
    const bannerTitle = cConf.bannerTitle || "도장판을 모두 채웠어요!";
    const bannerBtn = cConf.bannerButton || "축하 보기";
    const heading = sConf.gridHeading || "어떤 도장을 모아볼까?";
    const empty = sConf.emptyBooths || "아직 등록된 부스가 없어요.";

    return `<section>${(booths.length > 0 && state.stamps.length === booths.length) ? `<div class="ft-complete-banner">${I("party-popper")}<b>${E(bannerTitle)}</b><button type="button" class="cursor-interaction" data-action="complete">${E(bannerBtn)}</button></div>` : ""}<div class="ft-section-heading"><h2>${E(heading)}</h2><span>${booths.length}개 부스</span></div><div class="ft-booth-grid">${!booths.length ? `<div class="ft-empty">${E(empty)}</div>` : ""}${booths.map((b, i) => `<div class="ft-stamp-card ${state.stamps.includes(b.id) ? "done" : ""}" style="--sticker-color:${colors[i % 4]};--tilt:${[-8, 6, -5, 5][i % 4]}deg" aria-label="${E(b.name)}, ${E(b.location)}, ${state.stamps.includes(b.id) ? "방문 완료" : "방문 전"}">${state.stamps.includes(b.id) ? `<span class="ft-stamp-check">${I("circle-check")}</span>` : ""}<span class="ft-sticker">${I(b.icon)}</span><h3>${E(b.name)}</h3><span class="ft-location">${I("map-pin")}${E(b.location || (sConf.locationDefault || "위치 안내 준비 중"))}</span></div>`).join("")}</div></section>`;
  }

  function studentRanking() {
    const rows = rankData(), me = state.myRank;
    return `${state.rankingLoading ? `<p class="ft-small-note" role="status">랭킹을 불러오고 있어요…</p>` : ""}${state.rankingError ? `<p class="ft-alert" role="alert">${E(state.rankingError)}</p>` : ""}${!state.rankingLoading && !state.rankingError && !rows.length ? `<div class="ft-empty">아직 적립된 랭킹이 없어요.</div>` : ""}${podium()}<section class="ft-my-rank"><div><span class="ft-eyebrow">${E(state.studentName)}님의 현재 순위</span><div><strong>${me ? me.rank + "위" : state.stamps.length ? "집계 전" : "순위 외"}</strong></div></div><div><span class="ft-eyebrow">모은 도장</span><div><b>${state.stamps.length}개</b></div></div></section><div class="ft-section-heading"><h2>스탬프 랭킹 TOP 20</h2><button type="button" class="ft-icon-button cursor-interaction" aria-label="랭킹 새로고침" data-action="refresh">${I("rotate-cw")}</button></div>${rows
      .slice(0, 20)
      .map(
        (p) =>
          `<div class="ft-rank-row"><span>${p.rank}</span><span>${E(p.name)}<small>${E(p.id)}</small></span><b>${p.count}개</b></div>`,
      )
      .join(
        "",
      )}<p class="ft-rules">상단 시상대는 순위별 대표 학생과 함께 오른 인원수를 표시해요. 도장이 많은 순서로 집계하고, 동점이면 마지막 도장을 먼저 모은 학생이 앞서요.</p><p class="ft-rules">경품 조건과 수령 방법은 행사 안내 확정 후 표시됩니다.</p>`;
  }

  function clubRanking() {
    const rows = state.clubRanking;
    const icons = new Map(booths.map(booth => [booth.id, booth.icon]));
    const status = state.clubRankingLoading
      ? `<p class="ft-small-note" role="status">동아리 랭킹을 불러오고 있어요…</p>`
      : state.clubRankingError
        ? `<div class="ft-alert" role="alert">${E(state.clubRankingError)}<button type="button" class="ft-link-button" data-action="refresh">다시 시도</button></div>`
        : !rows.length
          ? `<div class="ft-empty">아직 등록된 동아리 부스가 없어요.</div>`
          : !rows.some(row => row.count > 0)
            ? `<p class="ft-small-note" role="status">아직 방문 기록이 없어요. 첫 도장으로 랭킹을 시작해 보세요!</p>` : "";
    return `<section class="ft-club-ranking" aria-label="동아리 방문 랭킹">
      ${podium(false, "club") || `<div class="ft-club-ranking-hero">${sparks()}<span class="ft-chip">${I("trophy")}CLUB RANKING</span><h2>오늘의 <span class="ft-highlight">인기 동아리</span></h2><p>어떤 동아리를 가장 많이 만났을까요?<br>도장을 적립한 학생이 많은 순서예요.</p></div>`}
      <div class="ft-section-heading"><h2>동아리 랭킹</h2><button type="button" class="ft-icon-button cursor-interaction" aria-label="동아리 랭킹 새로고침" data-action="refresh" ${state.clubRankingLoading ? "disabled" : ""}>${I("rotate-cw")}</button></div>
      ${status}
      ${rows.length ? `<ol class="ft-club-ranking-list" role="list">${rows.map(row => `<li class="ft-club-rank${row.rank && row.rank <= 3 ? ` ft-club-rank-top ft-club-rank-${row.rank}` : ""}" data-club-id="${E(row.id)}"><span class="ft-club-rank-position" aria-label="${row.rank ? `${row.rank}위` : "방문 기록 없음"}">${row.rank || "—"}</span><span class="ft-club-rank-icon" aria-hidden="true">${I(icons.get(row.id) || "store")}</span><div class="ft-club-rank-info"><h3>${E(row.name)}</h3><span>${I("map-pin")}${E(row.location || "위치 안내 준비 중")}</span></div><div class="ft-club-rank-count"><b>${row.count.toLocaleString("ko-KR")}<small>명</small></b><span>방문 학생</span></div></li>`).join("")}</ol>` : ""}
      <p class="ft-rules">방문 학생 수가 같으면 공동 순위예요. 아직 방문 기록이 없는 동아리는 순위 없이 표시해요.</p>
    </section>`;
  }

  function student() {
    if (state.role === "student" && state.page === "login") return studentLogin();
    const fConf = window.APP_CONFIG?.festival || {};
    const mConf = window.APP_CONFIG?.menu || {};
    const sConf = window.APP_CONFIG?.student || {};

    const heroSubtitle = fConf.heroSubtitle || "모으는 재미가 있는 동아리 발표회";
    const heroTitle = fConf.heroTitle || "우리 동아리의<br><span class=\"ft-highlight\">반짝이는 순간들!</span>";
    const heroSticker = fConf.heroSticker || "LET'S<br>COLLECT!";

    const tabMain = mConf.main || "도장판";
    const tabRanking = mConf.ranking || "학생 랭킹";
    const tabClubs = mConf.clubs || "동아리 랭킹";
    const creditsLabel = mConf.credits || "함께 만든 사람들 · 크레딧";

    const scanBtn = sConf.scanButton || "내 스탬프 QR 코드 제시하기";
    const qrDesc = sConf.qrModalDesc || "부스 운영진에게 화면을 보여주시면 실시간으로 도장이 적립돼요.";
    const copyright = fConf.copyright || "";

    return `<article class="ft-phone">${statusbar()}<header class="ft-header">${brand()}<button type="button" class="ft-avatar-button cursor-interaction" data-action="student-login" aria-label="학생 계정 전환">${E(state.studentName.slice(1, 2) || "나")}</button></header><main class="ft-content">${state.studentTab === "main" ? `<section class="ft-hero"><p class="ft-eyebrow">${E(heroSubtitle)}</p><h1>${heroTitle}</h1><span class="ft-hero-sticker" aria-hidden="true">${heroSticker}</span></section>${progress()}` : ""}<nav class="ft-tabs" role="tablist" aria-label="학생 메뉴">${[
      ["main", tabMain],
      ["ranking", tabRanking],
      ["clubs", tabClubs],
    ]
      .map(
        ([k, label]) =>
          `<button type="button" class="cursor-interaction" role="tab" aria-selected="${state.studentTab === k}" aria-controls="ft-student-tab-panel" id="ft-student-tab-${k}" data-action="student-tab" data-tab="${k}">${label}</button>`,
      )
      .join(
        "",
      )}</nav><div role="tabpanel" id="ft-student-tab-panel" aria-labelledby="ft-student-tab-${state.studentTab}">${state.studentTab === "ranking" ? studentRanking() : state.studentTab === "clubs" ? clubRanking() : stampGrid()}</div></main>${state.studentTab === "main" ? `<div class="ft-bottom"><button type="button" class="ft-primary cursor-interaction" data-action="present-qr">${I("qr-code")}${E(scanBtn)}</button><p class="ft-small-note" style="text-align:center;margin:6px 0 0">${E(qrDesc)}</p></div>` : ""}<footer class="ft-student-footer"><button type="button" class="ft-link-button cursor-interaction" data-action="credits" aria-haspopup="dialog">${E(creditsLabel)}</button><p class="ft-small-note">${E(copyright)}</p></footer></article>`;
  }

  // ---------------------------------------------------------
  // 📱 스마트 감지 폴링 엔진 (학생 QR 제시 중 1.5초 간격 체크)
  // ---------------------------------------------------------
  let qrPollingTimer = null;
  let qrPollingTimeout = null;

  function stopQrPolling() {
    if (qrPollingTimer) { clearInterval(qrPollingTimer); qrPollingTimer = null; }
    if (qrPollingTimeout) { clearTimeout(qrPollingTimeout); qrPollingTimeout = null; }
  }

  function playSuccessChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") ctx.resume();
      const notes = [{ f: 587.33, d: 0.1, t: 0.0 }, { f: 880.00, d: 0.25, t: 0.1 }];
      notes.forEach(n => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(n.f, ctx.currentTime + n.t);
        gain.gain.setValueAtTime(0.2, ctx.currentTime + n.t);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + n.t + n.d);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + n.t);
        osc.stop(ctx.currentTime + n.t + n.d);
      });
    } catch (_) {}
  }

  function startQrPolling() {
    stopQrPolling();
    const prevCount = state.stamps ? state.stamps.length : 0;

    qrPollingTimer = setInterval(async () => {
      if (!activeStudent) return;
      try {
        const freshStamps = await service.studentStamps(activeStudent.id);
        const known = new Set(booths.map(b => b.id));
        const currentValidStamps = [...new Set(freshStamps.map(s => s.club_id).filter(id => known.has(id)))];
        
        if (currentValidStamps.length > prevCount) {
          stopQrPolling();
          state.stamps = currentValidStamps;
          
          const statusEl = document.getElementById("ft-qr-polling-status");
          if (statusEl) {
            statusEl.innerHTML = `<span style="color:#059669;font-weight:700">🎉 도장이 성공적으로 적립되었어요!</span>`;
          }
          
          playSuccessChime();
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
          if (!matchMedia("(prefers-reduced-motion: reduce)").matches && window.confetti) {
            window.confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
          }

          toast("도장이 성공적으로 적립되었어요! 🎉");

          setTimeout(async () => {
            closeModal(false);
            await loadBoard();
            if (state.studentTab === "ranking") await loadRanking();
            else if (state.studentTab === "clubs") await loadClubRanking();
          }, 1400);
        }
      } catch (_) {}
    }, 1500);

    // 60초 안전 타임아웃
    qrPollingTimeout = setTimeout(() => stopQrPolling(), 60000);
  }

  function openStudentModal(kind) {
    if (kind === "present-qr") {
      const sConf = window.APP_CONFIG?.student || {};
      const modalTitle = sConf.qrModalTitle || "내 스탬프 적립 QR";
      const modalDesc = sConf.qrModalDesc || "부스 운영진에게 이 화면을 보여주세요.";
      const modalHint = sConf.qrModalHint || "스캔 즉시 자동으로 도장이 적립돼요.";

      showModal(
        modalTitle,
        `<div style="text-align:center;">
          <div style="display:inline-flex;align-items:center;gap:6px;background:#f1f5f9;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;color:#334155;margin-bottom:8px;">
            <span>${E(activeStudent.id)}</span>
            <span>·</span>
            <span>${E(activeStudent.name)}</span>
          </div>
          <div id="ft-student-qr-container" style="display:flex;justify-content:center;align-items:center;background:#fff;border-radius:16px;padding:12px;margin:8px auto;width:176px;height:176px;box-shadow:0 2px 12px rgba(0,0,0,0.06);border:1px solid #e2e8f0;"></div>
          <div id="ft-qr-polling-status" class="ft-small-note" style="text-align:center;color:#0284c7;font-weight:600;display:flex;align-items:center;justify-content:center;gap:6px;margin-top:10px;">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#0ea5e9;"></span>
            부스 스캔 대기 중...
          </div>
          <p class="ft-small-note" style="text-align:center;color:#64748b;margin-top:6px;line-height:1.4;">
            ${E(modalDesc)}<br>${E(modalHint)}
          </p>
        </div>`
      );

      setTimeout(() => {
        const qrEl = document.getElementById("ft-student-qr-container");
        if (qrEl && typeof window.QRCode === "function") {
          qrEl.innerHTML = "";
          new QRCode(qrEl, {
            text: `STAMP:${activeStudent.id}`,
            width: 152,
            height: 152,
            colorDark: "#0f172a",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
          });
        }
        startQrPolling();
      }, 50);

    } else if (kind === "complete") {
      const cConf = window.APP_CONFIG?.completion || {};
      const cModalTitle = cConf.modalTitle || "도장판이<br><span class=\"ft-highlight\">반짝반짝 완성!</span>";
      const cModalDesc = cConf.modalDesc || "모든 부스를 만났어요.<br>오늘의 발견을 오래 기억해 주세요.";
      const prizeNote = cConf.prizeNote || "경품 조건과 수령 방법은<br>행사 안내 확정 후 표시됩니다.";

      showModal(
        "완주를 축하해요",
        `<div class="ft-celebration">${sparks()}<div class="ft-place ft-place-1"><div class="ft-medal-art"><span class="ft-crown">${I("crown")}</span><div class="ft-medal-seal">${I("sparkles")}</div></div></div><h3>${cModalTitle}</h3><p>${E(state.studentName)}님, ${booths.length}개 부스를 모두 만났어요.<br>${cModalDesc}</p><div class="ft-prize-note">${prizeNote}</div><button type="button" class="ft-primary cursor-interaction" data-action="close-modal">내 도장판 보기</button></div>`,
      );
    }
  }


  const service = window.StampTourService;
  let activeStudent = null, boardVersion = 0, rankingVersion = 0, clubRankingVersion = 0, verifying = false;
  let camera = null, cameraStart = null, cameraVersion = 0, cameraVideo = null, cameraCleanup = Promise.resolve();

  function stopCamera() {
    ++cameraVersion;
    const old = camera, pending = cameraStart, video = cameraVideo;
    camera = null; cameraStart = null; cameraVideo = null;
    video?.srcObject?.getTracks().forEach(track => track.stop());
    if (!old) return cameraCleanup;
    cameraCleanup = (async () => {
      try { await pending; if (old.isScanning) await old.stop(); } catch (_) {}
      try { old.clear(); } catch (_) {}
    })();
    return cameraCleanup;
  }
  async function startCamera() {
    const token = ++cameraVersion;
    const reader = root.querySelector("#ft-qr-reader");
    const status = root.querySelector("#ft-camera-status");
    await cameraCleanup;
    if (token !== cameraVersion || !reader?.isConnected) return;
    if (typeof window.Html5Qrcode !== "function") { if (status) status.textContent = "카메라를 불러오지 못했어요. 숫자 코드를 이용해 주세요."; return; }
    const instance = new Html5Qrcode("ft-qr-reader");
    camera = instance;
    let detected = false;
    try {
      cameraStart = instance.start({ facingMode: "environment" }, { fps: 15, qrbox: { width: 230, height: 230 } }, async payload => {
        if (detected || token !== cameraVersion || verifying) return;
        detected = true;
        closeModal();
        try {
          const parts = atob(payload).split(":");
          if (parts.length !== 2) throw new Error("유효하지 않은 QR 코드예요.");
          await verify(parts[0], parts[1]);
        } catch (error) { toast(error.message || "유효하지 않은 QR 코드예요."); }
      }, () => {});
      await cameraStart;
      const video = reader.querySelector("video");
      if (token !== cameraVersion) {
        video?.srcObject?.getTracks().forEach(track => track.stop());
        try { await instance.stop(); instance.clear(); } catch (_) {}
        return;
      }
      if (status?.isConnected) status.textContent = "부스의 QR 코드를 프레임 안에 맞춰 주세요.";
      cameraVideo = video;
    } catch (_) {
      if (token === cameraVersion && status?.isConnected) status.textContent = "카메라를 켜지 못했어요. 권한을 확인하거나 숫자 코드를 이용해 주세요.";
    }
  }
  async function loadBoard() {
    if (!activeStudent) return false;
    const current = activeStudent, ticket = ++boardVersion;
    try {
      const [clubs, stamps] = await Promise.all([service.clubs(), service.studentStamps(current.id)]);
      if (current !== activeStudent || ticket !== boardVersion) return false;
      booths.splice(0, booths.length, ...clubs);
      const known = new Set(clubs.map(booth => booth.id));
      state.stamps = [...new Set(stamps.map(stamp => stamp.club_id).filter(id => known.has(id)))];
      state.error = "";
      render();
      const completed = booths.length > 0 && state.stamps.length === booths.length;
      const key = `celebrated_${current.id}`;
      if (completed && !sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "true");
        openStudentModal("complete");
        if (!matchMedia("(prefers-reduced-motion: reduce)").matches) window.confetti?.({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }
      return true;
    } catch (error) {
      if (current === activeStudent && ticket === boardVersion) { state.error = error.message; render(); }
      return false;
    }
  }
  async function loadRanking() {
    if (!activeStudent) return;
    const current = activeStudent, ticket = ++rankingVersion;
    state.rankingLoading = true; state.rankingError = ""; render();
    try {
      const data = await service.studentRanking(current.id);
      if (current !== activeStudent || ticket !== rankingVersion) return;
      state.myRank = data.mine;
      state.rankingError = data.podiumError;
      state.ranking = data.top.map(row => ({ rank: Number(row.rank), name: row.masked_name, id: row.masked_student_id, count: Number(row.stamp_count), masked: true }));
      state.studentPodium = data.podium.map(row => ({ rank: Number(row.rank), name: row.masked_name, id: row.masked_student_id, count: Number(row.stamp_count), memberCount: Number(row.member_count), masked: true }));
    } catch (error) {
      if (current === activeStudent && ticket === rankingVersion) { state.ranking = []; state.studentPodium = []; state.myRank = null; state.rankingError = error.message; }
    } finally {
      if (current === activeStudent && ticket === rankingVersion) { state.rankingLoading = false; render(); }
    }
  }
  async function loadClubRanking() {
    if (!activeStudent) return;
    const current = activeStudent, ticket = ++clubRankingVersion;
    state.clubRankingLoading = true; state.clubRankingError = ""; render();
    try {
      const rows = await service.clubRanking();
      if (current !== activeStudent || ticket !== clubRankingVersion) return;
      state.clubRanking = rows;
    } catch (error) {
      if (current === activeStudent && ticket === clubRankingVersion) {
        state.clubRanking = []; state.clubRankingError = error.message;
      }
    } finally {
      if (current === activeStudent && ticket === clubRankingVersion) { state.clubRankingLoading = false; render(); }
    }
  }
  const responseMessage = status => ({
    ALREADY_STAMPED: "이미 도장을 모은 부스예요.",
    ERROR_EXPIRED_CODE: "만료된 코드예요. 부스에서 새 코드를 받아 주세요.",
    ERROR_NOT_A_STUDENT: "학생 정보로 다시 로그인해 주세요.",
    ERROR_UNAUTHORIZED: "로그인이 만료됐어요. 다시 로그인해 주세요.",
  }[status] || "코드가 일치하지 않아요. 부스와 숫자를 확인해 주세요.");
  async function verify(boothId, code) {
    if (verifying) return;
    if (!activeStudent) throw new Error("학생 정보를 먼저 등록해 주세요.");
    if (!/^\d{6}$/.test(code || "") || !booths.some(booth => booth.id === boothId)) throw new Error("방문 부스와 6자리 숫자를 확인해 주세요.");
    if (state.stamps.includes(boothId)) throw new Error(responseMessage("ALREADY_STAMPED"));
    verifying = true;
    try {
      await service.studentLogin(activeStudent, true);
      const status = await service.verifyStamp(boothId, code);
      if (status !== "SUCCESS") throw new Error(responseMessage(status));
      closeModal(false);
      const fresh = await loadBoard();
      toast(fresh ? "도장이 적립됐어요!" : "도장이 적립됐어요. 연결을 확인하고 도장판을 새로 불러와 주세요.");
      if (state.studentTab === "ranking") await loadRanking();
      else if (state.studentTab === "clubs") await loadClubRanking();
    } finally { verifying = false; }
  }
  async function submitForm(form) {
    const data = new FormData(form), error = form.querySelector(".ft-error");
    if (form.dataset.form === "student") {
      const id = String(data.get("studentId") || "").trim(), name = String(data.get("name") || "").trim();
      const idPattern = new RegExp(window.APP_CONFIG?.auth?.studentIdPattern || "^\\d{4,8}$");
      if (!idPattern.test(id)) {
        error.textContent = `학번 형식을 확인해 주세요. (${window.APP_CONFIG?.auth?.studentIdHelp || "학번 입력"})`;
        return;
      }
      if (!name) { error.textContent = "이름을 입력해 주세요."; return; }
      const student = { id, name };
      await service.studentLogin(student);
      localStorage.setItem("student_session", JSON.stringify(student));
      activeStudent = student; state.studentId = id; state.studentName = name;
      state.stamps = []; state.ranking = []; state.studentPodium = []; state.myRank = null; state.page = "app"; state.studentTab = "main";
      state.clubRanking = []; state.clubRankingLoading = false; state.clubRankingError = "";
      render(); await loadBoard(); toast(`${name}님, 투어를 시작해요!`);
    } else if (form.dataset.form === "manual") {
      await verify(String(data.get("booth") || ""), String(data.get("code") || "").trim());
    }
  }
  async function init() {
    activeStudent = service.savedStudent();
    if (!activeStudent) { state.page = "login"; state.ready = true; render(); return; }
    try {
      await service.studentLogin(activeStudent, true);
      state.studentId = activeStudent.id; state.studentName = activeStudent.name;
      state.page = "app"; state.ready = true; render();
      await loadBoard();
      if (state.studentTab === "ranking") await loadRanking();
      else if (state.studentTab === "clubs") await loadClubRanking();
    } catch (error) {
      activeStudent = null; state.page = "login"; state.ready = true; state.error = error.message; render();
    }
  }
  mount({
    view: student, onSubmit: submitForm,
    onModalClose: () => { stopCamera(); stopQrPolling(); },
    onRefresh: () => state.studentTab === "clubs" ? loadClubRanking() : loadRanking(),
    async onAction(action, button) {
      if (action === "student-tab") {
        state.studentTab = button.dataset.tab; render();
        panel.querySelector(`[data-tab="${state.studentTab}"]`)?.focus();
        if (state.studentTab === "ranking") await loadRanking();
        else if (state.studentTab === "clubs") await loadClubRanking();
      } else if (action === "student-login") {
        if (verifying) { toast("도장 적립을 처리하고 있어요. 잠시 기다려 주세요."); return; }
        await service.logout();
        localStorage.removeItem("student_session");
        activeStudent = null; ++boardVersion; ++rankingVersion; ++clubRankingVersion;
        state.stamps = []; state.ranking = []; state.studentPodium = []; state.myRank = null; state.page = "login"; state.error = "";
        state.clubRanking = []; state.clubRankingLoading = false; state.clubRankingError = "";
        render();
      } else if (["scan", "manual", "complete", "present-qr"].includes(action)) {
        if (!booths.length && action !== "complete") { toast("부스 목록을 먼저 불러와 주세요."); return; }
        openStudentModal(action);
      } else if (action === "retry") {
        if (activeStudent) await loadBoard(); else await init();
      }
    },
  });
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible") { closeModal(false); return; }
    if (activeStudent) {
      await loadBoard();
      if (state.studentTab === "ranking") await loadRanking();
      else if (state.studentTab === "clubs") await loadClubRanking();
    }
  });
  window.addEventListener("pagehide", stopCamera);
  init();
})();
