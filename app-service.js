/* Existing Supabase contracts, shared by the C sticker-book presentation. */
(() => {
  "use strict";
  const client = () => {
    if (!window.supabase?.auth) throw new Error("서버 연결을 준비하지 못했어요. 연결을 확인하고 다시 시도해 주세요.");
    return window.supabase;
  };
  const result = (response, message) => {
    if (response.error) throw new Error(message);
    return response;
  };
  const clearStaffStorage = () => {
    sessionStorage.removeItem("session_token");
    localStorage.removeItem("current_session_token");
  };
  const profileFields = "role, is_approved, club_id, active_session_id";

  async function session() {
    return result(await client().auth.getSession(), "로그인 정보를 확인하지 못했어요.").data.session;
  }
  async function profile() {
    const current = await session();
    if (!current?.user?.email) return null;
    const response = result(await client().from("users").select(profileFields).eq("student_id", current.user.email).single(), "사용자 권한을 확인하지 못했어요.");
    return { ...response.data, email: current.user.email };
  }
  function savedStudent() {
    try {
      const saved = JSON.parse(localStorage.getItem("student_session") || "null");
      return saved && /^\d{5}$/.test(saved.id) && typeof saved.name === "string" && saved.name.trim() ? saved : null;
    } catch (_) { return null; }
  }
  async function studentLogin(student, restore = false) {
    const email = `${student.id}@festival.com`;
    // 1. 우리 우선: 초경량 register_student RPC 시도 (Auth 레이트 리밋 방지 및 세션 충돌 원천 차단)
    try {
      const regRes = await client().rpc("register_student", {
        p_student_id: student.id,
        p_name: student.name
      });
      if (!regRes.error && regRes.data?.success) {
        return; // RPC 등록 성공 시 즉시 완료
      }
    } catch (_) {
      // RPC 미설치 시 기존 Auth 가입 폴백
    }

    const current = await session();
    if (restore && current?.user?.email === email) return;
    if (current && current.user.email !== email) await client().auth.signOut();
    // Keep the original virtual-email and password derivation contract.
    const credentials = { email, password: btoa(encodeURIComponent(`${student.id}_${student.name}`)) };
    const signedIn = await client().auth.signInWithPassword(credentials);
    if (signedIn.error) {
      result(await client().auth.signUp({ ...credentials, options: { data: { student_id: student.id, name: student.name, role: "L1" } } }), "학생 인증에 실패했어요. 학번과 이름을 확인해 주세요.");
    }
    result(await client().from("users").upsert({ student_id: email, name: student.name, role: "L1", is_approved: true }, { onConflict: "student_id" }), "학생 정보를 저장하지 못했어요.");
  }
  async function clubs() {
    const response = result(await client().from("clubs").select("club_id, name, location"), "부스 목록을 불러오지 못했어요.");
    return (response.data || []).map(booth => {
      const text = `${booth.club_id} ${booth.name}`;
      const icon = /코딩|컴퓨터|CODE|DEV/i.test(text) ? "code-xml" : /밴드|음악|MUSIC/i.test(text) ? "guitar" : /사진|PHOTO/i.test(text) ? "camera" : /과학|SCIENCE/i.test(text) ? "flask-conical" : /미술|ART/i.test(text) ? "palette" : /게임|GAME/i.test(text) ? "dices" : /요리|FOOD/i.test(text) ? "soup" : "compass";
      return { id: booth.club_id, name: booth.name, location: booth.location || "", icon };
    });
  }
  async function studentStamps(id) {
    // 1. 우리 우선: get_student_stamps RPC 시도
    try {
      const rpcRes = await client().rpc("get_student_stamps", { p_student_id: id });
      if (!rpcRes.error && rpcRes.data) {
        return rpcRes.data;
      }
    } catch (_) {}
    return result(await client().from("stamps").select("club_id").eq("student_id", `${id}@festival.com`), "도장판을 불러오지 못했어요.").data || [];
  }
  async function verifyStamp(boothId, code) {
    return result(await client().rpc("check_otp_and_stamp", { p_club_id: boothId, p_input_otp: code }), "서버와 연결하지 못했어요. 도장판을 다시 확인해 주세요.").data;
  }
  async function grantStamp(studentId) {
    // 부스 운영진이 학생 QR(학번)을 스캔/입력하여 스탬프를 즉시 지급하는 핵심 RPC
    const response = await client().rpc("booth_grant_stamp", { p_student_id: studentId });
    if (response.error) throw new Error(response.error.message || "서버 통신 장애가 발생했어요.");
    return response.data;
  }
  async function recentBoothVisitors(boothId) {
    const response = await client()
      .from("stamps")
      .select("student_id, created_at")
      .eq("club_id", boothId)
      .order("created_at", { ascending: false })
      .limit(5);
    if (response.error || !response.data) return [];
    
    // 학생 실명 매핑
    const emails = response.data.map(s => s.student_id);
    const usersRes = await client().from("users").select("student_id, name").in("student_id", emails);
    const nameMap = new Map();
    if (usersRes.data) {
      usersRes.data.forEach(u => nameMap.set(u.student_id, u.name));
    }
    return response.data.map(s => {
      const rawId = s.student_id.split("@")[0];
      return {
        id: rawId,
        name: nameMap.get(s.student_id) || nameMap.get(rawId) || "참가자",
        time: s.created_at
      };
    });
  }
  async function studentRanking(studentId = null) {
    const [mine, top, podium] = await Promise.all([
      client().rpc("get_my_rank", { p_student_id: studentId }),
      client().rpc("get_stamp_leaderboard", { p_limit: 20 }),
      client().rpc("get_stamp_podium"),
    ]);
    result(top, "랭킹을 불러오지 못했어요.");
    return {
      mine: mine.error ? null : mine.data?.[0] || null, top: top.data || [],
      podium: podium.error ? [] : podium.data || [],
      podiumError: podium.error ? "공동 순위 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요." : "",
    };
  }
  async function clubRanking() {
    const response = result(await client().rpc("get_club_leaderboard"), "동아리 랭킹을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    return (response.data || []).map(row => ({
      id: row.club_id, name: row.name, location: row.location || "",
      count: Number(row.visitor_count), rank: row.rank == null ? null : Number(row.rank),
    }));
  }
  async function staffLogin(role, boothId, password) {
    const email = role === "L3" ? "admin@festival.com" : `${boothId}@festival.com`;
    result(await client().auth.signInWithPassword({ email, password }), "비밀번호를 확인해 주세요.");
    try {
      const current = await profile();
      // Retain the original L2 activation flow; failed updates do not grant access.
      if (current?.role === "L2" && !current.is_approved) {
        result(await client().from("users").update({ is_approved: true }).eq("student_id", email), "부스 계정을 활성화하지 못했어요.");
        current.is_approved = true;
      }
      if (!current?.is_approved || current.role !== role || (role === "L2" && current.club_id !== boothId)) throw new Error("선택한 역할 또는 부스에 접근할 수 없는 계정이에요.");
      const token = crypto.randomUUID();
      result(await client().from("users").update({ active_session_id: token }).eq("student_id", email), "로그인 세션을 시작하지 못했어요. 다시 시도해 주세요.");
      localStorage.setItem("current_session_token", token);
      sessionStorage.setItem("session_token", JSON.stringify({ role, boothId: current.club_id, sessionId: token, authTime: Date.now() }));
      return { ...current, active_session_id: token };
    } catch (error) {
      await client().auth.signOut();
      clearStaffStorage();
      throw error;
    }
  }
  function staffRoute(current) {
    return current.role === "L3" ? "admin.html" : `booth.html?boothId=${encodeURIComponent(current.club_id)}`;
  }
  async function restoreStaff() {
    let token;
    try { token = JSON.parse(sessionStorage.getItem("session_token") || "null"); } catch (_) {}
    const local = localStorage.getItem("current_session_token");
    if (!token || !local) return null;
    if (Date.now() - token.authTime >= 12 * 60 * 60 * 1000) { clearStaffStorage(); return null; }
    const current = await profile();
    if (!current?.is_approved || !["L2", "L3"].includes(current.role) || current.active_session_id !== local) {
      await logout();
      return null;
    }
    return current;
  }
  async function staffAccess(role, boothId) {
    const current = await profile();
    if (!current) return null;
    const local = localStorage.getItem("current_session_token");
    if (!current.is_approved || current.role !== role || (role === "L2" && current.club_id !== boothId) || (local && current.active_session_id && current.active_session_id !== local)) {
      const error = new Error("로그인 권한이 만료됐어요. 운영진 계정으로 다시 로그인해 주세요.");
      error.code = "ACCESS_DENIED";
      throw error;
    }
    return current;
  }
  function watchStaff(current, onExpired) {
    const local = localStorage.getItem("current_session_token");
    let disposed = false, checking = false;
    const check = record => {
      const changed = record && ((record.active_session_id && record.active_session_id !== local) || (record.role && record.role !== current.role) || record.is_approved === false || (current.role === "L2" && "club_id" in record && record.club_id !== current.club_id));
      if (!disposed && changed) {
        disposed = true;
        onExpired();
      }
    };
    const channel = client().channel(`session-${current.email}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "users", filter: `student_id=eq.${current.email}` }, payload => check(payload.new)).subscribe();
    const timer = setInterval(async () => {
      if (disposed || checking) return;
      checking = true;
      try {
        const response = await client().from("users").select("active_session_id").eq("student_id", current.email).single();
        if (!response.error) check(response.data);
      } catch (_) { /* A temporary connection failure is not a session revocation. */ }
      finally { checking = false; }
    }, 15000);
    return () => { disposed = true; clearInterval(timer); client().removeChannel(channel); };
  }
  async function logout() {
    result(await client().auth.signOut(), "로그아웃하지 못했어요. 다시 시도해 주세요.");
    clearStaffStorage();
  }
  async function issueCode(boothId) {
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const code = String(100000 + random[0] % 900000);
    const expires = new Date(Date.now() + 60000).toISOString();
    const response = result(await client().from("clubs_status").upsert({ club_id: boothId, current_otp: code, otp_expires_at: expires, last_login_at: new Date().toISOString() }, { onConflict: "club_id" }).select("current_otp, otp_expires_at").single(), "코드를 발급하지 못했어요. 다시 시도해 주세요.");
    return { code: response.data.current_otp, expires: Date.parse(response.data.otp_expires_at), payload: btoa(`${boothId}:${response.data.current_otp}`) };
  }
  async function visitors(boothId) {
    return result(await client().from("stamps").select("*", { count: "exact", head: true }).eq("club_id", boothId), "적립 학생 수를 불러오지 못했어요.").count || 0;
  }
  function watchBooth(boothId, onStamp) {
    const channel = client().channel(`booth-${boothId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "stamps", filter: `club_id=eq.${boothId}` }, onStamp).subscribe();
    return () => client().removeChannel(channel);
  }
  async function allRows(table, columns, order, filter) {
    const rows = [], size = 1000;
    for (let offset = 0; ; offset += size) {
      let query = client().from(table).select(columns).order(order).range(offset, offset + size - 1);
      if (filter) query = query.eq(filter[0], filter[1]);
      const page = result(await query, "전체 행사 데이터를 불러오지 못했어요.").data || [];
      rows.push(...page);
      if (page.length < size) return rows;
    }
  }
  async function metrics() {
    const [stamps, failed] = await Promise.all([
      allRows("stamps", "club_id, student_id", "id"),
      client().from("stamp_logs").select("*", { count: "exact", head: true }).neq("status", "SUCCESS"),
    ]);
    result(failed, "인증 실패 기록 수를 불러오지 못했어요.");
    const counts = new Map(), people = new Set();
    stamps.forEach(stamp => { people.add(stamp.student_id); counts.set(stamp.club_id, (counts.get(stamp.club_id) || 0) + 1); });
    return { stamps: stamps.length, participants: people.size, counts, failed: failed.count || 0 };
  }
  async function adminRanking() {
    const [stamps, users] = await Promise.all([
      allRows("stamps", "student_id, created_at", "id"),
      allRows("users", "student_id, name", "student_id", ["role", "L1"]),
    ]);
    const names = new Map(users.map(user => [user.student_id, user.name])), grouped = new Map();
    for (const stamp of stamps) {
      const row = grouped.get(stamp.student_id) || { email: stamp.student_id, count: 0, lastTime: stamp.created_at };
      row.count++;
      if (Date.parse(stamp.created_at) > Date.parse(row.lastTime)) row.lastTime = stamp.created_at;
      grouped.set(stamp.student_id, row);
    }
    const rows = [...grouped.values()].sort((a, b) => b.count - a.count || Date.parse(a.lastTime) - Date.parse(b.lastTime));
    let rank = 0;
    return rows.map((row, index) => {
      const previous = rows[index - 1];
      if (!previous || previous.count !== row.count || Date.parse(previous.lastTime) !== Date.parse(row.lastTime)) rank++;
      const id = row.email.split("@")[0];
      return { ...row, id, name: names.get(row.email) || names.get(id) || "이름 미등록", rank, time: new Date(row.lastTime).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) };
    });
  }
  async function initialLogs() {
    return result(await client().from("stamp_logs").select("*").order("created_at", { ascending: false }).limit(20), "최근 인증 기록을 불러오지 못했어요.").data || [];
  }
  function watchAdmin(onStamp, onLog) {
    const channel = client().channel("admin-hub")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "stamps" }, onStamp)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "stamp_logs" }, payload => onLog(payload.new)).subscribe();
    return () => client().removeChannel(channel);
  }
  window.StampTourService = { savedStudent, studentLogin, clubs, studentStamps, verifyStamp, grantStamp, recentBoothVisitors, studentRanking, clubRanking, staffLogin, staffRoute, restoreStaff, staffAccess, watchStaff, logout, issueCode, visitors, watchBooth, metrics, adminRanking, initialLogs, watchAdmin };
})();
