import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { View, Pressable, Text, LayoutChangeEvent, Platform } from 'react-native';
import Animated, { LinearTransition, Easing } from 'react-native-reanimated';
import { useColorScheme } from 'nativewind';

type SegmentedControlContextValue<T> = {
  value: T;
  onChange: (value: T) => void;
};

const SegmentedControlContext = createContext<SegmentedControlContextValue<any> | null>(null);

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
  
  const [itemLayouts, setItemLayouts] = useState<{ x: number; width: number }[]>([]);
  const selectedIndex = items.findIndex(item => item.value === value);

  const handleLayout = useCallback((index: number, event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    setItemLayouts(prev => {
      const newLayouts = [...prev];
      newLayouts[index] = { x, width };
      return newLayouts;
    });
  }, []);

  const contextValue = useMemo(
    () => ({ value, onChange }),
    [value, onChange]
  );

  return (
    <SegmentedControlContext.Provider value={contextValue}>
      <View
        className="flex-row rounded-[14px] p-1 relative"
        style={{
          backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : 'rgba(241, 245, 249, 0.9)',
        }}
        accessibilityLabel={label}
        accessibilityRole="radiogroup"
      >
        {itemLayouts.length > 0 && selectedIndex >= 0 && itemLayouts[selectedIndex] && (
          <Slider x={itemLayouts[selectedIndex].x} width={itemLayouts[selectedIndex].width} isDark={isDark} />
        )}
        {items.map((item, index) => (
          <SegmentedControlItem
            key={item.value}
            item={item}
            index={index}
            onLayout={handleLayout}
          />
        ))}
      </View>
    </SegmentedControlContext.Provider>
  );
}

type SegmentedControlItemProps<T extends string> = {
  item: SegmentedControlItem<T>;
  index: number;
  onLayout: (index: number, event: LayoutChangeEvent) => void;
};

function SegmentedControlItem<T extends string>({
  item,
  index,
  onLayout,
}: SegmentedControlItemProps<T>) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const context = useContext(SegmentedControlContext);
  
  if (!context) {
    throw new Error('SegmentedControlItem must be used within SegmentedControl');
  }

  const { value, onChange } = context;
  const isSelected = value === item.value;

  return (
    <Pressable
      onPress={() => onChange(item.value)}
      onLayout={(event) => onLayout(index, event)}
      className="flex-1 py-2 px-3 min-h-[40px] justify-center items-center z-10"
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={item.label}
    >
      {({ pressed }) => (
        <View className="flex-row items-center justify-center">
          {item.icon && <View className="mr-1.5">{item.icon}</View>}
          <Text
            className="text-[15px] font-semibold text-center"
            style={{
              color: isSelected
                ? isDark
                  ? '#ffffff'
                  : '#0f172a'
                : isDark
                  ? '#94a3b8'
                  : '#64748b',
              opacity: pressed ? 0.7 : 1,
            }}
          >
            {item.label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function Slider({ x, width, isDark }: { x: number; width: number; isDark: boolean }) {
  const nativeTransition = Platform.OS !== 'web' ? LinearTransition.easing(Easing.out(Easing.exp)) : undefined;

  return (
    <Animated.View
      layout={nativeTransition}
      className="absolute top-1 bottom-1 rounded-[10px]"
      style={{
        backgroundColor: isDark ? 'rgba(51, 65, 85, 0.8)' : '#ffffff',
        ...Platform.select({
          web: {
            boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
            left: x,
            width,
            transition: 'left 0.2s ease-out, width 0.2s ease-out',
          },
          ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            left: x,
            width,
          },
          android: {
            elevation: 2,
            left: x,
            width,
          },
        }),
      }}
    />
  );
}
