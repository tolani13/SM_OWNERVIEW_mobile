export type PrimaryThemeId = "coral" | "purple" | "teal";

export type PrimaryThemeOption = {
  id: PrimaryThemeId;
  label: string;
  previewColor: string;
  primaryHsl: string;
  ringHsl: string;
};

export const PRIMARY_THEME_STORAGE_KEY = "studio-maestro-primary-theme";
export const DEFAULT_PRIMARY_THEME_ID: PrimaryThemeId = "coral";

export const PRIMARY_THEME_OPTIONS: PrimaryThemeOption[] = [
  {
    id: "coral",
    label: "Coral",
    previewColor: "#FF9F7F",
    primaryHsl: "15 90% 70%",
    ringHsl: "15 90% 70%",
  },
  {
    id: "purple",
    label: "Purple",
    previewColor: "#8B5CF6",
    primaryHsl: "262 83% 64%",
    ringHsl: "262 83% 64%",
  },
  {
    id: "teal",
    label: "Dark Teal",
    previewColor: "#0F766E",
    primaryHsl: "176 77% 26%",
    ringHsl: "176 77% 26%",
  },
];

export function resolvePrimaryTheme(themeId: string | null | undefined): PrimaryThemeOption {
  return PRIMARY_THEME_OPTIONS.find((option) => option.id === themeId) ?? PRIMARY_THEME_OPTIONS[0];
}

export function getStoredPrimaryThemeId(): PrimaryThemeId {
  if (typeof window === "undefined") {
    return DEFAULT_PRIMARY_THEME_ID;
  }

  const saved = window.localStorage.getItem(PRIMARY_THEME_STORAGE_KEY);
  return resolvePrimaryTheme(saved).id;
}

export function applyPrimaryTheme(themeId: PrimaryThemeId) {
  if (typeof document === "undefined") {
    return;
  }

  const theme = resolvePrimaryTheme(themeId);
  const root = document.documentElement;
  root.style.setProperty("--primary", theme.primaryHsl);
  root.style.setProperty("--ring", theme.ringHsl);
  root.style.setProperty("--chart-1", theme.primaryHsl);
  root.style.setProperty("--color-coral", `hsl(${theme.primaryHsl})`);
}

export function persistPrimaryTheme(themeId: PrimaryThemeId) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PRIMARY_THEME_STORAGE_KEY, themeId);
}
