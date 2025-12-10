import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { getBorderColor } from "@/theme/borders";

type IconName = React.ComponentProps<typeof Feather>["name"];

type ProfileSectionProps = {
  title: string;
  icon?: IconName;
  children?: React.ReactNode;
  isEmpty?: boolean;
  emptyMessage?: string;
  emptyIcon?: IconName;
};

export function ProfileSection({
  title,
  icon,
  children,
  isEmpty = false,
  emptyMessage = "Nothing here yet",
  emptyIcon = "inbox",
}: ProfileSectionProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <View className="w-full">
      {/* Section Header */}
      <View className="flex-row items-center gap-2 mb-3 px-1">
        {icon && (
          <Feather 
            name={icon} 
            size={18} 
            color={isDark ? "#94a3b8" : "#64748b"} 
          />
        )}
        <Text className="text-lg font-bold text-slate-900 dark:text-white">
          {title}
        </Text>
      </View>

      {/* Section Content */}
      {isEmpty ? (
        <View
          className="rounded-2xl px-6 py-8 items-center justify-center"
          style={{
            backgroundColor: isDark ? "rgba(15, 23, 42, 0.4)" : "rgba(248, 250, 252, 0.8)",
            borderWidth: 1,
            borderColor: getBorderColor(isDark, "subtle"),
            borderStyle: "dashed",
          }}
        >
          <View
            className="w-14 h-14 rounded-full items-center justify-center mb-3"
            style={{
              backgroundColor: isDark ? "rgba(51, 65, 85, 0.5)" : "rgba(226, 232, 240, 0.6)",
            }}
          >
            <Feather 
              name={emptyIcon} 
              size={24} 
              color={isDark ? "#64748b" : "#94a3b8"} 
            />
          </View>
          <Text className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {emptyMessage}
          </Text>
        </View>
      ) : (
        <View
          className="rounded-2xl overflow-hidden"
          style={{
            backgroundColor: isDark ? "rgba(15, 23, 42, 0.4)" : "rgba(248, 250, 252, 0.8)",
            borderWidth: 1,
            borderColor: getBorderColor(isDark, "subtle"),
          }}
        >
          {children}
        </View>
      )}
    </View>
  );
}
