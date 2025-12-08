import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useColorScheme as useSystemColorScheme, Platform } from 'react-native';
import { useColorScheme as useNativeWindColorScheme } from 'nativewind';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ColorMode = 'system' | 'light' | 'dark';

type AppearanceContextValue = {
  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;
  effectiveColorScheme: 'light' | 'dark';
};

const APPEARANCE_STORAGE_KEY = 'app-appearance-mode';

const AppearanceContext = createContext<AppearanceContextValue | undefined>(undefined);

export const AppearanceProvider = ({ children }: { children: React.ReactNode }) => {
  const { setColorScheme } = useNativeWindColorScheme();
  // Use React Native's useColorScheme hook - it automatically updates when system appearance changes
  const systemColorScheme = useSystemColorScheme();
  const [colorMode, setColorModeState] = useState<ColorMode>('system');

  // Calculate effective color scheme based on mode and system preference
  const effectiveColorScheme: 'light' | 'dark' = useMemo(() => {
    if (colorMode === 'system') {
      // Use system preference, default to light if null
      return systemColorScheme === 'dark' ? 'dark' : 'light';
    }
    return colorMode;
  }, [colorMode, systemColorScheme]);

  // Load saved appearance mode on mount
  useEffect(() => {
    const loadAppearance = async () => {
      try {
        let stored: ColorMode | null = null;
        if (Platform.OS === 'web') {
          stored = localStorage.getItem(APPEARANCE_STORAGE_KEY) as ColorMode | null;
        } else {
          stored = (await AsyncStorage.getItem(APPEARANCE_STORAGE_KEY)) as ColorMode | null;
        }
        
        if (stored && ['system', 'light', 'dark'].includes(stored)) {
          setColorModeState(stored);
        }
      } catch (error) {
        console.warn('[AppearanceProvider] Failed to restore appearance mode', error);
      }
    };

    loadAppearance();
  }, []);

  // Update NativeWind color scheme when effective scheme changes
  useEffect(() => {
    setColorScheme(effectiveColorScheme);
    
    // For web, update DOM class
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.classList.remove('dark', 'light');
      document.documentElement.classList.add(effectiveColorScheme);
    }
  }, [effectiveColorScheme, setColorScheme]);

  const handleSetColorMode = useCallback(async (mode: ColorMode) => {
    setColorModeState(mode);
    
    // Persist to storage
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(APPEARANCE_STORAGE_KEY, mode);
        // Also keep the old colorScheme key for backward compatibility on web
        const effectiveScheme = mode === 'system' 
          ? (systemColorScheme === 'dark' ? 'dark' : 'light')
          : mode;
        localStorage.setItem('colorScheme', effectiveScheme);
      } else {
        await AsyncStorage.setItem(APPEARANCE_STORAGE_KEY, mode);
      }
    } catch (error) {
      console.warn('[AppearanceProvider] Failed to persist appearance mode', error);
    }
  }, [systemColorScheme]);

  const value = useMemo<AppearanceContextValue>(
    () => ({
      colorMode,
      setColorMode: handleSetColorMode,
      effectiveColorScheme,
    }),
    [colorMode, handleSetColorMode, effectiveColorScheme]
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
};

export const useAppearance = () => {
  const context = useContext(AppearanceContext);
  if (!context) {
    throw new Error('useAppearance must be used within an AppearanceProvider');
  }
  return context;
};
