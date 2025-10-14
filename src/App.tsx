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

WebBrowser.maybeCompleteAuthSession();

const redirectUri = AuthSession.makeRedirectUri({ useProxy: true } as any);

configure({
  redirectURI: redirectUri,
  identityPresenter: async (url) => {
    console.log("Opening auth session with URL:", url);
    const result = await WebBrowser.openAuthSessionAsync(url, redirectUri);
    console.log("Auth session result:", result);
    if (result.type === "success") {
      console.log("Handling redirect URI:", result.url);
      await identity.handleRedirectURI(result.url);
      console.log("Redirect URI handled successfully");
    } else {
      console.log("Auth session was not successful:", result.type);
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
