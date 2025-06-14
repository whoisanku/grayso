import React, { useContext } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeTabs from "./HomeTabs";
import ComposerScreen from "../screens/ComposerScreen";
import LoginScreen from "../screens/LoginScreen";
import { DeSoIdentityContext } from "react-deso-protocol";

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { currentUser } = useContext(DeSoIdentityContext);

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
          </Stack.Group>
          <Stack.Group
            screenOptions={{ presentation: "modal", headerShown: true }}
          >
            <Stack.Screen name="Composer" component={ComposerScreen} />
          </Stack.Group>
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}
