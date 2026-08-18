/**
 * Festival Stamp Tour - Theme Controller (Dark / Light Mode)
 * 로컬 스토리지 및 OS 설정을 기반으로 한 깜빡임 없는 다크모드 제어기
 */

// Tailwind CSS CDN 환경에서 다크모드 class 전략 활성화
if (typeof tailwind !== "undefined") {
  tailwind.config = {
    darkMode: "class",
    theme: {
      extend: {
        colors: {
          brand: {
            50: "#eef2ff",
            100: "#e0e7ff",
            500: "#6366f1",
            600: "#4f46e5",
            700: "#4338ca"
          }
        }
      }
    }
  };
}

(function () {
  function getPreferredTheme() {
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme === "light" || storedTheme === "dark") {
      return storedTheme;
    }
    // 기본은 축제 감성의 다크 테마를 권장하되 OS 설정 지원
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  function applyTheme(theme) {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
    updateThemeToggleIcons(theme);
  }

  // 최상단 즉시 실행 (깜빡임 방지)
  const initialTheme = getPreferredTheme();
  applyTheme(initialTheme);

  // 전역 토글 함수
  window.toggleTheme = function () {
    const currentTheme = document.documentElement.classList.contains("dark") ? "dark" : "light";
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
  };

  // UI 상의 테마 아이콘 업데이트
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

  // DOM 로드 완료 후 아이콘 싱크
  document.addEventListener("DOMContentLoaded", () => {
    const currentTheme = document.documentElement.classList.contains("dark") ? "dark" : "light";
    updateThemeToggleIcons(currentTheme);
  });

  // OS 테마 변경 실시간 감지
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    if (!localStorage.getItem("theme")) {
      applyTheme(e.matches ? "dark" : "light");
    }
  });
})();
