import React, { useContext, useEffect, useState } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, Animated } from "react-native";
import HomeTabs from "./HomeTabs";
import ComposerScreen from "../features/messaging/screens/ComposerScreen";
import LoginScreen from "../features/auth/screens/LoginScreen";
import ConversationScreen from "../features/messaging/screens/ConversationScreen";
import SettingsScreen from "../features/settings/screens/SettingsScreen";
import NewChatScreen from "../features/messaging/screens/NewChatScreen";
import AppLogo from "../assets/app-logo.svg";
import { useColorScheme } from "nativewind";

import { DeSoIdentityContext } from "react-deso-protocol";
import { type RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { currentUser, isLoading } = useContext(DeSoIdentityContext);
  const { colorScheme } = useColorScheme();
  const [showSplash, setShowSplash] = useState(true);
  const fadeAnim = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Once we know the auth state (isLoading becomes false), fade out splash
    if (!isLoading && showSplash) {
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setShowSplash(false);
        });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isLoading, showSplash, fadeAnim]);

  // Show splash while checking initial auth state
  if (showSplash) {
    return (
      <Animated.View
        style={{ flex: 1, opacity: fadeAnim }}
        className={`flex-1 items-center justify-center ${
          colorScheme === "dark" ? "bg-[#0a0f1a]" : "bg-white"
        }`}
      >
        <View className="h-20 w-20 items-center justify-center overflow-hidden rounded-2xl">
          <AppLogo width="100%" height="100%" />
        </View>
      </Animated.View>
    );
  }

  return (
    <Stack.Navigator>
      {currentUser ? (
        <>
          <Stack.Group>
            <Stack.Screen
              name="Main"
              component={HomeTabs}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Conversation"
              component={ConversationScreen}
              options={{ headerShown: true }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ headerShown: false }}
            />
          </Stack.Group>
          <Stack.Group
            screenOptions={{ presentation: "modal", headerShown: false }}
          >
            <Stack.Screen name="Composer" component={ComposerScreen} />
            <Stack.Screen name="NewChat" component={NewChatScreen} />
          </Stack.Group>
        </>
      ) : (
        <Stack.Screen 
          name="Login" 
          component={LoginScreen}
          options={{ headerShown: false }}
        />
      )}
    </Stack.Navigator>
  );
}

