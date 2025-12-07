import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { ACCENT_OPTIONS, ACCENT_OPTION_MAP, AccentId, DEFAULT_ACCENT_ID, AccentOption } from "./accentOptions";

type ThemeContextValue = {
  accentId: AccentId;
  accent: AccentOption;
  setAccentId: (id: AccentId) => void;
  isHydrated: boolean;
};

const ACCENT_STORAGE_KEY = "app-theme-accent";

const AppThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const AppThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [accentId, setAccentIdState] = useState<AccentId>(DEFAULT_ACCENT_ID);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const loadAccent = async () => {
      try {
        if (Platform.OS === "web") {
          const stored = localStorage.getItem(ACCENT_STORAGE_KEY) as AccentId | null;
          if (stored && ACCENT_OPTION_MAP[stored]) {
            setAccentIdState(stored);
          }
        } else {
          const stored = await AsyncStorage.getItem(ACCENT_STORAGE_KEY);
          if (stored && ACCENT_OPTION_MAP[stored as AccentId]) {
            setAccentIdState(stored as AccentId);
          }
        }
      } catch (error) {
        console.warn("[AppThemeProvider] Failed to restore accent", error);
      } finally {
        setIsHydrated(true);
      }
    };

    loadAccent();
  }, []);

  const persistAccent = useCallback(async (id: AccentId) => {
    try {
      if (Platform.OS === "web") {
        localStorage.setItem(ACCENT_STORAGE_KEY, id);
      } else {
        await AsyncStorage.setItem(ACCENT_STORAGE_KEY, id);
      }
    } catch (error) {
      console.warn("[AppThemeProvider] Failed to persist accent", error);
    }
  }, []);

  const handleSetAccent = useCallback(
    (id: AccentId) => {
      if (!ACCENT_OPTION_MAP[id]) return;
      setAccentIdState(id);
      persistAccent(id);
    },
    [persistAccent]
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      accentId,
      accent: ACCENT_OPTION_MAP[accentId] ?? ACCENT_OPTION_MAP[DEFAULT_ACCENT_ID],
      setAccentId: handleSetAccent,
      isHydrated,
    }),
    [accentId, handleSetAccent, isHydrated]
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
};

export const useAppTheme = () => {
  const context = useContext(AppThemeContext);
  if (!context) {
    throw new Error("useAppTheme must be used within an AppThemeProvider");
  }
  return context;
};

export { ACCENT_OPTIONS };
