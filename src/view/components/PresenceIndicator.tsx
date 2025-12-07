import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
} from 'react-native-reanimated';
import { useColorScheme } from 'nativewind';

export type PresenceIndicatorProps = {
    isOnline: boolean;
    showLabel?: boolean;
    size?: 'small' | 'medium' | 'large';
};

const SIZE_MAP = {
    small: 8,
    medium: 10,
    large: 12,
};

export function PresenceIndicator({
    isOnline,
    showLabel = false,
    size = 'medium',
    isTyping = false,
    typingLabel,
}: PresenceIndicatorProps & { isTyping?: boolean; typingLabel?: string }) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const dotSize = SIZE_MAP[size];

    // Pulsing animation for online state
    const animatedStyle = useAnimatedStyle(() => {
        if (!isOnline) return { opacity: 1 };

        return {
            opacity: withRepeat(
                withSequence(
                    withTiming(1, { duration: 1000 }),
                    withTiming(0.5, { duration: 1000 })
                ),
                -1,
                true
            ),
        };
    });

    return (
        <View style={styles.container}>
            <Animated.View
                style={[
                    styles.dot,
                    {
                        width: dotSize,
                        height: dotSize,
                        borderRadius: dotSize / 2,
                        backgroundColor: isOnline ? '#10b981' : '#6b7280',
                    },
                    animatedStyle,
                ]}
            />
            {showLabel && (
                <Text
                    style={[
                        styles.label,
                        {
                            color: isTyping ? '#10b981' : (isDark ? '#9ca3af' : '#6b7280'),
                        },
                    ]}
                >
                    {isTyping ? (typingLabel || 'Typing...') : (isOnline ? 'Online' : 'Offline')}
                </Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    dot: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    label: {
        fontSize: 13,
        fontWeight: '500',
    },
});
