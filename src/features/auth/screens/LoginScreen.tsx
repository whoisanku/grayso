import React, { useContext, useState, useEffect, useRef } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity, Animated } from "react-native";
import { identity } from "deso-protocol";
import { getTransactionSpendingLimits } from "../../../utils/deso";
import { DeSoIdentityContext } from "react-deso-protocol";
import AppLogo from "../../../assets/app-logo.svg";
import ScreenWrapper from "../../../components/ScreenWrapper";
import { useColorScheme } from "nativewind";

const LoginScreen = () => {
  const { currentUser, isLoading } = useContext(DeSoIdentityContext);
  const { colorScheme } = useColorScheme();
  const [localLoading, setLocalLoading] = useState(false);
  
  // Animation refs
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const buttonTranslateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    // Entrance animations
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(buttonTranslateY, {
          toValue: 0,
          friction: 8,
          tension: 50,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      setLocalLoading(false);
    }
  }, [isLoading]);

  const handleLogin = async () => {
    try {
      setLocalLoading(true);
      await identity.login({
        spendingLimitOptions: getTransactionSpendingLimits(""),
      } as any);
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
  const isDark = colorScheme === "dark";

  return (
    <ScreenWrapper keyboardAvoiding>
      <View className="flex-1 items-center justify-center px-8">
        {/* Logo with animation */}
        <Animated.View
          style={{
            transform: [{ scale: logoScale }],
            opacity: logoOpacity,
          }}
          className="mb-12 items-center"
        >
          <View className="h-28 w-28 items-center justify-center overflow-hidden rounded-[32px] shadow-2xl shadow-blue-400/30 dark:shadow-blue-500/20">
            <AppLogo width="100%" height="100%" />
          </View>
        </Animated.View>

        {/* Content with animation */}
        <Animated.View
          style={{
            opacity: contentOpacity,
            transform: [{ translateY: buttonTranslateY }],
          }}
          className="w-full max-w-xs items-center"
        >
          <Text className="mb-2 text-center text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            DeSo Chat
          </Text>
          <Text className="mb-10 text-center text-base text-slate-500 dark:text-slate-400">
            Decentralized messaging
          </Text>

          {showLoading ? (
            <View className="h-14 w-full items-center justify-center">
              <ActivityIndicator size="small" color="#0085ff" />
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleLogin}
              activeOpacity={0.85}
              className="w-full items-center justify-center rounded-2xl bg-[#0085ff] py-4 shadow-lg shadow-blue-500/30 active:scale-[0.98] dark:shadow-blue-500/20"
              style={{
                shadowColor: "#0085ff",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.3,
                shadowRadius: 16,
                elevation: 8,
              }}
            >
              <Text className="text-[17px] font-semibold tracking-tight text-white">
                Continue with DeSo
              </Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>
    </ScreenWrapper>
  );
};

export default LoginScreen;

