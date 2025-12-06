import CryptoPolyfill from "./components/CryptoPolyfill";
import "react-native-gesture-handler";
import React from "react";
import { NavigationContainer, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { StatusBar } from "expo-status-bar";
import { DeSoIdentityProvider } from "react-deso-protocol";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { configure } from "deso-protocol";
import { getTransactionSpendingLimits } from "./utils/deso";
import RootNavigator from "./navigation/RootNavigator";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./state/queryClient";

// Web specific config if needed
configure({
  storageProvider: AsyncStorage,
  appName: "Starter App",
  spendingLimitOptions: getTransactionSpendingLimits(""),
});

export default function App() {
  const { colorScheme } = useColorScheme();

  return (
    <QueryClientProvider client={queryClient}>
      <DeSoIdentityProvider>
        <CryptoPolyfill />
        <SafeAreaProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
              <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
              <NavigationContainer theme={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
                <RootNavigator />
              </NavigationContainer>
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </DeSoIdentityProvider>
    </QueryClientProvider>
  );
}
