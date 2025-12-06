import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import HomeScreen from "../view/screens/HomeScreen";
import ProfileScreen from "../view/screens/profile/ProfileScreen";
import MessageIcon from "../assets/navIcons/message.svg";
import UserIcon from "../assets/navIcons/user.svg";
import PlusIcon from "../assets/navIcons/plus.svg";
import { View, TouchableOpacity, Platform, StyleSheet } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { type HomeTabParamList, type RootStackParamList } from "./types";
import { BlurView } from "expo-blur";
import { LiquidGlassView, isIOS26OrAbove } from "../utils/liquidGlass";

import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useColorScheme } from "nativewind";

const Tab = createBottomTabNavigator<HomeTabParamList>();
const DummyComponent = () => <View />;

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

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
          className="mx-4 h-14 w-14 items-center justify-center rounded-full bg-[#0085ff]"
          style={{
            shadowColor: "#0085ff",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 5,
          }}
        >
          <PlusIcon width={24} height={24} stroke="white" strokeWidth={2.5} />
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
          style={[liquidGlassStyles.glassView, glassContainerStyle]}
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
        style={[liquidGlassStyles.blurView, glassContainerStyle]}
      >
        <View style={liquidGlassStyles.tabButtonsContainer}>
          {tabButtons}
        </View>
      </BlurView>
    );
  };

  return (
    <View className="absolute bottom-8 left-0 right-0 items-center justify-center">
      {renderGlassContainer()}
    </View>
  );
}

type HomeTabsProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Main">;
};

export default function HomeTabs({ navigation }: HomeTabsProps) {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
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
}

const liquidGlassStyles = StyleSheet.create({
  glassView: {
    width: "65%",
    borderRadius: 9999, // Full rounded (pill shape)
    overflow: "hidden",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  blurView: {
    width: "65%",
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
