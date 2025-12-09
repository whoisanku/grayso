import React, { useRef } from 'react';
import { View, Text, ActivityIndicator, Animated } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { Feather } from '@expo/vector-icons';

interface SwipeableChatItemProps {
  children: React.ReactNode;
  onSwipeAction: () => void;
  isLoading: boolean;
  actionType: 'spam' | 'inbox';
  accentColor: string;
  isDark: boolean;
  onSwipeBegin?: () => void;
  onSwipeEnd?: () => void;
}

export const SwipeableChatItem: React.FC<SwipeableChatItemProps> = ({
  children,
  onSwipeAction,
  isLoading,
  actionType,
  accentColor,
  isDark,
  onSwipeBegin,
  onSwipeEnd,
}) => {
  const swipeableRef = useRef<Swipeable>(null);

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const translateX = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [0, 100],
      extrapolate: 'clamp',
    });

    const backgroundColor = actionType === 'spam' ? '#ef4444' : accentColor;
    const icon = actionType === 'spam' ? 'trash-2' : 'inbox';
    const label = actionType === 'spam' ? 'Spam' : 'Inbox';

    return (
      <Animated.View
        style={{
          transform: [{ translateX }],
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <View
          style={{
            backgroundColor,
            justifyContent: 'center',
            alignItems: 'center',
            width: 100,
            height: '100%',
            paddingHorizontal: 16,
          }}
        >
          {isLoading ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <>
              <Feather name={icon} size={20} color="#ffffff" />
              <Text
                style={{
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: '600',
                  marginTop: 4,
                }}
              >
                {label}
              </Text>
            </>
          )}
        </View>
      </Animated.View>
    );
  };

  const handleSwipeOpen = () => {
    if (!isLoading) {
      onSwipeAction();
      // Close the swipeable after action
      setTimeout(() => {
        swipeableRef.current?.close();
        // Notify parent that swipe action completed
        onSwipeEnd?.();
      }, 300);
    }
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      onSwipeableOpen={handleSwipeOpen}
      onSwipeableWillOpen={() => onSwipeBegin?.()}
      onSwipeableClose={() => onSwipeEnd?.()}
      overshootRight={false}
      friction={2}
      rightThreshold={40}
      enabled={!isLoading}
    >
      {children}
    </Swipeable>
  );
};
