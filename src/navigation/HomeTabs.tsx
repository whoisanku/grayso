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

const Tab = createBottomTabNavigator<HomeTabParamList>();
const DummyComponent = () => <View />;

type HomeTabsProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Main">;
};

export default function HomeTabs({ navigation }: HomeTabsProps) {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarLabelStyle: {
          fontSize: 14,
        },
        tabBarActiveTintColor: "blue",
      }}
    >
      <Tab.Screen
        name="Messages"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MessageIcon width={size} height={size} stroke={color} fill="none" />
          ),
        }}
      />
      <Tab.Screen
        name="Post"
        component={DummyComponent}
        options={{
          tabBarIcon: ({ color, size }) => (
            <PlusIcon width={size} height={size} stroke={color} fill="none" />
          ),
          tabBarButton: ({ children, style, accessibilityState }) => (
            <TouchableOpacity
              style={style}
              onPress={() => navigation.navigate("Composer")}
              accessibilityState={accessibilityState}
            >
              {children}
            </TouchableOpacity>
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <UserIcon width={size} height={size} stroke={color} fill="none" />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
