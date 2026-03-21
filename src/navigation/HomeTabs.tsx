import React, { useContext, useCallback, useMemo, useState } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { HomeScreen } from "../features/messaging/screens/HomeScreen";
import { ProfileScreen } from "../features/profile/screens/ProfileScreen";
import { FeedScreen } from "../features/feed/screens/FeedScreen";
import { NotificationsScreen } from "../features/notifications/screens/NotificationsScreen";
import { SearchScreen } from "../features/search/screens/SearchScreen";
import { WalletScreen } from "../features/wallet/screens/WalletScreen";
import HomeIcon from "../assets/navIcons/home.svg";
import HomeIconFilled from "../assets/navIcons/home-filled.svg";
import { ChatIcon, ChatIconFilled } from "@/components/icons/ChatIcon";
import { FeatherPostIcon } from "@/components/icons/FeatherPostIcon";
import { ProfileIcon, ProfileIconFilled } from "@/components/icons/ProfileIcon";
import { SearchIcon } from "@/components/icons/SearchIcon";
import { WalletIcon, WalletIconFilled } from "@/components/icons/WalletIcon";
import {
  NotificationBellFilledIcon,
  NotificationBellOutlineIcon,
} from "@/components/ui/NotificationBellIcon";

import {
  View,
  TouchableOpacity,
  Platform,
  DeviceEventEmitter,
  Text,
  useWindowDimensions,
  Pressable,
} from "react-native";
import { Gesture } from "react-native-gesture-handler";
import { Image } from "expo-image";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { type HomeTabParamList, type RootStackParamList } from "./types";
import { Drawer } from "react-native-drawer-layout";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useColorScheme } from "nativewind";
import { DRAWER_STATE_EVENT } from "../constants/events";
import { DeSoIdentityContext } from "react-deso-protocol";
import { buildProfilePictureUrl } from "deso-protocol";
import {
  FALLBACK_PROFILE_IMAGE,
  getProfileDisplayName,
  resolveCurrentUserPublicKey,
} from "../utils/deso";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { PressableScale } from "@/components/ui/PressableScale";

import { useAccentColor } from "../state/theme/useAccentColor";
import { DesktopLeftNav } from "../features/messaging/components/desktop/DesktopLeftNav";
import { DesktopRightNav } from "../features/messaging/components/desktop/DesktopRightNav";
import {
  CENTER_CONTENT_MAX_WIDTH,
  useLayoutBreakpoints,
  CENTER_COLUMN_OFFSET,
} from "../alf/breakpoints";
import { getBorderColor } from "../theme/borders";
import { WalletSwitcher } from "../features/auth/components/WalletSwitcher";
import { ProfileStats } from "@/features/profile/components/ProfileStats";
import { useAccountProfile } from "@/features/profile/api/useAccountProfile";
import { useNotificationCounts } from "@/features/notifications/api/useNotificationCounts";
import {
  useIsDrawerOpen,
  useSetDrawerOpen,
  useIsDrawerSwipeDisabled,
} from "@/state/shell";

const Tab = createBottomTabNavigator<HomeTabParamList>();
const DummyComponent = () => <View />;
const DEFAULT_AVATAR_BLURHASH = "L5H2EC=PM+yV0g-mq.wG9c010J}I";

function CustomTabBar({
  state,
  navigation,
  unreadNotificationsCount = 0,
  currentProfileParams,
}: BottomTabBarProps & {
  unreadNotificationsCount?: number;
  currentProfileParams?: {
    username?: string;
    publicKey?: string;
  };
}) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { accentColor } = useAccentColor();
  const insets = useSafeAreaInsets();
  const [showWalletSwitcher, setShowWalletSwitcher] = React.useState(false);
  const longPressHandledRef = React.useRef(false);
  const activeRouteName = state.routes[state.index]?.name;
  const showFeedFab = activeRouteName === "Feed";
  const showChatFab = activeRouteName === "Messages";

  const tabButtons = state.routes
    .filter((route) => route.name !== "Post")
    .map((route) => {
      const isFocused = state.routes[state.index]?.key === route.key;

      const onPress = () => {
        if (route.name === "Profile" && longPressHandledRef.current) {
          longPressHandledRef.current = false;
          return;
        }

        // Haptic feedback on every tap
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }

        if (isFocused) {
          // Already on this tab — emit scroll-to-top
          DeviceEventEmitter.emit("scrollToTop", { tab: route.name });
          return;
        }

        const event = navigation.emit({
          type: "tabPress",
          target: route.key,
          canPreventDefault: true,
        });

        if (!event.defaultPrevented) {
          if (route.name === "Profile") {
            navigation.navigate("Profile", currentProfileParams);
            return;
          }

          navigation.navigate(route.name);
        }
      };

      // Handle long-press on Profile icon with haptic feedback
      const onLongPress =
        route.name === "Profile"
          ? () => {
              longPressHandledRef.current = true;
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
              setShowWalletSwitcher(true);
            }
          : undefined;

      let icon = null as React.ReactNode;
      if (route.name === "Messages") {
        icon = isFocused ? (
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
        );
      } else if (route.name === "Feed") {
        icon = isFocused ? (
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
        );
      } else if (route.name === "Notifications") {
        icon = isFocused ? (
          <NotificationBellFilledIcon
            size={28}
            color={isDark ? "#f8fafc" : "#0f172a"}
          />
        ) : (
          <NotificationBellOutlineIcon
            size={28}
            color={isDark ? "#64748b" : "#94a3b8"}
          />
        );
      } else if (route.name === "Search") {
        icon = (
          <SearchIcon
            size={24}
            color={
              isFocused
                ? isDark
                  ? "#f8fafc"
                  : "#0f172a"
                : isDark
                  ? "#64748b"
                  : "#94a3b8"
            }
            strokeWidth={isFocused ? 1.85 : 1.65}
          />
        );
      } else if (route.name === "Wallet") {
        icon = isFocused ? (
          <WalletIconFilled
            size={25}
            color={isDark ? "#f8fafc" : "#0f172a"}
          />
        ) : (
          <WalletIcon
            size={25}
            color={isDark ? "#94a3b8" : "#64748b"}
            strokeWidth={1.65}
          />
        );
      } else {
        icon = isFocused ? (
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
        );
      }

      return (
        <Pressable
          key={route.key}
          onPress={onPress}
          onLongPress={onLongPress}
          delayLongPress={250}
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingTop: 13,
            paddingBottom: 4,
          }}
        >
          <View className="relative items-center justify-center">
            {icon}
            {route.name === "Notifications" && unreadNotificationsCount > 0 ? (
              <View
                className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-rose-600"
                style={{ zIndex: 40, elevation: 8 }}
              />
            ) : null}
          </View>
        </Pressable>
      );
    });

  // Bluesky-style attached bottom bar
  return (
    <>
      <View
        // @ts-ignore - data attribute for CSS scroll lock
        dataSet={{ scrollLock: "true" }}
        className="absolute bottom-0 left-0 right-0 flex-row border-t pl-[5px] pr-[10px]"
        style={{
          backgroundColor: isDark ? "#0a0f1a" : "#ffffff",
          borderTopColor: getBorderColor(isDark, "contrast_low"),
          paddingBottom: Math.max(insets.bottom, 15),
        }}
      >
        {tabButtons}
      </View>

      {showFeedFab || showChatFab ? (
        <PressableScale
          onPress={() => {
            if (showChatFab) {
              const parentNavigation = navigation.getParent();
              if (parentNavigation) {
                parentNavigation.navigate("NewChat" as never);
                return;
              }
            }

            navigation.navigate("Composer");
          }}
          targetScale={0.9}
          style={{
            position: "absolute",
            right: 24,
            bottom: Math.max(insets.bottom, 15) + 56,
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: accentColor,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 6,
          }}
        >
          {showChatFab ? (
            <Feather name="plus" size={22} color="#ffffff" />
          ) : (
            <FeatherPostIcon width={22} height={22} fill="#ffffff" />
          )}
        </PressableScale>
      ) : null}

      {/* Wallet Switcher Modal - triggered by long-press on Profile icon */}
      {showWalletSwitcher && (
        <WalletSwitcher
          showTrigger={false}
          externalOpen={showWalletSwitcher}
          onExternalClose={() => setShowWalletSwitcher(false)}
        />
      )}
    </>
  );
}

type HomeTabsProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Main">;
};

export function HomeTabs({ navigation }: HomeTabsProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const { currentUser } = useContext(DeSoIdentityContext);
  const rootNavigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && windowWidth >= 1024;

  // Use context-based drawer state management
  const isDrawerOpen = useIsDrawerOpen();
  const setDrawerOpen = useSetDrawerOpen();
  const isDrawerSwipeDisabled = useIsDrawerSwipeDisabled();

  const [trendingScrollGesture] = useState(() => Gesture.Native());
  const [activeTab, setActiveTab] =
    React.useState<keyof HomeTabParamList>("Feed");

  const drawerWidth = useMemo(
    () => Math.min(280, windowWidth * 0.7),
    [windowWidth],
  );
  const { centerColumnOffset } = useLayoutBreakpoints();

  // Fetch profile stats
  const publicKey = resolveCurrentUserPublicKey(currentUser);
  const { data: account } = useAccountProfile({ publicKey });
  const followerCount = useMemo(
    () => account?.followerCounts?.totalFollowers ?? 0,
    [account?.followerCounts?.totalFollowers],
  );
  const followingCount = useMemo(
    () => account?.followingCounts?.totalFollowing ?? 0,
    [account?.followingCounts?.totalFollowing],
  );
  const displayName = getProfileDisplayName(
    currentUser?.ProfileEntryResponse,
    publicKey || "",
  );
  const currentUsername =
    currentUser?.ProfileEntryResponse?.Username?.trim() ?? "";
  const currentProfileParams = useMemo(
    () =>
      currentUsername || publicKey
        ? {
            username: currentUsername || undefined,
            publicKey: publicKey || undefined,
          }
        : undefined,
    [currentUsername, publicKey],
  );
  const { counts: notificationCounts } = useNotificationCounts(publicKey);
  const unreadNotificationsCount = Math.max(
    0,
    Number(notificationCounts.unreadNotificationCount) || 0,
  );

  // Listen for drawer toggle requests from HomeScreen
  React.useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      DRAWER_STATE_EVENT,
      (payload: { requestOpen?: boolean }) => {
        if (payload.requestOpen !== undefined) {
          setDrawerOpen(payload.requestOpen);
        }
      },
    );
    return () => subscription.remove();
  }, [setDrawerOpen]);

  const renderDrawerContent = useCallback(
    () => (
      <View
        className="flex-1 h-full"
        style={{
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          backgroundColor: isDark ? "#0a0f1a" : "#ffffff",
          borderRightWidth: 0.5,
          borderRightColor: getBorderColor(isDark, "contrast_low"),
        }}
      >
        {/* Profile Section */}
        <View className="px-4 py-5 border-b border-slate-100 dark:border-slate-800">
          <View className="flex-row items-center mb-3">
            <Image
              source={{
                uri: publicKey &&
                  currentUser?.ProfileEntryResponse?.ExtraData?.ProfilePic
                  ? `https://node.deso.org/api/v0/get-single-profile-picture/${publicKey}?fallback=${encodeURIComponent(currentUser.ProfileEntryResponse.ExtraData.ProfilePic)}`
                  : buildProfilePictureUrl(
                      publicKey,
                      {
                        fallbackImageUrl: FALLBACK_PROFILE_IMAGE,
                      },
                    ),
              }}
              style={{ width: 48, height: 48, borderRadius: 24 }}
              className="bg-slate-200 dark:bg-slate-700"
              contentFit="cover"
              placeholder={{ blurhash: DEFAULT_AVATAR_BLURHASH }}
              transition={500}
            />
          </View>
          <Text
            className="text-base font-bold text-slate-900 dark:text-white mb-0.5"
            numberOfLines={1}
          >
            {displayName}
          </Text>
          <Text
            className="text-sm text-slate-500 dark:text-slate-400 mb-3"
            numberOfLines={1}
          >
            @{currentUser?.ProfileEntryResponse?.Username || "User"}
          </Text>
          <ProfileStats
            followers={followerCount}
            following={followingCount}
          />
        </View>

        {/* Navigation Items */}
        <View className="flex-1 pt-2">
          {/* Feed */}
          <TouchableOpacity
            className="flex-row items-center px-4 py-3.5 transition-colors duration-150 hover:bg-slate-100 dark:hover:bg-slate-800 active:opacity-80"
            activeOpacity={0.7}
            onPress={() => {
              setDrawerOpen(false);
              rootNavigation.navigate("Main", { screen: "Feed" });
            }}
          >
            <HomeIcon
              width={20}
              height={20}
              fill={isDark ? "#e2e8f0" : "#0f172a"}
            />
            <Text className="ml-4 text-[15px] font-medium text-slate-900 dark:text-white">
              Home
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center px-4 py-3.5 transition-colors duration-150 hover:bg-slate-100 dark:hover:bg-slate-800 active:opacity-80"
            activeOpacity={0.7}
            onPress={() => {
              setDrawerOpen(false);
              rootNavigation.navigate("Main", { screen: "Search" });
            }}
          >
            <SearchIcon
              size={22}
              color={isDark ? "#e2e8f0" : "#0f172a"}
              strokeWidth={1.7}
            />
            <Text className="ml-4 text-[15px] font-medium text-slate-900 dark:text-white">
              Search
            </Text>
          </TouchableOpacity>

          {/* Chat */}
          <TouchableOpacity
            className="flex-row items-center px-4 py-3.5 transition-colors duration-150 hover:bg-slate-100 dark:hover:bg-slate-800 active:opacity-80"
            activeOpacity={0.7}
            onPress={() => {
              setDrawerOpen(false);
              rootNavigation.navigate("Main", { screen: "Messages" });
            }}
          >
            <ChatIcon
              size={22}
              color={isDark ? "#e2e8f0" : "#0f172a"}
              strokeWidth={1.8}
            />
            <Text className="ml-4 text-[15px] font-medium text-slate-900 dark:text-white">
              Chat
            </Text>
          </TouchableOpacity>

          {/* Notifications */}
          <TouchableOpacity
            className="flex-row items-center px-4 py-3.5 transition-colors duration-150 hover:bg-slate-100 dark:hover:bg-slate-800 active:opacity-80"
            activeOpacity={0.7}
            onPress={() => {
              setDrawerOpen(false);
              rootNavigation.navigate("Main", { screen: "Notifications" });
            }}
          >
            <View className="relative">
              <NotificationBellOutlineIcon
                size={25}
                color={isDark ? "#e2e8f0" : "#0f172a"}
              />
              {unreadNotificationsCount > 0 ? (
                <View
                  className="absolute -right-2.5 -top-2.5 h-5 min-w-[20px] rounded-full bg-rose-600 px-1.5"
                  style={{ alignItems: "center", justifyContent: "center", zIndex: 20 }}
                >
                  <Text className="text-[11px] font-bold leading-[13px] text-white">
                    {unreadNotificationsCount > 99
                      ? "99+"
                      : String(unreadNotificationsCount)}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text className="ml-4 text-[15px] font-medium text-slate-900 dark:text-white">
              Notifications
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center px-4 py-3.5 transition-colors duration-150 hover:bg-slate-100 dark:hover:bg-slate-800 active:opacity-80"
            activeOpacity={0.7}
            onPress={() => {
              setDrawerOpen(false);
              rootNavigation.navigate("Main", { screen: "Wallet" });
            }}
          >
            <WalletIcon
              size={22}
              color={isDark ? "#e2e8f0" : "#0f172a"}
              strokeWidth={1.7}
            />
            <Text className="ml-4 text-[15px] font-medium text-slate-900 dark:text-white">
              Wallet
            </Text>
          </TouchableOpacity>

          {/* Profile */}
          <TouchableOpacity
            className="flex-row items-center px-4 py-3.5 transition-colors duration-150 hover:bg-slate-100 dark:hover:bg-slate-800 active:opacity-80"
            activeOpacity={0.7}
            onPress={() => {
              setDrawerOpen(false);
              rootNavigation.navigate("Main", {
                screen: "Profile",
                params: currentProfileParams,
              });
            }}
          >
            <ProfileIcon
              size={22}
              color={isDark ? "#e2e8f0" : "#0f172a"}
              strokeWidth={1.8}
            />
            <Text className="ml-4 text-[15px] font-medium text-slate-900 dark:text-white">
              Profile
            </Text>
          </TouchableOpacity>

          {/* Settings */}
          <TouchableOpacity
            className="flex-row items-center px-4 py-3.5 transition-colors duration-150 hover:bg-slate-100 dark:hover:bg-slate-800 active:opacity-80"
            activeOpacity={0.7}
            onPress={() => {
              setDrawerOpen(false);
              rootNavigation.navigate("Settings");
            }}
          >
            <Feather
              name="settings"
              size={22}
              color={isDark ? "#e2e8f0" : "#0f172a"}
            />
            <Text className="ml-4 text-[15px] font-medium text-slate-900 dark:text-white">
              Settings
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    ),
    [
      currentUser,
      insets.top,
      insets.bottom,
      isDark,
      rootNavigation,
      publicKey,
      displayName,
      followerCount,
      followingCount,
      unreadNotificationsCount,
      currentProfileParams,
      setDrawerOpen,
    ],
  );

  const renderTabNavigator = (
    tabBarOverride?: (props: BottomTabBarProps) => React.ReactNode,
  ) => (
    <Tab.Navigator
      initialRouteName="Feed"
      backBehavior="initialRoute"
      tabBar={
        tabBarOverride ??
        ((props) => (
          <CustomTabBar
            {...props}
            unreadNotificationsCount={unreadNotificationsCount}
            currentProfileParams={currentProfileParams}
          />
        ))
      }
      screenOptions={{
        headerShown: false,
        lazy: true,
        freezeOnBlur: true,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
        },
      }}
      screenListeners={{
        state: (e) => {
          const state = e.data?.state as any;
          if (state?.routeNames && typeof state.index === "number") {
            setActiveTab(state.routeNames[state.index]);
          }
        },
      }}
    >
      <Tab.Screen name="Feed" component={FeedScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Wallet" component={WalletScreen} />
      <Tab.Screen name="Messages" component={HomeScreen} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen
        name="Post"
        component={DummyComponent}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate("Composer");
          },
        }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );

  // Desktop web: show side navigation similar to Bluesky
  // Using fixed-position sidebars with content centered in viewport
  if (isDesktopWeb) {
    return (
      <View
        className="flex-1"
        style={{ backgroundColor: isDark ? "#0a0f1a" : "#ffffff" }}
      >
        {/* Fixed Left Navigation */}
        <DesktopLeftNav
          activeTab={activeTab}
          unreadNotificationsCount={unreadNotificationsCount}
        />

        {/* Main Content Area - centered with borders like Bluesky */}
        <View className="flex-1 items-center">
          <View
            className="flex-1 w-full"
            style={{
              maxWidth: CENTER_CONTENT_MAX_WIDTH,
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
              // Left and right borders around center content
              borderLeftWidth: 1,
              borderRightWidth: 1,
              borderColor: getBorderColor(isDark, "contrast_low"),
              transform: [
                { translateX: centerColumnOffset ? CENTER_COLUMN_OFFSET : 0 },
              ],
              ...(Platform.OS === "web" && {
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              }),
            }}
          >
            {renderTabNavigator(() => null)}
          </View>
        </View>

        {/* Fixed Right Navigation (only on wide screens) */}
        <DesktopRightNav />
      </View>
    );
  }

  // Native: Use Drawer component wrapping the tab navigator with optimized gesture handling
  const swipeEnabled = !isDrawerSwipeDisabled;

  return (
    <Drawer
      open={isDrawerOpen}
      onOpen={() => setDrawerOpen(true)}
      onClose={() => setDrawerOpen(false)}
      renderDrawerContent={renderDrawerContent}
      configureGestureHandler={(handler) => {
        handler = handler.requireExternalGestureToFail(trendingScrollGesture);

        if (swipeEnabled) {
          if (isDrawerOpen) {
            // When drawer is open, any touch can close it
            return handler.activeOffsetX([-1, 1]);
          } else {
            return (
              handler
                // Any movement to the left is blocked (prevents conflicts)
                .failOffsetX(-1)
                // Don't rush declaring drawer swipe - wait for horizontal movement
                .activeOffsetX(5)
            );
          }
        } else {
          // Fail the gesture immediately when swipe is disabled
          return handler.failOffsetX([0, 0]).failOffsetY([0, 0]);
        }
      }}
      drawerType={Platform.OS === "ios" ? "slide" : "front"}
      drawerStyle={{ width: drawerWidth }}
      overlayStyle={{
        backgroundColor: isDark
          ? "rgba(10, 13, 16, 0.8)"
          : "rgba(0, 57, 117, 0.1)",
      }}
      swipeEdgeWidth={windowWidth}
      swipeMinVelocity={100}
      swipeMinDistance={10}
    >
      {renderTabNavigator()}
    </Drawer>
  );
}
