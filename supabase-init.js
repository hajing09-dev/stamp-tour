// Supabase 클라이언트 초기화 (config.js 설정 우선 바인딩)
const DEFAULT_SUPABASE_URL = "https://ivhdgijhvvvdcxsfmlpd.supabase.co/";
const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_hMMfcKDUhJvNJzq5MFaA8A_u2tM7Nks";

const SUPABASE_URL = window.APP_CONFIG?.supabase?.url || DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY = window.APP_CONFIG?.supabase?.anonKey || DEFAULT_SUPABASE_ANON_KEY;

if (typeof window.supabase === "undefined" || typeof window.supabase.createClient !== "function") {
  console.error("Supabase CDN 로드 실패!");
} else {
  const _supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.supabase = _supabaseClient;
}
