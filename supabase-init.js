// Supabase 클라이언트 초기화 딱 한 번만 선언
const SUPABASE_URL = "https://qmcebhdmcsjdwvyuumcp.supabase.co/";
const SUPABASE_ANON_KEY = "sb_publishable_mKcWj5buZLsya7ObcKsC1A_LbDfH2xp";

if (typeof window.supabase === "undefined") {
  console.error("Supabase CDN 로드 실패!");
}
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
