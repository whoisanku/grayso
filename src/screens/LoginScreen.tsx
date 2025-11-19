import React, { useState, useEffect } from "react";
import { View, Text, Button, ActivityIndicator, TextInput, TouchableOpacity, Alert, ScrollView } from "react-native";
import { identity } from "deso-protocol";
import { getTransactionSpendingLimits } from "../utils/deso";
import { useAuth } from "../contexts/AuthContext";

const LoginScreen = () => {
  const { currentUser, isLoading, loginWithSeed } = useAuth();
  const [localLoading, setLocalLoading] = useState(false);
  const [showSeedInput, setShowSeedInput] = useState(false);
  const [seedPhrase, setSeedPhrase] = useState("");

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

  const handleSeedLogin = async () => {
    if (!seedPhrase.trim()) {
      Alert.alert("Error", "Please enter your seed phrase");
      return;
    }
    
    try {
      setLocalLoading(true);
      await loginWithSeed(seedPhrase.trim());
    } catch (e) {
      console.error("Seed login error:", e);
      Alert.alert("Login Failed", "Invalid seed phrase or network error.");
      setLocalLoading(false);
    }
  };

  const showLoading = isLoading || localLoading;

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}>
      <View className="items-center">
        <Text className="mb-8 text-3xl font-bold text-slate-900 dark:text-white">
          Welcome to Grayso
        </Text>
        
        {showLoading && (
          <ActivityIndicator
            size="large"
            color="#4f46e5"
            className="mb-4"
          />
        )}

        {!showSeedInput ? (
          <View className="w-full max-w-xs gap-4">
            <TouchableOpacity
              onPress={handleLogin}
              disabled={showLoading}
              className="w-full rounded-full bg-indigo-600 py-4 active:bg-indigo-700"
            >
              <Text className="text-center font-bold text-white">
                Log in with DeSo Identity
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowSeedInput(true)}
              disabled={showLoading}
              className="w-full rounded-full border-2 border-slate-200 py-3.5 active:bg-slate-50 dark:border-slate-700 dark:active:bg-slate-800"
            >
              <Text className="text-center font-semibold text-slate-700 dark:text-slate-300">
                Log in with Seed Phrase
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="w-full max-w-xs">
            <Text className="mb-2 font-medium text-slate-700 dark:text-slate-300">
              Enter Seed Phrase
            </Text>
            <TextInput
              className="mb-4 min-h-[100px] w-full rounded-xl border border-slate-300 bg-white p-4 text-base leading-6 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              multiline
              placeholder="Enter your 12-word seed phrase..."
              placeholderTextColor="#94a3b8"
              value={seedPhrase}
              onChangeText={setSeedPhrase}
              autoCapitalize="none"
              autoCorrect={false}
            />
            
            <TouchableOpacity
              onPress={handleSeedLogin}
              disabled={showLoading}
              className="mb-3 w-full rounded-full bg-indigo-600 py-4 active:bg-indigo-700"
            >
              <Text className="text-center font-bold text-white">
                Log In
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowSeedInput(false)}
              disabled={showLoading}
              className="w-full py-2"
            >
              <Text className="text-center font-medium text-slate-500 dark:text-slate-400">
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {currentUser && (
          <Text className="mt-8 text-xs text-slate-400">
            User detected: {currentUser.PublicKeyBase58Check?.substring(0, 10)}...
          </Text>
        )}
      </View>
    </ScrollView>
  );
};

export default LoginScreen;
