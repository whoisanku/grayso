// src/alf/index.ts
// This file acts as an abstraction layer for fonts and styling, similar to Bluesky's ALF.
// We are using NativeWind, so this will mostly wrap Tailwind classes or expose theme constants.

import { useColorScheme } from 'nativewind';

export const useTheme = () => {
  const { colorScheme, setColorScheme } = useColorScheme();
  return {
    isDark: colorScheme === 'dark',
    toggleTheme: () => setColorScheme(colorScheme === 'dark' ? 'light' : 'dark'),
    setTheme: (theme: 'light' | 'dark' | 'system') => setColorScheme(theme),
  };
};

export const atoms = {
  // Layout
  flex1: 'flex-1',
  row: 'flex-row',
  col: 'flex-col',
  center: 'items-center justify-center',

  // Text
  textBody: 'text-base text-gray-900 dark:text-gray-100',
  textSubhead: 'text-sm text-gray-500 dark:text-gray-400',
  textBold: 'font-bold',

  // Backgrounds
  bgPrimary: 'bg-white dark:bg-black',
  bgSecondary: 'bg-gray-100 dark:bg-gray-900',
};
