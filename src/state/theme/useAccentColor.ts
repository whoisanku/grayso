import { useMemo } from "react";
import { useColorScheme } from "nativewind";
import { useAppTheme } from "./AppThemeProvider";
import { AccentOption } from "./accentOptions";

export type AccentColors = {
  accentColor: string;
  accentStrong: string;
  accentSurface: string;
  accentSoft: string;
  accentRing: string;
  onAccent: string;
};

const buildAccentColors = (accent: AccentOption, isDark: boolean): AccentColors => {
  return {
    accentColor: accent.primary,
    accentStrong: accent.primaryStrong ?? accent.primary,
    accentSurface: isDark ? accent.surfaceDark : accent.surfaceLight,
    accentSoft: isDark ? accent.softDark : accent.softLight,
    accentRing: accent.ring,
    onAccent: accent.onPrimary,
  };
};

export const useAccentColor = () => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { accent, accentId, setAccentId, isHydrated } = useAppTheme();

  const accentColors = useMemo(() => buildAccentColors(accent, isDark), [accent, isDark]);

  return {
    accentId,
    setAccentId,
    accent,
    isHydrated,
    isDark,
    ...accentColors,
  };
};
