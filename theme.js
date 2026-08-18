/**
 * Festival Stamp Tour - Theme Controller (Dark / Light Mode)
 * 깜빡임 없는 다크 / 라이트 모드 전환 및 로컬스토리지 동기화 모듈
 */

(function () {
  function getPreferredTheme() {
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme === "light" || storedTheme === "dark") {
      return storedTheme;
    }
    // 기본은 다크 모드 권장
    return "dark";
  }

  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.remove("dark");
      root.classList.add("light");
    }
    localStorage.setItem("theme", theme);
    updateThemeToggleIcons(theme);
  }

  // 1. 최상단 즉시 실행 (FOUC 초기 깜빡임 방지)
  const initialTheme = getPreferredTheme();
  applyTheme(initialTheme);

  // 2. 전역 테마 토글 함수 (HTML onclick="toggleTheme()"에서 호출)
  window.toggleTheme = function () {
    const isDark = document.documentElement.classList.contains("dark");
    const nextTheme = isDark ? "light" : "dark";
    applyTheme(nextTheme);
  };

  // 3. UI 상의 모든 테마 전환 버튼 아이콘(해/달) 동기화
  function updateThemeToggleIcons(theme) {
    document.querySelectorAll("[data-theme-icon]").forEach((el) => {
      if (theme === "dark") {
        el.setAttribute("data-lucide", "sun");
      } else {
        el.setAttribute("data-lucide", "moon");
      }
    });
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }

  // 4. DOM 로드 완료 후 아이콘 확정 동기화
  document.addEventListener("DOMContentLoaded", () => {
    const currentTheme = getPreferredTheme();
    applyTheme(currentTheme);
  });

  // 5. OS 시스템 테마 변경 감지 (사용자 수동 변경 없을 시)
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    if (!localStorage.getItem("theme")) {
      applyTheme(e.matches ? "dark" : "light");
    }
  });
})();
