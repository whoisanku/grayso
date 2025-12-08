// src/view/components/desktop/DesktopRightNav.tsx
// Fixed-position right sidebar for desktop web, inspired by Bluesky

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';

import {
  useLayoutBreakpoints,
  RIGHT_NAV_WIDTH,
  RIGHT_NAV_NARROW_WIDTH,
  CENTER_COLUMN_OFFSET,
} from '../../../alf/breakpoints';

export function DesktopRightNav() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const { rightNavVisible, centerColumnOffset } = useLayoutBreakpoints();

  if (!rightNavVisible) {
    return null;
  }

  const width = centerColumnOffset ? RIGHT_NAV_NARROW_WIDTH : RIGHT_NAV_WIDTH;
  const translateX = 300 + (centerColumnOffset ? CENTER_COLUMN_OFFSET : 0);

  return (
    <View
      style={[
        styles.container,
        {
          width: width + 16,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 16,
          // Left border/divider like Bluesky
          borderLeftWidth: 1,
          borderLeftColor: isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.25)',
          transform: [
            { translateX: translateX },
          ],
        },
      ]}
    >
      {/* Placeholder content - can be expanded with search, trending, etc. */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : 'rgba(241, 245, 249, 0.8)',
            borderColor: isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(203, 213, 225, 0.5)',
          },
        ]}
      >
        <Text
          style={[
            styles.cardTitle,
            { color: isDark ? '#e2e8f0' : '#0f172a' },
          ]}
        >
          Welcome to Grayso
        </Text>
        <Text
          style={[
            styles.cardDescription,
            { color: isDark ? '#94a3b8' : '#64748b' },
          ]}
        >
          Your decentralized messaging platform powered by DeSo.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute' as const,
    top: 0,
    left: '50%' as unknown as number,
    height: '100%',
    paddingHorizontal: 16,
    gap: 16,
    zIndex: 10,
    ...(Platform.OS === 'web' && {
      position: 'fixed',
      maxHeight: '100vh',
      overflowY: 'auto',
    }),
  } as any,
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
});
