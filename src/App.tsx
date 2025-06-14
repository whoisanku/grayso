import CryptoPolyfill from "react-native-webview-crypto";
import "react-native-gesture-handler";
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { DeSoIdentityProvider } from "react-deso-protocol";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { configure, identity } from "deso-protocol";
import RootNavigator from "./navigation/RootNavigator";

configure({
  redirectURI: AuthSession.makeRedirectUri(),
  identityPresenter: async (url) => {
    const result = await WebBrowser.openAuthSessionAsync(url);
    if (result.type === "success") {
      identity.handleRedirectURI(result.url);
    }
  },
  storageProvider: AsyncStorage,
  appName: "Starter App",
});

export default function App() {
  return (
    <DeSoIdentityProvider>
      <CryptoPolyfill />
      <SafeAreaProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </DeSoIdentityProvider>
  );
}
