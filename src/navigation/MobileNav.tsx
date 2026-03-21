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
import HomeIcon from "../assets/navIcons/home.svg";
import HomeIconFilled from "../assets/navIcons/home-filled.svg";
import { ChatIcon, ChatIconFilled } from "@/components/icons/ChatIcon";
import { FeatherPostIcon } from "@/components/icons/FeatherPostIcon";
import { ProfileIcon, ProfileIconFilled } from "@/components/icons/ProfileIcon";
import { SearchIcon } from "@/components/icons/SearchIcon";
import { WalletIcon, WalletIconFilled } from "@/components/icons/WalletIcon";
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
  const { accounts, currentUser } = useWalletSwitcher();
  const [showWalletSwitcher, setShowWalletSwitcher] = useState(false);
  const currentUsername =
    currentUser?.ProfileEntryResponse?.Username?.trim() ?? "";
  const currentPublicKey = currentUser?.PublicKeyBase58Check?.trim() ?? "";
  const currentProfileParams =
    currentUsername || currentPublicKey
      ? {
          username: currentUsername || undefined,
          publicKey: currentPublicKey || undefined,
        }
      : undefined;

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
              width={22}
              height={22}
              fill={isDark ? "#f8fafc" : "#0f172a"}
            />
          ) : (
            <HomeIcon
              width={22}
              height={22}
              fill={isDark ? "#64748b" : "#94a3b8"}
            />
          ),
      },
      {
        key: "Search" as const,
        onPress: () => navigation.navigate("Main", { screen: "Search" }),
        renderIcon: (focused: boolean) => (
          <SearchIcon
            size={24}
            color={
              focused
                ? isDark
                  ? "#f8fafc"
                  : "#0f172a"
                : isDark
                  ? "#64748b"
                  : "#94a3b8"
            }
            strokeWidth={focused ? 1.85 : 1.65}
          />
        ),
      },
      {
        key: "Wallet" as const,
        onPress: () => navigation.navigate("Main", { screen: "Wallet" }),
        renderIcon: (focused: boolean) =>
          focused ? (
            <WalletIconFilled
              size={24}
              color={isDark ? "#f8fafc" : "#0f172a"}
            />
          ) : (
            <WalletIcon
              size={24}
              color={isDark ? "#64748b" : "#94a3b8"}
              strokeWidth={1.65}
            />
          ),
      },
      {
        key: "Messages" as const,
        onPress: () => navigation.navigate("Main", { screen: "Messages" }),
        renderIcon: (focused: boolean) =>
          focused ? (
            <ChatIconFilled
              size={27}
              color={isDark ? "#f8fafc" : "#0f172a"}
            />
          ) : (
            <ChatIcon
              size={27}
              color={isDark ? "#64748b" : "#94a3b8"}
              strokeWidth={1.8}
            />
          ),
      },
      {
        key: "Profile" as const,
        onPress: () =>
          navigation.navigate("Main", {
            screen: "Profile",
            params: currentProfileParams,
          }),
        onLongPress: handleProfileLongPress,
        renderIcon: (focused: boolean) =>
          focused ? (
            <ProfileIconFilled
              size={27}
              color={isDark ? "#f8fafc" : "#0f172a"}
            />
          ) : (
            <ProfileIcon
              size={27}
              color={isDark ? "#64748b" : "#94a3b8"}
              strokeWidth={1.8}
            />
          ),
      },
    ],
    [currentProfileParams, handleProfileLongPress, isDark, navigation],
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
