import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';

interface TypingIndicatorProps {
  label?: string;
  isDark?: boolean;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ 
  label = 'Typing...', 
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
            toValue: -6,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.delay(600 - delay), // Adjust to complete the cycle
        ])
      );
    };

    const animation1 = createBounce(dot1, 0);
    const animation2 = createBounce(dot2, 150);
    const animation3 = createBounce(dot3, 300);

    animation1.start();
    animation2.start();
    animation3.start();

    return () => {
      animation1.stop();
      animation2.stop();
      animation3.stop();
    };
  }, [dot1, dot2, dot3]);

  const dotColor = isDark ? '#94a3b8' : '#64748b'; // slate-400/500
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const bgColor = isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(241, 245, 249, 0.9)'; // slate-800/100

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
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
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginLeft: 16,
    marginBottom: 8,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
    height: 16,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginHorizontal: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});

export default TypingIndicator;
