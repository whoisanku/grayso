export type AccentId = "cobalt" | "violet" | "emerald" | "amber" | "rose";

export type AccentOption = {
  id: AccentId;
  label: string;
  description: string;
  primary: string;
  primaryStrong?: string;
  surfaceLight: string;
  surfaceDark: string;
  softLight: string;
  softDark: string;
  ring: string;
  onPrimary: string;
};

export const ACCENT_OPTIONS: AccentOption[] = [
  {
    id: "cobalt",
    label: "Cobalt",
    description: "Crisp, focused blues for a default messenger feel.",
    primary: "#2563eb",
    primaryStrong: "#1d4ed8",
    surfaceLight: "#e0e7ff",
    surfaceDark: "#0b1224",
    softLight: "rgba(37, 99, 235, 0.12)",
    softDark: "rgba(59, 130, 246, 0.16)",
    ring: "rgba(37, 99, 235, 0.4)",
    onPrimary: "#ffffff",
  },
  {
    id: "violet",
    label: "Violet",
    description: "Playful purple with a calm, premium vibe.",
    primary: "#7c3aed",
    primaryStrong: "#6d28d9",
    surfaceLight: "#ede9fe",
    surfaceDark: "#140b1f",
    softLight: "rgba(124, 58, 237, 0.12)",
    softDark: "rgba(167, 139, 250, 0.18)",
    ring: "rgba(124, 58, 237, 0.4)",
    onPrimary: "#ffffff",
  },
  {
    id: "emerald",
    label: "Emerald",
    description: "Fresh green that feels safe and optimistic.",
    primary: "#059669",
    primaryStrong: "#047857",
    surfaceLight: "#d1fae5",
    surfaceDark: "#061e16",
    softLight: "rgba(5, 150, 105, 0.12)",
    softDark: "rgba(52, 211, 153, 0.16)",
    ring: "rgba(5, 150, 105, 0.4)",
    onPrimary: "#ffffff",
  },
  {
    id: "amber",
    label: "Amber",
    description: "Warm amber for a friendly, high-energy tone.",
    primary: "#f59e0b",
    primaryStrong: "#d97706",
    surfaceLight: "#fef3c7",
    surfaceDark: "#251504",
    softLight: "rgba(245, 158, 11, 0.16)",
    softDark: "rgba(251, 191, 36, 0.2)",
    ring: "rgba(245, 158, 11, 0.4)",
    onPrimary: "#0f172a",
  },
  {
    id: "rose",
    label: "Rose",
    description: "Bold rose that reads personal and expressive.",
    primary: "#e11d48",
    primaryStrong: "#be123c",
    surfaceLight: "#ffe4e6",
    surfaceDark: "#2b0b12",
    softLight: "rgba(225, 29, 72, 0.14)",
    softDark: "rgba(244, 114, 182, 0.18)",
    ring: "rgba(225, 29, 72, 0.4)",
    onPrimary: "#ffffff",
  },
];

export const ACCENT_OPTION_MAP = ACCENT_OPTIONS.reduce<Record<AccentId, AccentOption>>(
  (acc, option) => {
    acc[option.id] = option;
    return acc;
  },
  {
    cobalt: ACCENT_OPTIONS[0],
    violet: ACCENT_OPTIONS[1],
    emerald: ACCENT_OPTIONS[2],
    amber: ACCENT_OPTIONS[3],
    rose: ACCENT_OPTIONS[4],
  } as Record<AccentId, AccentOption>
);

export const DEFAULT_ACCENT_ID: AccentId = "cobalt";
