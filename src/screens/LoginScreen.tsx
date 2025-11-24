import React, { useContext, useState, useEffect } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity } from "react-native";
import { identity } from "deso-protocol";
import { getTransactionSpendingLimits } from "../utils/deso";
import { DeSoIdentityContext } from "react-deso-protocol";
import AppLogo from "../assets/app-logo.svg";

const LoginScreen = () => {
  const { currentUser, isLoading } = useContext(DeSoIdentityContext);
  const [localLoading, setLocalLoading] = useState(false);

  useEffect(() => {
    console.log("LoginScreen - currentUser:", currentUser);
    console.log("LoginScreen - isLoading:", isLoading);
  }, [currentUser, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      setLocalLoading(false);
    }
  }, [isLoading]);

  const handleLogin = async () => {
    try {
      setLocalLoading(true);
      console.log("Starting login...");
      // Provide spending limits so derived key is authorized for messaging
      const result = await identity.login({
        spendingLimitOptions: getTransactionSpendingLimits(""),
      } as any);
      console.log("Login result:", result);
      // Don't set loading to false here - let the context handle it
    } catch (e) {
      console.error("Login error:", e);
      setLocalLoading(false);
    } finally {
      if (!isLoading) {
        setLocalLoading(false);
      }
    }
  };

  const showLoading = isLoading || localLoading;

  return (
    <View className="flex-1 items-center justify-center bg-white p-5 dark:bg-black">
      <View className="mb-10 items-center">
        <View className="h-24 w-24 items-center justify-center overflow-hidden rounded-3xl shadow-xl shadow-blue-300 dark:shadow-none">
          <AppLogo width="100%" height="100%" />
        </View>
        <Text className="mt-6 text-3xl font-bold text-slate-900 dark:text-white">
          DeSo Chat
        </Text>
        <Text className="mt-2 text-base text-slate-500 dark:text-slate-400">
          Connect with your friends
        </Text>
      </View>

      <View className="w-full max-w-sm">
        {showLoading ? (
          <View className="py-4">
            <ActivityIndicator size="large" color="#0085ff" />
            <Text className="mt-4 text-center text-sm font-medium text-slate-500">
              Connecting to DeSo...
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            onPress={handleLogin}
            activeOpacity={0.8}
            className="w-full items-center justify-center rounded-full bg-[#0085ff] py-4 shadow-lg shadow-blue-200 dark:shadow-none"
          >
            <Text className="text-lg font-bold text-white">Login with DeSo</Text>
          </TouchableOpacity>
        )}
      </View>

      {currentUser && (
        <Text className="absolute bottom-10 text-xs text-slate-400">
          Logged in as: {currentUser.PublicKeyBase58Check?.substring(0, 10)}...
        </Text>
      )}
    </View>
  );
};

export default LoginScreen;
