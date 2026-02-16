import React from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

const WEB_FALLBACK_URL =
  process.env.EXPO_PUBLIC_WEB_APP_URL ?? "https://grayso.vercel.app";

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView
        style={{ flex: 1, backgroundColor: "#020617", paddingHorizontal: 24 }}
      >
        <StatusBar style="light" />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text
            style={{
              color: "#f8fafc",
              fontSize: 26,
              fontWeight: "700",
              textAlign: "center",
            }}
          >
            Grayso Is Web + PWA Only
          </Text>
          <Text
            style={{
              marginTop: 12,
              color: "#94a3b8",
              fontSize: 15,
              lineHeight: 22,
              textAlign: "center",
              maxWidth: 420,
            }}
          >
            This build is intentionally disabled on iOS and Android native apps.
            Open Grayso in your browser or install the PWA instead.
          </Text>

          <Pressable
            onPress={() => Linking.openURL(WEB_FALLBACK_URL)}
            style={{
              marginTop: 24,
              borderRadius: 999,
              backgroundColor: "#2563eb",
              paddingHorizontal: 18,
              paddingVertical: 12,
            }}
            accessibilityRole="button"
            accessibilityLabel="Open Grayso web app"
          >
            <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "700" }}>
              Open Web App
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
