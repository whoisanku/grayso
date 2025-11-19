import React, { useContext, useEffect } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeTabs from "./HomeTabs";
import ComposerScreen from "../screens/ComposerScreen";
import LoginScreen from "../screens/LoginScreen";
import ConversationScreen from "../screens/ConversationScreen";

import { useAuth } from "../contexts/AuthContext";
import { type RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { currentUser } = useAuth();

  useEffect(() => {
    console.log("RootNavigator - currentUser changed:", currentUser);
    console.log("RootNavigator - User is logged in:", !!currentUser);
  }, [currentUser]);

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
          </Stack.Group>
          <Stack.Group
            screenOptions={{ presentation: "modal", headerShown: false }}
          >
            <Stack.Screen name="Composer" component={ComposerScreen} />
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
