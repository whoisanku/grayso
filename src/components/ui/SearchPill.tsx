import React from "react";
import {
  Platform,
  Pressable,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import { SearchIcon } from "@/components/icons/SearchIcon";

type SearchPillProps = Omit<
  TextInputProps,
  "onChangeText" | "style" | "value"
> & {
  value: string;
  onChangeText: (value: string) => void;
  onClear?: () => void;
  isDark: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  height?: number;
};

export function SearchPill({
  value,
  onChangeText,
  onClear,
  placeholder = "Search users",
  placeholderTextColor,
  isDark,
  containerStyle,
  height = 52,
  ...textInputProps
}: SearchPillProps) {
  return (
    <View
      className="flex-row items-center gap-3 rounded-full border border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-[#0f172a]"
      style={[{ height }, containerStyle]}
    >
      <SearchIcon
        size={18}
        color={isDark ? "#94a3b8" : "#64748b"}
        strokeWidth={1.7}
      />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={
          placeholderTextColor ?? (isDark ? "#64748b" : "#94a3b8")
        }
        autoCapitalize="none"
        autoCorrect={false}
        className="flex-1 p-0 text-[15px] text-slate-900 dark:text-white"
        style={[
          {
            height: 24,
            minHeight: 24,
            paddingVertical: 0,
            paddingHorizontal: 0,
            borderWidth: 0,
            backgroundColor: "transparent",
            lineHeight: 20,
            includeFontPadding: false,
            textAlignVertical: "center",
          },
          Platform.OS === "web"
            ? {
                outlineWidth: 0,
                boxShadow: "none",
                margin: 0,
              }
            : null,
        ]}
        {...textInputProps}
      />
      {value.trim().length > 0 ? (
        <Pressable
          onPress={() => {
            if (onClear) {
              onClear();
              return;
            }

            onChangeText("");
          }}
          className="h-7 w-7 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800"
        >
          <Feather
            name="x"
            size={14}
            color={isDark ? "#cbd5e1" : "#475569"}
          />
        </Pressable>
      ) : null}
    </View>
  );
}
