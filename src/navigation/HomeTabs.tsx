import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import HomeScreen from "../screens/HomeScreen";
import ProfileScreen from "../screens/ProfileScreen";
import CloudIcon from "../assets/navIcons/cloud.svg";
import UserIcon from "../assets/navIcons/user.svg";
import PlusIcon from "../assets/navIcons/plus.svg";
import { View, TouchableOpacity } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

const Tab = createBottomTabNavigator();
const DummyComponent = () => <View />;

type RootStackParamList = {
  Main: undefined;
  Composer: undefined;
};

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
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <CloudIcon width={size} height={size} stroke={color} fill="none" />
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
