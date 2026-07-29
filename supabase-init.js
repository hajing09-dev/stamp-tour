// Supabase 클라이언트 초기화 딱 한 번만 선언
const SUPABASE_URL = "https://ivhdgijhvvvdcxsfmlpd.supabase.co/";
const SUPABASE_ANON_KEY = "sb_publishable_hMMfcKDUhJvNJzq5MFaA8A_u2tM7Nks";

if (typeof window.supabase === "undefined" || typeof window.supabase.createClient !== "function") {
  console.error("Supabase CDN 로드 실패!");
} else {
  const _supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.supabase = _supabaseClient;
}
