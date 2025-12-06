// src/lib/styles.ts
import { TextStyle, ViewStyle, ImageStyle } from 'react-native';

// Helper for conditional classes (clsx-like)
export function cx(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

// Flatten style objects if needed (though NativeWind handles className)
export function flattenStyles(...styles: (ViewStyle | TextStyle | ImageStyle | undefined | null)[]) {
  return styles.filter(Boolean);
}
