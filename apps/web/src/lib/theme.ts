export type Theme = "light" | "dark";

const themeStorageKey = "forage-theme";

export function getCurrentTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  return {
    isDarkTheme: theme === "dark",
    themeLabel: theme === "dark" ? "Dark" : "Light",
  };
}

export function toggleStoredTheme() {
  const nextTheme: Theme = getCurrentTheme() === "dark" ? "light" : "dark";
  localStorage.setItem(themeStorageKey, nextTheme);
  return applyTheme(nextTheme);
}
