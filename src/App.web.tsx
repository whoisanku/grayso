import CryptoPolyfill from "./components/CryptoPolyfill";
import "react-native-gesture-handler";
import React, { useEffect } from "react";
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
import { AppThemeProvider } from "./state/theme/AppThemeProvider";

// Web specific config if needed
configure({
  storageProvider: AsyncStorage,
  appName: "Grayso",
  spendingLimitOptions: getTransactionSpendingLimits(""),
});

export default function App() {
  const { colorScheme, setColorScheme } = useColorScheme();

  // Restore saved color scheme from localStorage on mount
  useEffect(() => {
    document.title = "Grayso";
    
    // Check localStorage for saved theme
    const savedScheme = localStorage.getItem("colorScheme") as "light" | "dark" | null;
    if (savedScheme) {
      setColorScheme(savedScheme);
      // Update DOM class
      document.documentElement.classList.remove("dark", "light");
      document.documentElement.classList.add(savedScheme);
    }
  }, [setColorScheme]);

  return (
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider>
        <DeSoIdentityProvider>
          <CryptoPolyfill />
          <SafeAreaProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
                <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
                <NavigationContainer
                  theme={colorScheme === "dark" ? DarkTheme : DefaultTheme}
                  documentTitle={{ formatter: () => "Grayso" }}
                >
                  <RootNavigator />
                </NavigationContainer>
            </GestureHandlerRootView>
          </SafeAreaProvider>
        </DeSoIdentityProvider>
      </AppThemeProvider>
    </QueryClientProvider>
  );
}
