import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Platform } from 'react-native';

interface TypingIndicatorProps {
  label?: string; // Kept for backwards compatibility but not used
  isDark?: boolean;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ 
  isDark = true 
}) => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createBounce = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: -4,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.delay(600 - delay),
        ])
      );
    };

    const animation = Animated.parallel([
      createBounce(dot1, 0),
      createBounce(dot2, 150),
      createBounce(dot3, 300),
    ]);

    animation.start();

    return () => animation.stop();
  }, [dot1, dot2, dot3]);

  // Chat bubble styling matching MessageBubble for received messages
  const bubbleBackgroundColor = isDark ? '#1e2738' : '#f8fafc';
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const dotColor = isDark ? '#94a3b8' : '#64748b';

  return (
    <View 
      style={[
        styles.bubble,
        {
          backgroundColor: bubbleBackgroundColor,
          borderColor: borderColor,
          // Match the dynamic border radius from MessageBubble (R=22)
          borderRadius: 22,
          // Add shadow like MessageBubble
          ...Platform.select({
            web: {
              boxShadow: isDark 
                ? '0 2px 8px rgba(0, 0, 0, 0.3)' 
                : '0 1px 4px rgba(0, 0, 0, 0.08)',
            } as any,
            default: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: isDark ? 0.2 : 0.05,
              shadowRadius: 2,
              elevation: 2,
            },
          }),
        }
      ]}
    >
      <View style={styles.dotsContainer}>
        <Animated.View
          style={[
            styles.dot,
            { backgroundColor: dotColor, transform: [{ translateY: dot1 }] },
          ]}
        />
        <Animated.View
          style={[
            styles.dot,
            { backgroundColor: dotColor, transform: [{ translateY: dot2 }] },
          ]}
        />
        <Animated.View
          style={[
            styles.dot,
            { backgroundColor: dotColor, transform: [{ translateY: dot3 }] },
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignSelf: 'flex-start',
    marginLeft: 16,
    marginBottom: 8,
    borderWidth: 0.5,
    maxWidth: Platform.OS === 'web' ? 320 : '80%',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 18,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 3,
  },
});

export default TypingIndicator;
