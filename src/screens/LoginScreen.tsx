import React, { useContext, useState, useEffect } from "react";
import { View, Text, Button, ActivityIndicator } from "react-native";
import { identity } from "deso-protocol";
import { getTransactionSpendingLimits } from "../utils/deso";
import { DeSoIdentityContext } from "react-deso-protocol";

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
    <View className="flex-1 items-center justify-center p-5">
      <Text className="mb-5 text-2xl font-semibold text-slate-900">
        Login with DeSo
      </Text>
      {showLoading && (
        <ActivityIndicator
          size="large"
          color="#0000ff"
          className="my-2"
        />
      )}
      <Button
        title={showLoading ? "Logging in..." : "Login"}
        onPress={handleLogin}
        disabled={showLoading}
      />
      {currentUser && (
        <Text className="mt-5 text-xs text-slate-500">
          User detected: {currentUser.PublicKeyBase58Check?.substring(0, 10)}...
        </Text>
      )}
    </View>
  );
};

export default LoginScreen;
