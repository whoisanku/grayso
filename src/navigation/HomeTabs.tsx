import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import HomeScreen from "../screens/HomeScreen";
import ProfileScreen from "../screens/ProfileScreen";
import MessageIcon from "../assets/navIcons/message.svg";
import UserIcon from "../assets/navIcons/user.svg";
import PlusIcon from "../assets/navIcons/plus.svg";
import { View, TouchableOpacity } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { type HomeTabParamList, type RootStackParamList } from "./types";

import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Platform } from "react-native";
import { useColorScheme } from "nativewind";

const Tab = createBottomTabNavigator<HomeTabParamList>();
const DummyComponent = () => <View />;

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <View className="absolute bottom-8 left-0 right-0 items-center justify-center">
      <View
        className="flex-row items-center justify-between rounded-full bg-white px-6 py-3 shadow-lg shadow-slate-200 dark:bg-slate-800 dark:shadow-slate-900"
        style={{
          shadowColor: isDark ? "#0f172a" : "#64748b",
          shadowOffset: {
            width: 0,
            height: 8,
          },
          shadowOpacity: isDark ? 0.3 : 0.1,
          shadowRadius: 24,
          elevation: 10,
          width: "65%", // Compact width
        }}
      >
        {state.routes.map((route, index) => {
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
                // Handle Post button separately if needed, mostly handled by listener or component
                navigation.navigate("Composer");
              } else {
                navigation.navigate(route.name);
              }
            }
          };

          if (route.name === "Post") {
            return (
              <TouchableOpacity
                key={route.key}
                onPress={() => navigation.navigate("Composer")}
                activeOpacity={0.8}
                className="mx-4 h-14 w-14 items-center justify-center rounded-full bg-black shadow-md shadow-slate-400 dark:bg-indigo-500 dark:shadow-slate-900"
                style={{
                   shadowColor: isDark ? "#000" : "#000",
                   shadowOffset: { width: 0, height: 4 },
                   shadowOpacity: 0.2,
                   shadowRadius: 8,
                   elevation: 5
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
        })}
      </View>
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
