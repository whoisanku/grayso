import React, { useMemo, useState } from "react";
import { View, TouchableOpacity, Platform, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { type RootStackParamList, type HomeTabParamList } from "./types";
import MessageIcon from "../assets/navIcons/message.svg";
import MessageIconFilled from "../assets/navIcons/message-filled.svg";
import UserIcon from "../assets/navIcons/user.svg";
import UserIconFilled from "../assets/navIcons/user-filled.svg";
import { useAccentColor } from "../state/theme/useAccentColor";
import { getBorderColor } from "../theme/borders";
import { SwitchWalletDialog } from "@/features/auth/components/SwitchWalletDialog";
import { useWalletSwitcher } from "@/features/auth/hooks/useWalletSwitcher";

type MobileNavProps = {
  activeTab?: keyof HomeTabParamList;
};

export function MobileNav({ activeTab }: MobileNavProps) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const { accentColor } = useAccentColor();
  const { accounts } = useWalletSwitcher();
  const [showWalletSwitcher, setShowWalletSwitcher] = useState(false);

  const handleProfileLongPress = () => {
    if (accounts.length > 1) {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      setShowWalletSwitcher(true);
    }
  };

  const tabConfig = useMemo(
    () => [
      {
        key: "Messages" as const,
        onPress: () => navigation.navigate("Main", { screen: "Messages" }),
        renderIcon: (focused: boolean) =>
          focused ? (
            <MessageIconFilled
              width={27}
              height={27}
              fill={isDark ? "#f8fafc" : "#0f172a"}
            />
          ) : (
            <MessageIcon
              width={27}
              height={27}
              stroke={isDark ? "#64748b" : "#94a3b8"}
              strokeWidth={2}
            />
          ),
      },
      {
        key: "Composer" as const,
        onPress: () => navigation.navigate("Composer"),
        renderIcon: () => (
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: accentColor,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="edit-2" size={18} color="white" />
          </View>
        ),
      },
      {
        key: "Profile" as const,
        onPress: () => navigation.navigate("Main", { screen: "Profile" }),
        onLongPress: handleProfileLongPress,
        renderIcon: (focused: boolean) =>
          focused ? (
            <UserIconFilled
              width={27}
              height={27}
              fill={isDark ? "#f8fafc" : "#0f172a"}
            />
          ) : (
            <UserIcon
              width={27}
              height={27}
              stroke={isDark ? "#64748b" : "#94a3b8"}
              strokeWidth={2}
            />
          ),
      },
    ],
    [accentColor, isDark, navigation, handleProfileLongPress]
  );

  return (
    <View
      // @ts-ignore data attribute for scroll lock
      dataSet={{ scrollLock: "true" }}
      style={[
        styles.container,
        {
          backgroundColor: isDark ? "#0a0f1a" : "#ffffff",
          borderTopColor: getBorderColor(isDark, "contrast_low"),
          paddingBottom: Math.max(insets.bottom, 15),
        },
      ]}
    >
      {tabConfig.map((tab) => {
        const isFocused =
          (tab.key === "Composer" && activeTab === "Post") ||
          tab.key === activeTab;

        return (
          <TouchableOpacity
            key={tab.key}
            onPress={tab.onPress}
            onLongPress={(tab as any).onLongPress}
            activeOpacity={0.8}
            style={styles.tabButton}
          >
            {tab.renderIcon(!!isFocused)}
          </TouchableOpacity>
        );
      })}
      
      {/* Wallet Switcher Dialog */}
      <SwitchWalletDialog
        visible={showWalletSwitcher}
        onClose={() => setShowWalletSwitcher(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    paddingLeft: 5,
    paddingRight: 10,
    paddingTop: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabButton: {
    flex: 1,
    paddingTop: 0,
    paddingBottom: Platform.OS === "ios" ? 4 : 6,
    alignItems: "center",
    justifyContent: "center",
  },
});
