import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  TouchableOpacity,
  Platform,
  StyleSheet,
  Pressable,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";

import { type RootStackParamList, type HomeTabParamList } from "./types";
import MessageIcon from "../assets/navIcons/message.svg";
import MessageIconFilled from "../assets/navIcons/message-filled.svg";
import HomeIcon from "../assets/navIcons/home.svg";
import HomeIconFilled from "../assets/navIcons/home-filled.svg";
import UserIcon from "../assets/navIcons/user.svg";
import UserIconFilled from "../assets/navIcons/user-filled.svg";
import { FeatherPostIcon } from "@/components/icons/FeatherPostIcon";
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

  const handleProfileLongPress = useCallback(() => {
    if (accounts.length > 1) {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      setShowWalletSwitcher(true);
    }
  }, [accounts.length]);

  const tabConfig = useMemo(
    () => [
      {
        key: "Feed" as const,
        onPress: () => navigation.navigate("Main", { screen: "Feed" }),
        renderIcon: (focused: boolean) =>
          focused ? (
            <HomeIconFilled
              width={27}
              height={27}
              fill={isDark ? "#f8fafc" : "#0f172a"}
            />
          ) : (
            <HomeIcon
              width={27}
              height={27}
              stroke={isDark ? "#64748b" : "#94a3b8"}
              strokeWidth={2}
            />
          ),
      },
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
    [isDark, navigation, handleProfileLongPress],
  );

  return (
    <>
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
          const isFocused = tab.key === activeTab;

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
      </View>

      {activeTab === "Messages" || activeTab === "Feed" ? (
        <Pressable
          onPress={() => {
            if (activeTab === "Messages") {
              navigation.navigate("NewChat");
              return;
            }

            navigation.navigate("Composer");
          }}
          style={[
            styles.composeFab,
            {
              bottom: Math.max(insets.bottom, 15) + 48,
              backgroundColor: accentColor,
            },
          ]}
        >
          {activeTab === "Messages" ? (
            <Feather name="plus" size={19} color="#ffffff" />
          ) : (
            <FeatherPostIcon width={19} height={19} fill="#ffffff" />
          )}
        </Pressable>
      ) : null}

      {/* Wallet Switcher Dialog */}
      <SwitchWalletDialog
        visible={showWalletSwitcher}
        onClose={() => setShowWalletSwitcher(false)}
      />
    </>
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
  composeFab: {
    position: "absolute",
    right: 24,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
  },
});
