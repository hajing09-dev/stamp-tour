/* Booth operator UI: Student QR camera scanner & manual student ID grant engine */
(() => {
  "use strict";
  const ui = window.StampTourUI.create("booth");
  const {
    root,
    panel,
    state,
    config,
    booths,
    I,
    E,
    statusbar,
    mount,
    render,
    toast,
  } = ui;

  const service = window.StampTourService;
  let active = false, ending = false, stops = [];
  let scannerInstance = null, isProcessingScan = false, lastScanned = "", lastScannedTime = 0;
  let feedbackTimer = null;

  // 기본 상태 초기화
  state.boothMode = "scan"; // 'scan' | 'manual'
  state.feedback = null;    // { type, title, desc }
  state.recentVisitors = [];

  function playBeep(type = "success") {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") ctx.resume();

      if (type === "success") {
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
      } else if (type === "warning") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
      }
    } catch (_) {}
  }

  function triggerConfetti() {
    if (typeof window.confetti === "function") {
      window.confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ["#0ea5e9", "#10b981", "#f59e0b", "#6366f1"]
      });
    }
  }

  function setFeedback(type, title, desc) {
    if (feedbackTimer) clearTimeout(feedbackTimer);
    state.feedback = { type, title, desc };
    render();
    feedbackTimer = setTimeout(() => {
      state.feedback = null;
      render();
    }, 3200);
  }

  // ---------------------------------------------------------
  // 📷 카메라 QR 스캐너 컨트롤러
  // ---------------------------------------------------------
  function stopBoothScanner() {
    if (scannerInstance) {
      try {
        const isScanning = scannerInstance.isScanning || (scannerInstance.getState && scannerInstance.getState() === 2);
        if (isScanning) {
          scannerInstance.stop().catch(() => {}).finally(() => {
            try { scannerInstance.clear(); } catch (_) {}
            scannerInstance = null;
          });
          return;
        }
      } catch (_) {}
      try { scannerInstance.clear(); } catch (_) {}
      scannerInstance = null;
    }
  }

  function startBoothScanner() {
    stopBoothScanner();
    setTimeout(() => {
      const readerEl = panel.querySelector("#ft-booth-reader");
      if (!readerEl) return;
      if (typeof window.Html5Qrcode !== "function") {
        const statusEl = panel.querySelector("#ft-scan-status");
        if (statusEl) statusEl.textContent = "스캐너 라이브러리를 불러오지 못했어요. 학번 직접 입력을 이용해 주세요.";
        return;
      }

      try {
        const instance = new Html5Qrcode("ft-booth-reader");
        scannerInstance = instance;
        const config = { fps: 15, qrbox: { width: 220, height: 220 } };

        instance.start(
          { facingMode: "environment" },
          config,
          onQrDetected,
          () => {}
        ).catch(() => {
          // 후면 카메라 실패 시 전면 카메라 시도
          instance.start(
            { facingMode: "user" },
            config,
            onQrDetected,
            () => {}
          ).catch(() => {
            const statusEl = panel.querySelector("#ft-scan-status");
            if (statusEl) statusEl.textContent = "카메라 권한을 확인해 주세요. 학번 직접 입력을 이용할 수 있어요.";
          });
        });
      } catch (e) {
        console.error("Scanner start error:", e);
      }
    }, 100);
  }

  async function onQrDetected(decodedText) {
    if (isProcessingScan) return;
    const now = Date.now();
    if (decodedText === lastScanned && (now - lastScannedTime) < 3000) return; // 3초 중복 방지

    isProcessingScan = true;
    lastScanned = decodedText;
    lastScannedTime = now;

    const statusEl = panel.querySelector("#ft-scan-status");
    if (statusEl) statusEl.textContent = "⚡ 스캔 감지! 도장 지급 중...";

    try {
      await grantStampToStudent(decodedText);
    } finally {
      setTimeout(() => {
        isProcessingScan = false;
        if (statusEl && statusEl.isConnected) statusEl.textContent = "학생의 스탬프 QR 코드를 프레임에 맞춰주세요.";
      }, 1500);
    }
  }

  // ---------------------------------------------------------
  // ⚡ 스탬프 지급 처리 함수 (RPC booth_grant_stamp)
  // ---------------------------------------------------------
  async function grantStampToStudent(studentInput) {
    if (!state.booth) return;

    try {
      const res = await service.grantStamp(studentInput);
      if (!res) throw new Error("서버 응답이 비어있어요.");

      if (res.status === "SUCCESS") {
        setFeedback("SUCCESS", "스탬프 적립 성공!", `${res.student_name} (${res.student_id}) · 총 ${res.total_stamps}개`);
        playBeep("success");
        triggerConfetti();
        toast(`[${res.student_id} ${res.student_name}] 스탬프 지급 완료!`);
        await refreshMetrics();

      } else if (res.status === "ALREADY_STAMPED") {
        setFeedback("WARNING", "이미 적립 완료된 학생", `${res.student_name} (${res.student_id}) · 누적 ${res.total_stamps}개`);
        playBeep("warning");
        toast(`이미 도장을 받은 학생이에요. (${res.student_name})`);

      } else {
        setFeedback("ERROR", "스탬프 지급 거부", res.message || "처리할 수 없는 요청이에요.");
        playBeep("warning");
        toast(res.message || "도장 지급에 실패했어요.");
      }
    } catch (err) {
      setFeedback("ERROR", "통신 장애", err.message || "서버 통신 오류가 발생했어요.");
      toast(err.message || "오류가 발생했어요.");
    }
  }

  async function refreshMetrics() {
    try {
      const [count, recent] = await Promise.all([
        service.visitors(state.booth),
        service.recentBoothVisitors(state.booth)
      ]);
      if (active) {
        state.visitors = count;
        state.recentVisitors = recent;
        state.error = "";
        render();
        if (state.boothMode === "scan" && !scannerInstance) {
          startBoothScanner();
        }
      }
    } catch (e) {
      if (active) { state.error = e.message; render(); }
    }
  }

  function feedbackBanner() {
    if (!state.feedback) return "";
    const { type, title, desc } = state.feedback;
    const isSuccess = type === "SUCCESS";
    const isWarn = type === "WARNING";

    const bg = isSuccess ? "#ecfdf5" : isWarn ? "#fffbeb" : "#fff1f2";
    const border = isSuccess ? "#a7f3d0" : isWarn ? "#fde68a" : "#fecdd3";
    const text = isSuccess ? "#065f46" : isWarn ? "#92400e" : "#9f1239";
    const icon = isSuccess ? "circle-check" : isWarn ? "alert-circle" : "alert-triangle";

    return `
      <div style="background:${bg};border:1.5px solid ${border};color:${text};padding:14px 18px;border-radius:16px;margin:12px 0;display:flex;align-items:center;gap:12px;box-shadow:0 4px 12px rgba(0,0,0,0.05);animation:ft-fade-in 0.2s ease;">
        <div style="font-size:24px;line-height:1;">${I(icon)}</div>
        <div style="flex:1;">
          <strong style="display:block;font-size:14px;font-weight:700;">${E(title)}</strong>
          <span style="font-size:12px;opacity:0.9;">${E(desc)}</span>
        </div>
      </div>
    `;
  }

  function booth() {
    const bConf = window.APP_CONFIG?.booth || {};
    const aConf = window.APP_CONFIG?.auth || {};
    const b = booths.find(item => item.id === state.booth) || { name: "담당 부스", location: "" };

    const boothTitle = bConf.title || "방문 학생에게<br><span class=\"ft-highlight\">스탬프를 지급해 주세요.</span>";
    const boothDesc = bConf.desc || "학생이 제시한 QR을 스캔하거나, 학번을 직접 입력할 수 있어요.";
    const tabScan = bConf.tabScan || "카메라 스캔 모드";
    const tabManual = bConf.tabManual || "학번 직접 입력";
    const scanStatusWaiting = bConf.scanStatusWaiting || "학생의 스탬프 QR 코드를 프레임에 맞춰주세요";
    const btnRestartCamera = bConf.btnRestartCamera || "카메라 다시 시작";
    const manualLabel = bConf.manualLabel || "학생 학번";
    const manualHelp = bConf.manualHelp || "카메라 인식이 어려울 때 학번을 직접 입력해 주세요.";
    const studentPlaceholder = aConf.studentIdPlaceholder || "예: 20101";
    const btnGrantStamp = bConf.btnGrantStamp || "스탬프 즉시 지급";
    const statVisitorCount = bConf.statVisitorCount || "누적 적립 학생";
    const statStatusLabel = bConf.statStatusLabel || "실시간 관제 상태";
    const statStatusRunning = bConf.statStatusRunning || "정상 가동";
    const recentFeedTitle = bConf.recentFeedTitle || "방금 적립된 학생";
    const recentFeedEmpty = bConf.recentFeedEmpty || "아직 적립된 학생이 없어요.";

    return `
      <article class="ft-operator">
        ${statusbar()}
        <header class="ft-header">
          <div class="ft-brand">
            <span class="ft-brandmark">${I(b.icon || "store")}</span>
            <div>
              <span class="ft-header-label">${E(config.eventName)} · 부스 운영 콘솔</span>
              ${E(b.name)}
            </div>
          </div>
          <button type="button" class="ft-secondary cursor-interaction" data-action="logout">
            ${I("log-out")}로그아웃
          </button>
        </header>

        <main class="ft-operator-main">
          <div class="ft-operator-title">
            <span class="ft-chip">${I("map-pin")}${E(b.location || (window.APP_CONFIG?.student?.locationDefault || "위치 안내 준비 중"))}</span>
            <h1>${boothTitle}</h1>
            <p>${E(boothDesc)}</p>
          </div>

          <!-- 상단 2단 전환 탭 -->
          <section class="ft-code-card" style="padding:16px;">
            <div class="ft-code-tabs" aria-label="도장 지급 방식">
              <button type="button" class="cursor-interaction" aria-pressed="${state.boothMode === 'scan'}" data-action="mode-scan">
                ${I("camera")}${E(tabScan)}
              </button>
              <button type="button" class="cursor-interaction" aria-pressed="${state.boothMode === 'manual'}" data-action="mode-manual">
                ${I("keyboard")}${E(tabManual)}
              </button>
            </div>

            ${feedbackBanner()}

            <!-- 1. 카메라 스캐너 뷰 -->
            ${state.boothMode === "scan" ? `
              <div style="width:100%;max-width:320px;margin:10px auto;border-radius:18px;overflow:hidden;background:#0f172a;box-shadow:0 4px 16px rgba(0,0,0,0.12);">
                <div id="ft-booth-reader" style="width:100%;min-height:240px;"></div>
                <div id="ft-scan-status" class="ft-small-note" style="color:#e2e8f0;padding:10px 14px;text-align:center;background:rgba(15,23,42,0.9);display:flex;align-items:center;justify-content:center;gap:6px;">
                  ${I("aperture")} ${E(scanStatusWaiting)}
                </div>
              </div>
              <button type="button" class="ft-link-button cursor-interaction" style="margin:8px auto 0;display:block;" data-action="restart-camera">
                ${I("rotate-cw")}${E(btnRestartCamera)}
              </button>
            ` : `
              <!-- 2. 학번 직접 입력 뷰 -->
              <form class="ft-form" data-form="manual-grant" style="max-width:320px;margin:16px auto 8px;">
                <label for="ft-manual-grant-id">
                  ${E(manualLabel)}
                  <input id="ft-manual-grant-id" name="studentId" inputmode="numeric" maxlength="12" autocomplete="off" placeholder="${E(studentPlaceholder)}" autofocus>
                  <small>${E(manualHelp)}</small>
                </label>
                <div class="ft-error" role="alert"></div>
                <button type="submit" class="ft-primary cursor-interaction" style="margin-top:10px;width:100%;">
                  ${I("circle-check")}${E(btnGrantStamp)}
                </button>
              </form>
            `}
          </section>

          <!-- 운영진 통계 카드 -->
          <div class="ft-operator-stats">
            <div class="ft-operator-stat">
              ${I("users")}
              <div>
                <span>${E(statVisitorCount)}</span>
                <b>${state.visitors ?? 0}명</b>
              </div>
            </div>
            <div class="ft-operator-stat">
              ${I("activity")}
              <div>
                <span>${E(statStatusLabel)}</span>
                <b style="color:#059669;">${E(statStatusRunning)}</b>
              </div>
            </div>
          </div>

          <!-- 최근 적립 피드 -->
          <div class="ft-section-heading" style="margin-top:20px;">
            <h2>${E(recentFeedTitle)}</h2>
            <span>최신 5건</span>
          </div>

          ${state.recentVisitors && state.recentVisitors.length > 0 ? `
            <div style="display:flex;flex-direction:column;gap:8px;">
              ${state.recentVisitors.map(v => {
                const timeStr = new Date(v.time).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                return `
                  <div style="display:flex;align-items:center;justify-content:between;background:#fff;padding:10px 14px;border-radius:14px;border:1px solid #e2e8f0;box-shadow:0 1px 4px rgba(0,0,0,0.02);">
                    <div style="display:flex;align-items:center;gap:10px;flex:1;">
                      <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#ecfdf5;color:#059669;font-weight:700;font-size:12px;">✓</span>
                      <strong style="font-family:monospace;font-size:13px;color:#0f172a;">${E(v.id)}</strong>
                      <span style="font-size:13px;color:#475569;">${E(v.name)}</span>
                    </div>
                    <span style="font-size:11px;color:#94a3b8;font-family:monospace;">${timeStr}</span>
                  </div>
                `;
              }).join("")}
            </div>
          ` : `
            <div class="ft-empty" style="padding:20px 0;">${E(recentFeedEmpty)}</div>
          `}
        </main>
      </article>
    `;
  }

  function dispose() {
    active = false;
    stopBoothScanner();
    stops.splice(0).forEach(stop => stop());
  }

  async function terminate() {
    if (ending) return;
    ending = true;
    dispose();
    ui.showModal(
      "로그인이 종료됐어요",
      `<p>다른 기기에서 로그인했거나 권한이 만료됐어요. 운영진 로그인 화면에서 다시 시작해 주세요.</p><button type="button" class="ft-primary" data-action="session-exit">다시 로그인</button>`,
      { dismissible: false }
    );
    try { await service.logout(); } catch (_) {}
  }

  async function init() {
    stops = [
      () => stopBoothScanner(),
      () => { if (feedbackTimer) clearTimeout(feedbackTimer); }
    ];

    try {
      const access = await service.staffAccess("L2", true);
      if (!access.ok) { window.location.replace("portal.html?role=booth"); return; }
      state.booth = access.profile.club_id;

      const allBooths = await service.clubs();
      booths.splice(0, booths.length, ...allBooths);
      active = true;
      state.ready = true;
      render();

      await refreshMetrics();
      if (state.boothMode === "scan") {
        startBoothScanner();
      }

      // 실시간 스탬프 감시
      stops.push(service.watchBooth(state.booth, () => refreshMetrics()));
      // 단일 기기 세션 감시
      stops.push(service.watchStaff(access.profile.email, access.profile.active_session_id, terminate));

    } catch (e) {
      state.error = e.message;
      state.ready = true;
      render();
    }
  }

  mount({
    view: booth,
    async onSubmit(form) {
      if (form.dataset.form === "manual-grant") {
        const input = form.querySelector("#ft-manual-grant-id");
        const val = input ? input.value.trim() : "";
        const errorEl = form.querySelector(".ft-error");

        const pattern = new RegExp(window.APP_CONFIG?.auth?.studentIdPattern || "^\\d{4,8}$");
        if (!pattern.test(val)) {
          if (errorEl) errorEl.textContent = `학번 형식을 확인해 주세요. (${window.APP_CONFIG?.auth?.studentIdHelp || "학번 입력"})`;
          return;
        }
        if (errorEl) errorEl.textContent = "";

        const submitBtn = form.querySelector("button[type=submit]");
        if (submitBtn) submitBtn.disabled = true;
        try {
          await grantStampToStudent(val);
          if (input) { input.value = ""; input.focus(); }
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      }
    },
    async onAction(action) {
      if (action === "mode-scan") {
        state.boothMode = "scan";
        render();
        startBoothScanner();
      } else if (action === "mode-manual") {
        state.boothMode = "manual";
        stopBoothScanner();
        render();
        setTimeout(() => {
          panel.querySelector("#ft-manual-grant-id")?.focus();
        }, 50);
      } else if (action === "restart-camera") {
        startBoothScanner();
      } else if (action === "logout") {
        dispose();
        await service.logout();
        window.location.replace("portal.html?role=booth");
      } else if (action === "session-exit") {
        window.location.replace("portal.html?role=booth");
      }
    }
  });

  window.addEventListener("pagehide", dispose);
  init();
})();
