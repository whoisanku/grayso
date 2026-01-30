// src/view/components/desktop/DesktopShell.tsx
// Desktop shell wrapper that provides consistent layout with sidebars for all screens

import React from 'react';
import { View, Platform } from 'react-native';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLayoutBreakpoints, CENTER_CONTENT_MAX_WIDTH } from '@/alf/breakpoints';
import { DesktopLeftNav } from './DesktopLeftNav';
import { DesktopRightNav } from './DesktopRightNav';

interface DesktopShellProps {
  children: React.ReactNode;
  showSidebars?: boolean;
}

export function DesktopShell({ children, showSidebars = true }: DesktopShellProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const { isDesktop } = useLayoutBreakpoints();

  // Only apply desktop shell on web desktop
  if (!isDesktop || Platform.OS !== 'web') {
    return <>{children}</>;
  }

  return (
    <View className="flex-1" style={{ backgroundColor: isDark ? '#0a0f1a' : '#ffffff' }}>
      {/* Fixed Left Navigation */}
      {showSidebars && <DesktopLeftNav />}
      
      {/* Main Content Area - centered with borders */}
      <View className="flex-1 items-center">
        <View
          className="flex-1 w-full"
          style={{
            maxWidth: CENTER_CONTENT_MAX_WIDTH,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            borderLeftWidth: 1,
            borderRightWidth: 1,
            borderColor: isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.25)',
          }}
        >
          {children}
        </View>
      </View>

      {/* Fixed Right Navigation */}
      {showSidebars && <DesktopRightNav />}
    </View>
  );
}
