// src/view/components/desktop/DesktopLeftNav.tsx
// Fixed-position left navigation for desktop web, inspired by Bluesky

import React, { useContext } from "react";
import { View, Text, Pressable, ScrollView, Platform, ActivityIndicator } from "react-native";
import { useNavigation, useNavigationState } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { DeSoIdentityContext } from "react-deso-protocol";

import { RootStackParamList, HomeTabParamList } from "@/navigation/types";
import {
  useLayoutBreakpoints,
  LEFT_NAV_WIDTH,
  LEFT_NAV_MINIMAL_WIDTH,
  CENTER_COLUMN_OFFSET,
} from "@/alf/breakpoints";
import { useAccentColor } from "@/state/theme/useAccentColor";
import { WalletSwitcher } from "@/features/auth/components/WalletSwitcher";
import HomeIcon from "@/assets/navIcons/home.svg";
import HomeIconFilled from "@/assets/navIcons/home-filled.svg";
import MessageIcon from "@/assets/navIcons/message.svg";
import MessageIconFilled from "@/assets/navIcons/message-filled.svg";
import UserIcon from "@/assets/navIcons/user.svg";
import UserIconFilled from "@/assets/navIcons/user-filled.svg";
import SettingsIcon from "@/assets/navIcons/settings.svg";
import SettingsIconFilled from "@/assets/navIcons/settings-filled.svg";
import { FeatherPostIcon } from "@/components/icons/FeatherPostIcon";
import {
  NotificationBellFilledIcon,
  NotificationBellOutlineIcon,
} from "@/components/ui/NotificationBellIcon";
import { useNotificationCounts } from "@/features/notifications/api/useNotificationCounts";
import { resolveCurrentUserPublicKey } from "@/utils/deso";
import { feedKeys } from "@/features/feed/api/keys";
import { notificationsKeys } from "@/features/notifications/api/keys";

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
  fillBased?: boolean;
  iconSize?: number;
  badgeCount?: number;
  isRefreshing?: boolean;
}

function BellNavIcon({
  width = NAV_ICON_WIDTH,
  height = NAV_ICON_WIDTH,
  stroke,
  strokeWidth: _strokeWidth,
  fill,
}: {
  width?: number;
  height?: number;
  stroke?: string;
  strokeWidth?: number | string;
  fill?: string;
}) {
  const baseSize = Math.max(width, height);
  const color = stroke ?? fill ?? "#64748b";
  const isFilled = typeof fill === "string" && fill !== "none";
  const iconSize = isFilled ? baseSize + 2 : baseSize;

  return isFilled ? (
    <NotificationBellFilledIcon size={iconSize} color={color} />
  ) : (
    <NotificationBellOutlineIcon size={iconSize} color={color} />
  );
}

function NavItem({
  Icon,
  ActiveIcon,
  label,
  isActive,
  onPress,
  minimal,
  isDark,
  fillBased = false,
  iconSize = NAV_ICON_WIDTH,
  badgeCount = 0,
  isRefreshing = false,
}: NavItemProps) {
  // Filled icon when active, outline when inactive
  const InUseIcon = isActive ? ActiveIcon : Icon;
  const activeColor = isDark ? "#f8fafc" : "#0f172a"; // Dark text for light mode, light for dark mode
  const inactiveColor = isDark ? "#94a3b8" : "#64748b";
  const badgeLabel = badgeCount > 99 ? "99+" : String(badgeCount);
  const isSingleDigitBadge = badgeLabel.length === 1;

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
          "relative items-center justify-center",
          minimal ? "w-11 h-11" : "w-7 h-7",
        ].join(" ")}
      >
        {isRefreshing ? (
          <ActivityIndicator
            size="small"
            color={isActive ? activeColor : inactiveColor}
          />
        ) : (
          <InUseIcon
            width={iconSize}
            height={iconSize}
            stroke={
              fillBased ? undefined : isActive ? activeColor : inactiveColor
            }
            strokeWidth={fillBased ? undefined : isActive ? 1.5 : 1.6}
            fill={
              fillBased
                ? isActive
                  ? activeColor
                  : inactiveColor
                : isActive
                  ? activeColor
                  : "none"
            }
          />
        )}
        {badgeCount > 0 && !isRefreshing ? (
          <View
            className={[
              "absolute -top-1.5 items-center justify-center rounded-full bg-rose-600",
              isSingleDigitBadge
                ? "-right-2.5 h-5 w-5"
                : "-right-3 h-5 min-w-[20px] px-1.5",
            ].join(" ")}
          >
            <Text className="text-[10px] font-bold text-white">
              {badgeLabel}
            </Text>
          </View>
        ) : null}
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
  unreadNotificationsCount?: number;
}

export function DesktopLeftNav({
  activeTab = "Messages",
  unreadNotificationsCount,
}: DesktopLeftNavProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const { currentUser } = useContext(DeSoIdentityContext);
  const rootNavigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { leftNavMinimal, centerColumnOffset } = useLayoutBreakpoints();
  const { accentColor } = useAccentColor();
  const publicKey = resolveCurrentUserPublicKey(currentUser);
  const { counts } = useNotificationCounts(publicKey);
  const queryClient = useQueryClient();
  const [refreshingKey, setRefreshingKey] = React.useState<string | null>(null);

  const resolvedUnreadNotificationsCount =
    unreadNotificationsCount ?? counts.unreadNotificationCount;

  // Get current route to determine if we're on Settings or Profile screen
  const currentRouteName = useNavigationState((state) => {
    if (!state || !state.routes || state.routes.length === 0) return "";
    const route = state.routes[state.index];
    return route?.name || "";
  });

  // Determine which nav item is active based on route
  const isMainTabsRoute = currentRouteName === "Main";
  const isFeedActive = currentRouteName === "Feed" || activeTab === "Feed";
  const isProfileActive =
    currentRouteName === "Profile" || activeTab === "Profile";
  const isNotificationsActive =
    currentRouteName === "Notifications" || activeTab === "Notifications";
  const shouldRefreshFeed = isMainTabsRoute && activeTab === "Feed";
  const shouldRefreshNotifications =
    isMainTabsRoute && activeTab === "Notifications";
  const isSettingsActive = currentRouteName === "Settings";
  const isChatsActive =
    !isFeedActive &&
    !isProfileActive &&
    !isNotificationsActive &&
    !isSettingsActive &&
    (activeTab === "Messages" || currentRouteName === "Main");

  const navItems: {
    key: string;
    label: string;
    Icon: NavIconComponent;
    ActiveIcon: NavIconComponent;
    isActive: boolean;
    onPress: () => void;
    fillBased?: boolean;
    iconSize?: number;
    badgeCount?: number;
  }[] = [
    {
      key: "Feed",
      label: "Feed",
      Icon: HomeIcon,
      ActiveIcon: HomeIconFilled,
      isActive: isFeedActive,
      fillBased: true,
      iconSize: 22,
      onPress: async () => {
        if (shouldRefreshFeed && !refreshingKey) {
          // Trigger refresh if already active
          setRefreshingKey("Feed");
          try {
            await queryClient.refetchQueries({
              queryKey: feedKeys.base,
            });
          } finally {
            setRefreshingKey(null);
          }
          return;
        }
        rootNavigation.navigate("Main", { screen: "Feed" });
      },
    },
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
      key: "Notifications",
      label: "Notifications",
      Icon: BellNavIcon,
      ActiveIcon: BellNavIcon,
      isActive: isNotificationsActive,
      badgeCount: resolvedUnreadNotificationsCount,
      iconSize: 28,
      onPress: async () => {
        if (shouldRefreshNotifications && !refreshingKey) {
          // Trigger refresh if already active
          setRefreshingKey("Notifications");
          try {
            await Promise.all([
              queryClient.refetchQueries({
                queryKey: notificationsKeys.base,
              }),
              // Also refresh counts just in case
              queryClient.refetchQueries({
                queryKey: notificationsKeys.counts(publicKey || ""),
              }),
            ]);
          } finally {
            setRefreshingKey(null);
          }
          return;
        }
        rootNavigation.navigate("Main", { screen: "Notifications" });
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
                  fillBased={item.fillBased}
                  iconSize={item.iconSize}
                  badgeCount={item.badgeCount}
                  isRefreshing={refreshingKey === item.key}
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
                <FeatherPostIcon width={18} height={18} fill="white" />
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
                <FeatherPostIcon width={20} height={20} fill="white" />
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
