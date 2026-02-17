import React from "react";
import { Pressable, Text, View } from "react-native";

function joinClassNames(...values: (string | null | undefined | false)[]) {
  return values.filter(Boolean).join(" ");
}

export function PageTopBar({
  title,
  titleSlot,
  subtitle,
  leftSlot,
  rightSlot,
  className,
  titleClassName,
  subtitleClassName,
  noBorder = false,
  lockScroll = true,
}: {
  title?: string;
  titleSlot?: React.ReactNode;
  subtitle?: string;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  noBorder?: boolean;
  lockScroll?: boolean;
}) {
  return (
    <View
      accessibilityRole="header"
      // @ts-ignore dataSet is used for web scroll handling
      dataSet={lockScroll ? { scrollLock: "true" } : undefined}
      className={joinClassNames(
        "min-h-[52px] flex-row items-center gap-3 bg-white px-4 py-2.5 dark:bg-[#0a0f1a]",
        noBorder ? null : "border-b border-slate-200 dark:border-slate-800",
        className,
      )}
    >
      {leftSlot ? <View className="shrink-0">{leftSlot}</View> : null}

      <View className="min-w-0 flex-1">
        {titleSlot ? (
          titleSlot
        ) : (
          <Text
            numberOfLines={1}
            className={joinClassNames(
              "text-[24px] font-bold tracking-[-0.3px] text-slate-900 dark:text-white",
              titleClassName,
            )}
          >
            {title}
          </Text>
        )}

        {subtitle ? (
          <Text
            numberOfLines={1}
            className={joinClassNames(
              "mt-0.5 text-xs text-slate-500 dark:text-slate-400",
              subtitleClassName,
            )}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {rightSlot ? (
        <View className="shrink-0 flex-row items-center gap-2">{rightSlot}</View>
      ) : null}
    </View>
  );
}

export function PageTopBarIconButton({
  onPress,
  children,
  accessibilityLabel,
}: {
  onPress: () => void;
  children: React.ReactNode;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={10}
      className="active:opacity-80"
    >
      <View className="h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
        {children}
      </View>
    </Pressable>
  );
}
