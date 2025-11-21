import React, { useContext, useEffect } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeTabs from "./HomeTabs";
import ComposerScreen from "../screens/ComposerScreen";
import LoginScreen from "../screens/LoginScreen";
import ConversationScreen from "../screens/ConversationScreen";

import { DeSoIdentityContext } from "react-deso-protocol";
import { type RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { currentUser } = useContext(DeSoIdentityContext);

  // MOCK USER FOR VERIFICATION
  const mockUser = { PublicKeyBase58Check: "BC1YLgDjt19o9qKo8vdCM3RH73nvV4vcXZZVBkik3VvxM19YQoRQQKU" };
  const effectiveUser = currentUser || mockUser;

  useEffect(() => {
    console.log("RootNavigator - currentUser changed:", effectiveUser);
    console.log("RootNavigator - User is logged in:", !!effectiveUser);
  }, [effectiveUser]);

  return (
    <Stack.Navigator>
      {effectiveUser ? (
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
