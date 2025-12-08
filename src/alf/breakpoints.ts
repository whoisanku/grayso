// src/alf/breakpoints.ts
// Responsive breakpoints for desktop layout, inspired by Bluesky's implementation

import { useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

export type Breakpoint = 'gtPhone' | 'gtMobile' | 'gtTablet';

/**
 * General purpose breakpoints
 */
export function useBreakpoints(): Record<Breakpoint, boolean> & {
  activeBreakpoint: Breakpoint | undefined;
} {
  const { width } = useWindowDimensions();

  return useMemo(() => {
    const gtPhone = width >= 500;
    const gtMobile = width >= 800;
    const gtTablet = width >= 1300;

    let active: Breakpoint | undefined;
    if (gtTablet) {
      active = 'gtTablet';
    } else if (gtMobile) {
      active = 'gtMobile';
    } else if (gtPhone) {
      active = 'gtPhone';
    }

    return {
      activeBreakpoint: active,
      gtPhone,
      gtMobile,
      gtTablet,
    };
  }, [width]);
}

/**
 * Fine-tuned breakpoints for the shell layout (desktop sidebars)
 */
export function useLayoutBreakpoints() {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';

  return useMemo(() => {
    // Only apply desktop layout on web
    if (!isWeb) {
      return {
        isDesktop: false,
        rightNavVisible: false,
        centerColumnOffset: false,
        leftNavMinimal: false,
      };
    }

    const isDesktop = width >= 1024;
    const rightNavVisible = width >= 1100;
    const centerColumnOffset = width >= 1100 && width < 1300;
    const leftNavMinimal = width < 1300;

    return {
      isDesktop,
      rightNavVisible,
      centerColumnOffset,
      leftNavMinimal,
    };
  }, [width, isWeb]);
}

// Layout constants
export const CENTER_COLUMN_OFFSET = -50; // Shift center column left when right nav visible
export const SCROLLBAR_OFFSET = 6; // Account for scrollbar
export const LEFT_NAV_WIDTH = 240;
export const LEFT_NAV_MINIMAL_WIDTH = 86;
export const CENTER_CONTENT_MAX_WIDTH = 600;
export const RIGHT_NAV_WIDTH = 300;
export const RIGHT_NAV_NARROW_WIDTH = 250;
