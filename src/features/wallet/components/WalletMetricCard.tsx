import React from "react";
import { Text, View } from "react-native";

function joinClassNames(...values: (string | undefined)[]) {
  return values.filter(Boolean).join(" ");
}

type WalletMetricCardProps = {
  title: string;
  primaryValue: string;
  secondaryValue?: string;
  helperText?: string;
  icon?: React.ReactNode;
  iconContainerClassName?: string;
};

export function WalletMetricCard({
  title,
  primaryValue,
  secondaryValue,
  helperText,
  icon,
  iconContainerClassName,
}: WalletMetricCardProps) {
  return (
    <View className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800/80 dark:bg-slate-900/60">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {title}
          </Text>
          <Text className="mt-3 text-[28px] font-bold tracking-[-0.4px] text-slate-900 dark:text-white">
            {primaryValue}
          </Text>
          {secondaryValue ? (
            <Text className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {secondaryValue}
            </Text>
          ) : null}
        </View>

        {icon ? (
          <View
            className={joinClassNames(
              "h-11 w-11 items-center justify-center rounded-full bg-white/90 dark:bg-slate-950/80",
              iconContainerClassName,
            )}
          >
            {icon}
          </View>
        ) : null}
      </View>

      {helperText ? (
        <Text className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}
