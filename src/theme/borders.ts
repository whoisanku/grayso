/**
 * Border Theme System
 * Inspired by Bluesky's design system for consistent, professional borders
 */

export const BorderColors = {
  light: {
    // Primary borders - main UI dividers (Bluesky-style)
    contrast_low: 'rgba(148, 163, 184, 0.25)', // slate-400 at 25%
    contrast_medium: 'rgba(148, 163, 184, 0.4)', // slate-400 at 40%
    contrast_high: 'rgba(148, 163, 184, 0.6)', // slate-400 at 60%
    
    // Subtle borders - for cards and containers
    subtle: 'rgba(203, 213, 225, 0.5)', // slate-300 at 50%
    subtle_strong: 'rgba(203, 213, 225, 0.8)', // slate-300 at 80%
    
    // Input/Interactive borders
    input: 'rgba(148, 163, 184, 0.3)',
    input_hover: 'rgba(148, 163, 184, 0.5)',
    input_focus: 'rgba(99, 102, 241, 0.5)', // indigo
    
    // Divider borders - between sections
    divider: 'rgba(226, 232, 240, 0.8)', // slate-200 at 80%
    divider_strong: 'rgba(203, 213, 225, 1)', // slate-300
    
    // Special states
    error: 'rgba(239, 68, 68, 0.3)', // red-500 at 30%
    warning: 'rgba(245, 158, 11, 0.3)', // amber-500 at 30%
    success: 'rgba(34, 197, 94, 0.3)', // green-500 at 30%
  },
  dark: {
    // Primary borders - main UI dividers (Bluesky-style)
    contrast_low: 'rgba(148, 163, 184, 0.15)', // slate-400 at 15%
    contrast_medium: 'rgba(148, 163, 184, 0.25)', // slate-400 at 25%
    contrast_high: 'rgba(148, 163, 184, 0.4)', // slate-400 at 40%
    
    // Subtle borders - for cards and containers
    subtle: 'rgba(71, 85, 105, 0.3)', // slate-600 at 30%
    subtle_strong: 'rgba(71, 85, 105, 0.5)', // slate-600 at 50%
    
    // Input/Interactive borders
    input: 'rgba(148, 163, 184, 0.2)',
    input_hover: 'rgba(148, 163, 184, 0.35)',
    input_focus: 'rgba(99, 102, 241, 0.4)', // indigo
    
    // Divider borders - between sections
    divider: 'rgba(51, 65, 85, 0.5)', // slate-700 at 50%
    divider_strong: 'rgba(71, 85, 105, 0.8)', // slate-600 at 80%
    
    // Special states
    error: 'rgba(239, 68, 68, 0.4)', // red-500 at 40%
    warning: 'rgba(245, 158, 11, 0.4)', // amber-500 at 40%
    success: 'rgba(34, 197, 94, 0.4)', // green-500 at 40%
  },
};

export const BorderWidths = {
  hairline: 0.5,
  thin: 1,
  medium: 1.5,
  thick: 2,
  heavy: 3,
};

/**
 * Get border color for current theme
 */
export function getBorderColor(
  isDark: boolean,
  type: keyof typeof BorderColors.light = 'contrast_low'
): string {
  return isDark ? BorderColors.dark[type] : BorderColors.light[type];
}

/**
 * Get border style object
 */
export function getBorderStyle(
  isDark: boolean,
  type: keyof typeof BorderColors.light = 'contrast_low',
  width: keyof typeof BorderWidths = 'thin',
  side?: 'top' | 'right' | 'bottom' | 'left'
) {
  const borderColor = getBorderColor(isDark, type);
  const borderWidth = BorderWidths[width];

  if (side) {
    return {
      [`border${side.charAt(0).toUpperCase()}${side.slice(1)}Width`]: borderWidth,
      [`border${side.charAt(0).toUpperCase()}${side.slice(1)}Color`]: borderColor,
    };
  }

  return {
    borderWidth,
    borderColor,
  };
}

/**
 * Tailwind CSS class name helper for borders
 */
export function getBorderClassName(
  type: 'divider' | 'subtle' | 'contrast' = 'divider'
): string {
  switch (type) {
    case 'divider':
      return 'border-slate-200 dark:border-slate-700';
    case 'subtle':
      return 'border-slate-300/50 dark:border-slate-600/30';
    case 'contrast':
      return 'border-slate-400/25 dark:border-slate-400/15';
    default:
      return 'border-slate-200 dark:border-slate-700';
  }
}
