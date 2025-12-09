import React, { useContext, useCallback, useMemo } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { HomeScreen } from "../features/messaging/screens/HomeScreen";
import { ProfileScreen } from "../features/profile/screens/ProfileScreen";
import MessageIcon from "../assets/navIcons/message.svg";
import UserIcon from "../assets/navIcons/user.svg";

import { View, TouchableOpacity, Platform, StyleSheet, DeviceEventEmitter, Image, Text, useWindowDimensions, Pressable, ScrollView } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { type HomeTabParamList, type RootStackParamList } from "./types";
import { BlurView } from "expo-blur";
import { LiquidGlassView } from "../utils/liquidGlass";
import { Drawer } from "react-native-drawer-layout";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useColorScheme } from "nativewind";
import { DRAWER_STATE_EVENT } from "../constants/events";
import { DeSoIdentityContext } from "react-deso-protocol";
import { buildProfilePictureUrl } from "deso-protocol";
import { FALLBACK_PROFILE_IMAGE } from "../utils/deso";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useAccentColor } from "../state/theme/useAccentColor";
import { DesktopLeftNav } from "../features/messaging/components/desktop/DesktopLeftNav";
import { DesktopRightNav } from "../features/messaging/components/desktop/DesktopRightNav";
import { CENTER_CONTENT_MAX_WIDTH } from "../alf/breakpoints";
import { getBorderColor } from "../theme/borders";

const Tab = createBottomTabNavigator<HomeTabParamList>();
const DummyComponent = () => <View />;

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { accentColor, accentStrong } = useAccentColor();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && windowWidth >= 1024;
  const tabBarWidth = isDesktopWeb ? Math.min(520, windowWidth * 0.5) : "65%";
  const tabBarBottomOffset = isDesktopWeb ? 12 : 32;

  const tabButtons = state.routes.map((route, index) => {
    const { options } = descriptors[route.key];
    const isFocused = state.index === index;

    const onPress = () => {
      const event = navigation.emit({
        type: "tabPress",
        target: route.key,
        canPreventDefault: true,
      });

      if (!isFocused && !event.defaultPrevented) {
        if (route.name === "Post") {
          navigation.navigate("Composer");
        } else {
          navigation.navigate(route.name);
        }
      }
    };

    // Center button (Compose) - special styling
    if (route.name === "Post") {
      return (
        <TouchableOpacity
          key={route.key}
          onPress={() => navigation.navigate("Composer")}
          activeOpacity={0.8}
          className="mx-4 h-14 w-14 items-center justify-center rounded-full"
          style={{
            backgroundColor: accentColor,
            shadowColor: accentStrong,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 5,
          }}
        >
          <Feather name="edit-2" size={24} color="white" />
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        key={route.key}
        onPress={onPress}
        activeOpacity={0.7}
        className="items-center justify-center p-2"
      >
        {route.name === "Messages" ? (
          <MessageIcon
            width={24}
            height={24}
            stroke={isFocused ? (isDark ? "#f8fafc" : "#0f172a") : (isDark ? "#64748b" : "#94a3b8")}
            strokeWidth={isFocused ? 2.5 : 2}
            fill="none"
          />
        ) : (
          <UserIcon
            width={24}
            height={24}
            stroke={isFocused ? (isDark ? "#f8fafc" : "#0f172a") : (isDark ? "#64748b" : "#94a3b8")}
            strokeWidth={isFocused ? 2.5 : 2}
            fill="none"
          />
        )}
        {isFocused && (
          <View className="absolute -bottom-1 h-1 w-1 rounded-full bg-slate-900 dark:bg-slate-100" />
        )}
      </TouchableOpacity>
    );
  });

  // Use LiquidGlassView on iOS 26+, fallback to BlurView on older versions
  const glassContainerStyle = {
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
    shadowColor: isDark ? "#000" : "#64748b",
    shadowOffset: { width: 0, height: isDark ? 12 : 8 },
    shadowOpacity: isDark ? 0.5 : 0.12,
    shadowRadius: isDark ? 20 : 24,
    elevation: 10,
  };

  // Render content based on iOS version
  const renderGlassContainer = () => {
    if (LiquidGlassView) {
      // iOS 26+ with Liquid Glass effect
      return (
        <LiquidGlassView
          effect="regular"
          style={[liquidGlassStyles.glassView, glassContainerStyle, { width: tabBarWidth }]}
        >
          <View style={liquidGlassStyles.tabButtonsContainer}>
            {tabButtons}
          </View>
        </LiquidGlassView>
      );
    }

    // Fallback to BlurView for older iOS/Android
    return (
      <BlurView
        intensity={Platform.OS === "ios" ? 50 : 80}
        tint={isDark ? "dark" : "light"}
        style={[liquidGlassStyles.blurView, glassContainerStyle, { width: tabBarWidth }]}
      >
        <View style={liquidGlassStyles.tabButtonsContainer}>
          {tabButtons}
        </View>
      </BlurView>
    );
  };

  return (
    <View
      className="absolute left-0 right-0 items-center justify-center"
      style={{ bottom: tabBarBottomOffset }}
    >
      {renderGlassContainer()}
    </View>
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
  const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && windowWidth >= 1024;
  
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [isDrawerVisible, setIsDrawerVisible] = React.useState(false);
  const drawerProgress = useSharedValue(0);
  const [activeTab, setActiveTab] = React.useState<keyof HomeTabParamList>("Messages");
  
  const drawerWidth = useMemo(() => Math.min(240, windowWidth * 0.6), [windowWidth]);

  // Listen for drawer toggle requests from HomeScreen
  React.useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      DRAWER_STATE_EVENT,
      (payload: { requestOpen?: boolean }) => {
        if (payload.requestOpen !== undefined) {
          setIsDrawerOpen(payload.requestOpen);
        }
      }
    );
    return () => subscription.remove();
  }, []);

  // Smooth drawer progress for web
  React.useEffect(() => {
    if (isDrawerOpen) {
      setIsDrawerVisible(true);
      drawerProgress.value = withTiming(1, {
        duration: 260,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }

    drawerProgress.value = withTiming(
      0,
      { duration: 200, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(setIsDrawerVisible)(false);
        }
      }
    );
  }, [drawerProgress, isDrawerOpen]);

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(drawerProgress.value, [0, 1], [0, isDark ? 0.85 : 0.7]),
  }));

  const drawerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(drawerProgress.value, [0, 1], [-drawerWidth, 0]) },
    ],
    shadowOpacity: interpolate(drawerProgress.value, [0, 1], [0.05, 0.2]),
  }));

  const renderDrawerContent = useCallback(() => (
    <View
      style={{
        flex: 1,
        height: '100%',
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        backgroundColor: isDark ? "#0a0f1a" : "#ffffff",
        borderRightWidth: 0.5,
        borderRightColor: getBorderColor(isDark, 'contrast_low'),
      }}
    >
      <View className="px-5 py-6 border-b border-slate-100 dark:border-slate-800">
        <View className="flex-row items-center">
          <Image
            source={{
              uri: currentUser?.ProfileEntryResponse?.ExtraData?.ProfilePic
                ? `https://node.deso.org/api/v0/get-single-profile-picture/${currentUser.PublicKeyBase58Check}?fallback=${encodeURIComponent(currentUser.ProfileEntryResponse.ExtraData.ProfilePic)}`
                : buildProfilePictureUrl(currentUser?.PublicKeyBase58Check || "", {
                  fallbackImageUrl: FALLBACK_PROFILE_IMAGE,
                }),
            }}
            className="h-14 w-14 rounded-full bg-slate-200 dark:bg-slate-700"
          />
          <View className="ml-3 flex-1">
            <Text className="text-lg font-bold text-slate-900 dark:text-white" numberOfLines={1}>
              @{currentUser?.ProfileEntryResponse?.Username || "User"}
            </Text>
            <Text className="text-sm text-slate-500 dark:text-slate-400" numberOfLines={1}>
              {currentUser?.PublicKeyBase58Check?.slice(0, 12)}...
            </Text>
          </View>
        </View>
      </View>

      <View className="flex-1 py-4">
        <TouchableOpacity
          className="flex-row items-center px-5 py-4"
          activeOpacity={0.7}
          onPress={() => {
            setIsDrawerOpen(false);
            rootNavigation.navigate("Settings");
          }}
        >
          <View className="w-11 h-11 rounded-xl items-center justify-center bg-slate-100 dark:bg-slate-800">
            <Feather name="settings" size={22} color={isDark ? "#94a3b8" : "#64748b"} />
          </View>
          <Text className="ml-4 text-base font-medium text-slate-900 dark:text-white">
            Settings
          </Text>
          <View className="flex-1" />
          <Feather name="chevron-right" size={20} color={isDark ? "#64748b" : "#94a3b8"} />
        </TouchableOpacity>
      </View>
    </View>
  ), [currentUser, insets.top, insets.bottom, isDark, rootNavigation]);

  const renderTabNavigator = (tabBarOverride?: (props: BottomTabBarProps) => React.ReactNode) => (
    <Tab.Navigator
      tabBar={tabBarOverride ?? ((props) => <CustomTabBar {...props} />)}
      screenOptions={{
        headerShown: false,
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
      <Tab.Screen name="Messages" component={HomeScreen} />
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
    const tabNavigation = useNavigation<any>();
    
    const handleTabChange = (tab: keyof HomeTabParamList) => {
      tabNavigation.navigate(tab);
    };

    return (
      <View style={{ flex: 1, backgroundColor: isDark ? '#0a0f1a' : '#ffffff' }}>
        {/* Fixed Left Navigation */}
        <DesktopLeftNav 
          activeTab={activeTab} 
          onTabChange={handleTabChange}
        />
        
        {/* Main Content Area - centered with borders like Bluesky */}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <View
            style={{
              flex: 1,
              width: '100%',
              maxWidth: CENTER_CONTENT_MAX_WIDTH,
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
              // Left and right borders around center content
              borderLeftWidth: 1,
              borderRightWidth: 1,
              borderColor: getBorderColor(isDark, 'contrast_low'),
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



  // Web: Custom drawer implementation (non-desktop)
  if (Platform.OS === "web") {
    return (
      <View style={{ flex: 1 }}>
        {renderTabNavigator()}
        {isDrawerVisible && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }} pointerEvents="box-none">
            <Pressable
              onPress={() => setIsDrawerOpen(false)}
              style={[
                { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
              ]}
            >
              <Animated.View
                style={[
                  { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
                  overlayAnimatedStyle,
                  { backgroundColor: isDark ? '#000000' : '#000000' },
                ]}
                pointerEvents="none"
              />
            </Pressable>
            <Animated.View
              style={[
                { 
                  width: drawerWidth, 
                  height: "100%", 
                  position: "absolute", 
                  top: 0, 
                  left: 0,
                  borderRightWidth: 0.5,
                  borderRightColor: getBorderColor(isDark, 'contrast_low'),
                },
                drawerAnimatedStyle,
              ]}
              className="bg-white dark:bg-[#0a0f1a] shadow-2xl"
              pointerEvents="box-none"
            >
              {renderDrawerContent()}
            </Animated.View>
          </View>
        )}
      </View>
    );
  }

  // Native: Use Drawer component wrapping the tab navigator
  return (
    <Drawer
      open={isDrawerOpen}
      onOpen={() => setIsDrawerOpen(true)}
      onClose={() => setIsDrawerOpen(false)}
      renderDrawerContent={renderDrawerContent}
      drawerType={Platform.OS === "ios" ? "slide" : "front"}
      drawerStyle={{ width: drawerWidth }}
      overlayStyle={{ 
        backgroundColor: isDark 
          ? "rgba(10, 13, 16, 0.8)" 
          : "rgba(0, 57, 117, 0.1)" 
      }}
      swipeEnabled
      swipeEdgeWidth={windowWidth}
      swipeMinVelocity={100}
      swipeMinDistance={10}
    >
      {renderTabNavigator()}
    </Drawer>
  );
}

const liquidGlassStyles = StyleSheet.create({
  glassView: {
    borderRadius: 9999, // Full rounded (pill shape)
    overflow: "hidden",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  blurView: {
    borderRadius: 9999, // Full rounded (pill shape)
    overflow: "hidden",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  tabButtonsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
});
