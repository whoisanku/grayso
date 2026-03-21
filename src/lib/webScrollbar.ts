import { Platform, type ViewStyle } from "react-native";

type WebScrollbarStyle = ViewStyle & {
  scrollbarWidth?: "thin";
  scrollbarColor?: string;
};

export function getWebScrollbarStyle(
  isDark: boolean,
): WebScrollbarStyle | undefined {
  if (Platform.OS !== "web") {
    return undefined;
  }

  return {
    scrollbarWidth: "thin",
    scrollbarColor: `${isDark ? "#475569" : "#cbd5e1"} ${
      isDark ? "#0a0f1a" : "#ffffff"
    }`,
  };
}
