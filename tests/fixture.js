/* Isolated test/review backend. Never loaded by the production HTML. */
(function () {
  function install(win, options = {}) {
    const role = options.role ?? (/admin\.html/.test(win.location.pathname) ? "L3" : /booth\.html/.test(win.location.pathname) ? "L2" : /portal\.html/.test(win.location.pathname) ? "none" : "L1");
    const ids = ["club-code", "band-9", "photo-A", "science-42", "art-C", "film-Q", "game-3", "radio-Z"];
    const names = ["코딩 동아리", "밴드 동아리", "사진 동아리", "과학탐구 동아리", "미술 동아리", "영화 동아리", "보드게임 동아리", "방송 동아리"];
    const state = {
      clubs: ids.map((club_id, i) => ({ club_id, name: names[i], location: ["2층 컴퓨터실", "강당", "1층 로비", "2층 과학실", "1층 미술실", "3층 미디어실", "2층 201호", "3층 방송실"][i] })),
      users: [{ student_id: "20101@festival.com", name: "김하늘", role: "L1", is_approved: true }, { student_id: "admin@festival.com", name: "관리자", role: "L3", is_approved: true, active_session_id: "review-token" }, { student_id: "club-code@festival.com", name: "부스 담당자", role: "L2", club_id: "club-code", is_approved: true, active_session_id: "review-token" }],
      stamps: [], stamp_logs: [], clubs_status: [], session: null, fail: new Set(), gates: {}, calls: [], channels: [], cameraStops: 0,
    };
    const roster = ["이지윤", "박서준", "최윤서", "정선우", "강예린", "김도현", "윤수아", "임서연", "서지민", "한수빈", "오지원", "신하율", "장민수", "문지아", "조성훈", "백채은", "유서진", "홍시우", "남소연", "안지서"];
    roster.forEach((name, index) => {
      const id = String(20201 + index), count = Math.max(1, 8 - Math.floor(index / 3));
      state.users.push({ student_id: id + "@festival.com", name, role: "L1", is_approved: true });
      for (let j = 0; j < count; j++) state.stamps.push({ id: state.stamps.length + 1, student_id: id + "@festival.com", club_id: ids[j], created_at: new Date(Date.UTC(2026, 9, 15, 3, index, j)).toISOString() });
    });
    [ids[0], ids[2], ids[5]].forEach((club_id, i) => state.stamps.push({ id: state.stamps.length + 1, club_id, student_id: "20101@festival.com", created_at: new Date(Date.UTC(2026, 9, 15, 4, i)).toISOString() }));
    if (options.reviewTies) {
      for (const tied of state.stamps.filter(stamp => stamp.student_id === "20202@festival.com")) {
        tied.created_at = state.stamps.find(stamp => stamp.student_id === "20201@festival.com" && stamp.club_id === tied.club_id).created_at;
      }
      state.users.push({ student_id:"20999@festival.com", name:"검토 참가자", role:"L1", is_approved:true });
      state.stamps.push({ id:state.stamps.length+1, student_id:"20999@festival.com", club_id:ids[1], created_at:new Date().toISOString() });
    }
    state.stamp_logs = state.stamps.slice(-20).map((row, index) => ({ ...row, id: index + 1, status: index === 2 ? "ERROR_EXPIRED_CODE" : index === 8 ? "ALREADY_STAMPED" : "SUCCESS" }));
    const email = role === "L3" ? "admin@festival.com" : role === "L2" ? "club-code@festival.com" : "20101@festival.com";
    if (role !== "none") state.session = { user: { email, id: "review-user" } };
    if (role === "L1") win.localStorage.setItem("student_session", JSON.stringify({ id: "20101", name: "김하늘" }));
    if (["L2", "L3"].includes(role)) {
      win.localStorage.setItem("current_session_token", "review-token");
      win.sessionStorage.setItem("session_token", JSON.stringify({ role, boothId: "club-code", sessionId: "review-token", authTime: Date.now() }));
    }
    const error = () => ({ data: null, error: { message: "fixture error" }, count: null });
    function emit(table, row) {
      for (const channel of state.channels) for (const event of channel.events) {
        if (event.filter.table !== table) continue;
        const filter = event.filter.filter;
        if (filter) { const [field, value] = filter.split("=eq."); if (row[field] !== value) continue; }
        event.callback({ new: row });
      }
    }
    class Query {
      constructor(table) { this.table = table; this.op = "select"; this.filters = []; }
      select(columns, settings = {}) { this.columns = columns; this.settings = settings; return this; }
      eq(key, value) { this.filters.push(row => row[key] === value); return this; }
      neq(key, value) { this.filters.push(row => row[key] !== value); return this; }
      order(key, options = {}) { this.orderBy = key; this.ascending = options.ascending !== false; return this; }
      range(from, to) { this.from = from; this.to = to; return this; }
      limit(limit) { this.take = limit; return this; }
      single() { this.one = true; return this; }
      upsert(payload, options) { this.op = "upsert"; this.payload = payload; this.conflict = options.onConflict; return this; }
      update(payload) { this.op = "update"; this.payload = payload; return this; }
      then(resolve, reject) { return this.execute().then(resolve, reject); }
      async execute() {
        state.calls.push({ table: this.table, op: this.op, from: this.from, to: this.to });
        if (state.gates[this.table + ":" + this.op]) await state.gates[this.table + ":" + this.op];
        if (state.fail.has(this.table + ":" + this.op)) return error();
        const all = state[this.table];
        let rows = all.filter(row => this.filters.every(test => test(row)));
        if (this.op === "select" && this.table === "stamps") {
          const profile = state.users.find(user => user.student_id === state.session?.user?.email);
          if (profile?.role !== "L3") rows = rows.filter(row => profile?.role === "L2" ? row.club_id === profile.club_id : row.student_id === state.session?.user?.email);
        }
        if (this.op === "upsert") {
          const index = all.findIndex(row => row[this.conflict] === this.payload[this.conflict]);
          if (index >= 0) Object.assign(all[index], this.payload); else all.push({ ...this.payload });
          rows = [all.find(row => row[this.conflict] === this.payload[this.conflict])];
        } else if (this.op === "update") rows.forEach(row => Object.assign(row, this.payload));
        if (this.orderBy) rows.sort((a, b) => (a[this.orderBy] < b[this.orderBy] ? -1 : a[this.orderBy] > b[this.orderBy] ? 1 : 0) * (this.ascending ? 1 : -1));
        const count = rows.length;
        if (this.from != null) rows = rows.slice(this.from, this.to + 1);
        if (this.take != null) rows = rows.slice(0, this.take);
        return { data: this.settings?.head ? null : this.one ? rows[0] || null : rows.map(row => ({ ...row })), count, error: null };
      }
    }
    function ranking() {
      const grouped = new Map();
      state.stamps.forEach(stamp => {
        const row = grouped.get(stamp.student_id) || { email: stamp.student_id, count: 0, last: stamp.created_at };
        row.count++; if (stamp.created_at > row.last) row.last = stamp.created_at;
        grouped.set(stamp.student_id, row);
      });
      let rank = 0;
      const rows = [...grouped.values()].sort((a, b) => b.count - a.count || Date.parse(a.last) - Date.parse(b.last));
      return rows.map((row, i) => {
        if (!i || rows[i - 1].count !== row.count || rows[i - 1].last !== row.last) rank++;
        const name = state.users.find(user => user.student_id === row.email)?.name || "참가자";
        return { rank, email: row.email, stamp_count: row.count, masked_student_id: row.email.slice(0, 3) + "**", masked_name: name[0] + "*" + name.slice(2) };
      });
    }
    win.supabase = {
      auth: {
        async getSession() { return { data: { session: state.session }, error: null }; },
        async signInWithPassword({ email, password }) {
          state.calls.push({ method: "signIn", email });
          if (password === "wrong" || state.fail.has("auth")) return error();
          if (!state.users.some(user => user.student_id === email)) return error();
          state.session = { user: { email, id: "review-user" } }; return { data: { session: state.session }, error: null };
        },
        async signUp({ email, options }) { if (state.fail.has("auth")) return error(); state.users.push({ student_id: email, name: options.data.name, role: "L1", is_approved: true }); state.session = { user: { email, id: "review-user" } }; return { data: { session: state.session }, error: null }; },
        async signOut() { state.session = null; return { error: null }; },
      },
      from(table) { return new Query(table); },
      async rpc(name, args) {
        state.calls.push({ method: "rpc", name, args });
        if (state.gates[name]) await state.gates[name];
        if (state.fail.has(name)) return error();
        if (name === "get_stamp_podium") {
          if (!state.session) return error();
          const groups = new Map();
          for (const row of ranking().filter(row=>row.rank<=3).sort((a,b)=>a.email.localeCompare(b.email))) {
            const group = groups.get(row.rank);
            if (group) group.member_count++;
            else groups.set(row.rank, { rank:row.rank, masked_student_id:row.masked_student_id, masked_name:row.masked_name, stamp_count:row.stamp_count, member_count:1 });
          }
          return { data:[...groups.values()].sort((a,b)=>a.rank-b.rank), error:null };
        }
        if (name === "get_club_leaderboard") {
          if (!state.session) return error();
          const rows = state.clubs.map(club => ({
            club_id: club.club_id, name: club.name, location: club.location,
            visitor_count: new Set(state.stamps.filter(stamp => stamp.club_id === club.club_id).map(stamp => stamp.student_id)).size,
          })).sort((a,b) => b.visitor_count - a.visitor_count || a.name.localeCompare(b.name,"ko") || a.club_id.localeCompare(b.club_id));
          let rank = 0;
          return { data: rows.map((row,index) => { if (!index || rows[index-1].visitor_count !== row.visitor_count) rank++; return { ...row, rank: row.visitor_count ? rank : null }; }), error: null };
        }
        if (name === "get_student_stamps") {
          const rawId = String(args.p_student_id || "").replace(/^STAMP:/i, "").split("@")[0].trim();
          const email = `${rawId}@festival.com`;
          const myStamps = state.stamps.filter(s => s.student_id === email || s.student_id === rawId).map(s => ({ club_id: s.club_id }));
          return { data: myStamps, error: null };
        }
        if (name === "register_student") {
          const rawId = String(args.p_student_id || "").replace(/^STAMP:/i, "").split("@")[0].trim();
          const email = `${rawId}@festival.com`;
          const name = args.p_name || "참가자";
          const existing = state.users.find(u => u.student_id === email);
          if (!existing) state.users.push({ student_id: email, name, role: "L1", is_approved: true });
          return { data: { success: true, student_id: rawId, name }, error: null };
        }
        if (name === "booth_grant_stamp") {
          const rawId = String(args.p_student_id || "").replace(/^STAMP:/i, "").split("@")[0].trim();
          const email = `${rawId}@festival.com`;
          const boothId = state.session?.user?.email?.includes("@") ? state.session.user.email.split("@")[0] : "club-code";
          const studentObj = state.users.find(u => u.student_id === email || u.student_id === rawId) || { name: "참가자" };
          
          const already = state.stamps.some(s => (s.student_id === email || s.student_id === rawId) && s.club_id === boothId);
          const total = state.stamps.filter(s => s.student_id === email || s.student_id === rawId).length;

          if (already) {
            return {
              data: {
                status: "ALREADY_STAMPED",
                message: "이미 도장을 받은 학생입니다.",
                student_id: rawId,
                student_name: studentObj.name,
                club_id: boothId,
                total_stamps: total
              },
              error: null
            };
          }

          const record = { id: state.stamps.length + 1, club_id: boothId, student_id: email, created_at: new Date().toISOString() };
          state.stamps.push(record);
          emit("stamps", record);
          const log = { ...record, id: state.stamp_logs.length + 1, status: "SUCCESS" };
          state.stamp_logs.push(log);
          emit("stamp_logs", log);

          return {
            data: {
              status: "SUCCESS",
              message: "스탬프 적립 성공",
              student_id: rawId,
              student_name: studentObj.name,
              club_id: boothId,
              total_stamps: total + 1
            },
            error: null
          };
        }
        if (name === "check_otp_and_stamp") {
          const code = state.codeResult || (args.p_input_otp === "654321" ? "ERROR_EXPIRED_CODE" : "SUCCESS");
          if (code === "SUCCESS") {
            const record = { id: state.stamps.length + 1, club_id: args.p_club_id, student_id: state.session.user.email, created_at: new Date().toISOString() };
            state.stamps.push(record); emit("stamps", record);
            const log = { ...record, id: state.stamp_logs.length + 1, status: "SUCCESS" };
            state.stamp_logs.push(log); emit("stamp_logs", log);
          }
          return { data: code, error: null };
        }
        const rows = ranking();
        return { data: name === "get_my_rank" ? rows.filter(row => row.email === state.session?.user?.email) : rows.slice(0, args?.p_limit || 20), error: null };
      },
      channel(name) {
        const channel = { name, events: [], on(type, filter, callback) { this.events.push({ filter, callback }); return this; }, subscribe() { state.channels.push(this); return this; } };
        return channel;
      },
      removeChannel(channel) { state.channels = state.channels.filter(item => item !== channel); return Promise.resolve(); },
    };
    win.Html5Qrcode = class {
      constructor(id) { this.id = id; this.isScanning = false; }
      async start(config, settings, callback) {
        this.callback = callback; state.camera = this;
        const node = win.document.getElementById(this.id), video = win.document.createElement("video");
        this.video = video; Object.defineProperty(video, "srcObject", { configurable: true, writable: true, value: { getTracks: () => [{ stop() { state.cameraStops++; } }] } }); node.append(video);
        if (state.gates.camera) await state.gates.camera;
        this.isScanning = true;
      }
      async stop() { this.isScanning = false; this.video.srcObject.getTracks().forEach(track => track.stop()); }
      clear() { this.video?.remove(); }
    };
    if (options.stubQr) {
      win.QRCode = function (node, data) { state.qrPayload = data.text; node.textContent = "fixture QR"; };
      win.QRCode.CorrectLevel = { H: 2 };
    }
    if (!win.matchMedia) win.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    if (!win.crypto.randomUUID) win.crypto.randomUUID = () => "fixture-session-uuid";
    if (!win.crypto.getRandomValues) win.crypto.getRandomValues = array => (array[0] = 12345, array);
    try { Object.defineProperty(win.navigator, "serviceWorker", { configurable: true, value: { register: () => Promise.resolve({}) } }); } catch (_) {}
    state.emit = emit;
    win.__fixture = state;
    return state;
  }
  if (typeof module !== "undefined") module.exports = install;
  else install(window, { reviewTies: new URLSearchParams(window.location.search).get("example") === "ties" });
})();
