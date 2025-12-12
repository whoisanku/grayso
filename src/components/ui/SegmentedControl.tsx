import React, { useState } from 'react';
import { View, Pressable, Text, Platform } from 'react-native';
import { useColorScheme } from 'nativewind';

export type SegmentedControlItem<T extends string> = {
  label: string;
  value: T;
  icon?: React.ReactNode;
};

type SegmentedControlProps<T extends string> = {
  items: SegmentedControlItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
};

export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  label,
}: SegmentedControlProps<T>) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="radiogroup"
      className="flex-row w-full relative overflow-hidden"
      style={{
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : 'rgba(248, 250, 252, 1)',
        borderRadius: 12,
        padding: 3,
        gap: 4,
        ...Platform.select({
          web: {
            // @ts-ignore - web-only CSS
            transition: 'background-color 0.3s ease-in-out',
          },
        }),
      }}
    >
      {items.map((item) => {
        const isActive = value === item.value;
        return (
          <SegmentedControlItem
            key={item.value}
            item={item}
            isActive={isActive}
            onPress={() => onChange(item.value)}
            isDark={isDark}
          />
        );
      })}
    </View>
  );
}

type SegmentedControlItemProps<T extends string> = {
  item: SegmentedControlItem<T>;
  isActive: boolean;
  onPress: () => void;
  isDark: boolean;
};

function SegmentedControlItem<T extends string>({
  item,
  isActive,
  onPress,
  isDark,
}: SegmentedControlItemProps<T>) {
  const [isPressed, setIsPressed] = useState(false);

  // Modern color palette
  const backgroundColor = isActive
    ? isDark
      ? 'rgba(51, 65, 85, 0.9)'
      : '#ffffff'
    : 'transparent';

  const textColor = isActive
    ? isDark
      ? '#f8fafc'
      : '#0f172a'
    : isDark
      ? '#94a3b8'
      : '#64748b';

  const getShadow = () => {
    if (!isActive) return {};
    
    return Platform.select({
      web: {
        // @ts-ignore
        boxShadow: isDark 
          ? '0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px -1px rgba(0, 0, 0, 0.3)'
          : '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: isDark ? 0.3 : 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: isActive ? 2 : 0,
      },
    });
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      accessibilityRole="radio"
      accessibilityState={{ selected: isActive }}
      className="flex-1"
      style={{
        borderRadius: 9,
        minHeight: 36,
        opacity: isPressed ? 0.8 : 1,
      }}
    >
      <View
        className="flex-1 justify-center items-center"
        style={{
          backgroundColor,
          borderRadius: 9,
          paddingVertical: 8,
          paddingHorizontal: 12,
          ...getShadow(),
          ...Platform.select({
            web: {
              // @ts-ignore - web-only CSS
              transition: 'background-color 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            },
          }),
        }}
      >
        <View className="flex-row items-center justify-center">
          {item.icon && <View className="mr-1.5">{item.icon}</View>}
          <Text
            className="text-[15px] text-center"
            style={{
              color: textColor,
              fontWeight: isActive ? '600' : '500',
              ...Platform.select({
                web: {
                  // @ts-ignore - web-only CSS
                  transition: 'color 0.25s cubic-bezier(0.4, 0, 0.2, 1), font-weight 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                },
              }),
            }}
          >
            {item.label}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
