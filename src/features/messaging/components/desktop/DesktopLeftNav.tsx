// src/view/components/desktop/DesktopLeftNav.tsx
// Fixed-position left navigation for desktop web, inspired by Bluesky

import React from "react";
import { View, Text, Pressable, ScrollView, Platform } from "react-native";
import { useNavigation, useNavigationState } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";

import { RootStackParamList, HomeTabParamList } from "@/navigation/types";
import {
  useLayoutBreakpoints,
  LEFT_NAV_WIDTH,
  LEFT_NAV_MINIMAL_WIDTH,
  CENTER_COLUMN_OFFSET,
} from "@/alf/breakpoints";
import { useAccentColor } from "@/state/theme/useAccentColor";
import { WalletSwitcher } from "@/features/auth/components/WalletSwitcher";
import Svg, { Path } from "react-native-svg";
import MessageIcon from "@/assets/navIcons/message.svg";
import MessageIconFilled from "@/assets/navIcons/message-filled.svg";
import UserIcon from "@/assets/navIcons/user.svg";
import UserIconFilled from "@/assets/navIcons/user-filled.svg";
import SettingsIcon from "@/assets/navIcons/settings.svg";
import SettingsIconFilled from "@/assets/navIcons/settings-filled.svg";

// Feather icon for New Post button
function FeatherIcon({
  width = 20,
  height = 20,
  fill = "white",
}: {
  width?: number;
  height?: number;
  fill?: string;
}) {
  return (
    <Svg width={width} height={height} viewBox="0 0 20 20">
      <Path
        d="M4.254 19.567c.307-.982.77-2.364 1.391-4.362 2.707-.429 3.827.341 5.546-2.729-1.395.427-3.077-.792-2.987-1.321.091-.528 3.913.381 6.416-3.173-3.155.696-4.164-.836-3.757-1.067.939-.534 3.726-.222 5.212-1.669.766-.745 1.125-2.556.813-3.202-.374-.781-2.656-1.946-3.914-1.836-1.258.109-3.231 4.79-3.817 4.754-.584-.037-.703-2.098.319-4.013-1.077.477-3.051 1.959-3.67 3.226-1.153 2.357.108 7.766-.296 7.958-.405.193-1.766-2.481-2.172-3.694-.555 1.859-.568 3.721 1.053 6.194-.611 1.623-.945 3.491-.996 4.441-.024.759.724.922.859.493z"
        fill={fill}
      />
    </Svg>
  );
}

const NAV_ICON_WIDTH = 26;
type NavIconComponent = React.ComponentType<{
  width?: number;
  height?: number;
  stroke?: string;
  strokeWidth?: number | string;
  fill?: string;
}>;

interface NavItemProps {
  Icon: NavIconComponent;
  ActiveIcon: NavIconComponent;
  label: string;
  isActive: boolean;
  onPress: () => void;
  minimal: boolean;
  isDark: boolean;
}

function NavItem({
  Icon,
  ActiveIcon,
  label,
  isActive,
  onPress,
  minimal,
  isDark,
}: NavItemProps) {
  // Filled icon when active, outline when inactive
  const InUseIcon = isActive ? ActiveIcon : Icon;
  const activeColor = isDark ? "#f8fafc" : "#0f172a"; // Dark text for light mode, light for dark mode
  const inactiveColor = isDark ? "#94a3b8" : "#64748b";

  return (
    <Pressable
      onPress={onPress}
      className={[
        "flex-row items-center gap-3 rounded-full px-3 py-2.5 w-full transition-colors duration-150 hover:bg-slate-200/70 dark:hover:bg-slate-800/70 active:opacity-80 cursor-pointer",
        minimal ? "justify-center px-0" : "",
      ].join(" ")}
    >
      <View
        className={[
          "items-center justify-center",
          minimal ? "w-11 h-11" : "w-7 h-7",
        ].join(" ")}
      >
        <InUseIcon
          width={NAV_ICON_WIDTH}
          height={NAV_ICON_WIDTH}
          stroke={isActive ? activeColor : inactiveColor}
          strokeWidth={isActive ? 1.5 : 1.6}
          fill={isActive ? activeColor : "none"}
        />
      </View>
      {!minimal && (
        <Text
          className="text-[16px]"
          style={{
            fontWeight: isActive ? "700" : "400",
            color: isActive ? activeColor : isDark ? "#e2e8f0" : "#475569",
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

interface DesktopLeftNavProps {
  activeTab?: keyof HomeTabParamList | "Settings";
  onTabChange?: (tab: keyof HomeTabParamList) => void;
}

export function DesktopLeftNav({
  activeTab = "Messages",
  onTabChange,
}: DesktopLeftNavProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const rootNavigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { leftNavMinimal, centerColumnOffset } = useLayoutBreakpoints();
  const { accentColor } = useAccentColor();

  // Get current route to determine if we're on Settings or Profile screen
  const currentRouteName = useNavigationState((state) => {
    if (!state || !state.routes || state.routes.length === 0) return "";
    const route = state.routes[state.index];
    return route?.name || "";
  });

  // Determine which nav item is active based on route
  const isProfileActive =
    currentRouteName === "Profile" || activeTab === "Profile";
  const isSettingsActive = currentRouteName === "Settings";
  const isChatsActive =
    !isProfileActive &&
    !isSettingsActive &&
    (activeTab === "Messages" || currentRouteName === "Main");

  const navItems: {
    key: string;
    label: string;
    Icon: NavIconComponent;
    ActiveIcon: NavIconComponent;
    isActive: boolean;
    onPress: () => void;
  }[] = [
    {
      key: "Messages",
      label: "Chats",
      Icon: MessageIcon,
      ActiveIcon: MessageIconFilled,
      isActive: isChatsActive,
      onPress: () => {
        // Navigate to Main with Messages screen
        rootNavigation.navigate("Main", { screen: "Messages" });
      },
    },
    {
      key: "Profile",
      label: "Profile",
      Icon: UserIcon,
      ActiveIcon: UserIconFilled,
      isActive: isProfileActive,
      onPress: () => {
        // Navigate to Main with Profile screen - this will update URL to /profile
        rootNavigation.navigate("Main", { screen: "Profile" });
      },
    },
    {
      key: "Settings",
      label: "Settings",
      Icon: SettingsIcon,
      ActiveIcon: SettingsIconFilled,
      isActive: isSettingsActive,
      onPress: () => {
        // Settings is a separate screen in the root stack - URL will be /settings
        rootNavigation.navigate("Settings");
      },
    },
  ];

  const width = leftNavMinimal ? LEFT_NAV_MINIMAL_WIDTH : LEFT_NAV_WIDTH;
  const translateX = -300 + (centerColumnOffset ? CENTER_COLUMN_OFFSET : 0);

  return (
    <View
      className={[
        "absolute top-0 h-full z-10",
        leftNavMinimal ? "items-center px-3" : "px-4",
      ].join(" ")}
      style={{
        left: "50%",
        width,
        paddingTop: insets.top + 10,
        paddingBottom: insets.bottom + 10,
        backgroundColor: isDark ? "#0a0f1a" : "#ffffff",
        transform: [{ translateX: translateX }, { translateX: -width }],
        ...(Platform.OS === "web" &&
          ({
            position: "fixed",
            maxHeight: "100vh",
            overflowY: "auto",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          } as any)),
      }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName={
          leftNavMinimal ? "items-center pb-6" : "pb-6"
        }
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View
          className={[
            "flex-1 w-full",
            leftNavMinimal ? "items-center" : "",
          ].join(" ")}
        >
          <View className={leftNavMinimal ? "items-center gap-2" : "gap-2"}>
            <WalletSwitcher minimal={leftNavMinimal} />

            {/* Navigation Items */}
            <View className={leftNavMinimal ? "items-center gap-1" : "gap-1"}>
              {navItems.map((item) => (
                <NavItem
                  key={item.key}
                  Icon={item.Icon}
                  ActiveIcon={item.ActiveIcon}
                  label={item.label}
                  isActive={item.isActive}
                  onPress={item.onPress}
                  minimal={leftNavMinimal}
                  isDark={isDark}
                />
              ))}
            </View>

            {/* Post Button - using accent color */}
            {!leftNavMinimal ? (
              <Pressable
                onPress={() => rootNavigation.navigate("Composer")}
                className="mt-6 ml-2 flex-row items-center self-start rounded-full px-5 py-2.5 active:opacity-90"
                style={{ backgroundColor: accentColor }}
              >
                <FeatherIcon width={18} height={18} fill="white" />
                <Text className="ml-2 text-sm font-semibold text-white">
                  New Post
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => rootNavigation.navigate("Composer")}
                className="mt-6 h-11 w-11 items-center justify-center rounded-full active:opacity-90"
                style={{ backgroundColor: accentColor }}
              >
                <FeatherIcon width={20} height={20} fill="white" />
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
