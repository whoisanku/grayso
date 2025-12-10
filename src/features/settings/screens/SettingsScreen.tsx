import React, { useContext, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Platform, ActivityIndicator } from "react-native";
import { useColorScheme } from "nativewind";
import ScreenWrapper from "../../../components/ScreenWrapper";
import { Feather } from "@expo/vector-icons";
import { useAccentColor } from "../../../state/theme/useAccentColor";
import { ACCENT_OPTIONS } from "../../../state/theme/AppThemeProvider";
import { DesktopShell } from "@/features/messaging/components/desktop/DesktopShell";
import { useAppearance } from "../../../state/theme/useAppearance";
import { SegmentedControl } from "../../../components/ui/SegmentedControl";
import { DeSoIdentityContext } from "react-deso-protocol";
import { identity } from "deso-protocol";
import { handleLogout } from "@/lib/auth";
import { Toast } from "@/components/ui/Toast";

export function SettingsScreen({ navigation }: any) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { colorMode, setColorMode } = useAppearance();
  const { currentUser } = useContext(DeSoIdentityContext);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  const {
    accentId,
    setAccentId,
  } = useAccentColor();

  const handleBackPress = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const onLogout = async () => {
    try {
      setIsLoggingOut(true);
      await handleLogout(() => identity.logout());
      Toast.show({
        type: "success",
        text1: "Signed out",
        text2: "Come back soon!",
      });
    } catch (error: any) {
      console.error("[SettingsScreen] Logout error:", error);
      Toast.show({
        type: "error",
        text1: "Logout failed",
        text2: error?.message || "Please try again",
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <DesktopShell>
      <ScreenWrapper
        backgroundColor={isDark ? "#0a0f1a" : "#ffffff"}
        edges={['top']}
      >
        <View className="flex-row items-center px-4 py-3 border-b border-slate-100 dark:border-slate-800">
           <TouchableOpacity 
             onPress={handleBackPress} 
             className="mr-3"
           >
              <Feather name="arrow-left" size={24} color={isDark ? "white" : "black"} />
           </TouchableOpacity>
           <Text className="text-xl font-bold text-slate-900 dark:text-white">Settings</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View className="mb-6">
             <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">Appearance</Text>
             <View 
               className="rounded-xl p-4"
               style={{ 
                 backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : 'rgba(241, 245, 249, 0.8)',
                 borderWidth: 1,
                 borderColor: isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.8)',
                 ...Platform.select({
                   web: {
                     // @ts-ignore - web-only CSS
                     transition: 'background-color 0.3s ease-in-out, border-color 0.3s ease-in-out',
                   },
                 }),
               }}
             >
               <View className="flex-row items-center mb-3">
                 <Feather 
                   name="smartphone" 
                   size={20} 
                   color={isDark ? "#94a3b8" : "#64748b"} 
                 />
                 <Text className="ml-2 text-base font-medium text-slate-900 dark:text-white">
                   Color Mode
                 </Text>
               </View>
               <SegmentedControl
                 items={[
                   { label: 'System', value: 'system' },
                   { label: 'Light', value: 'light' },
                   { label: 'Dark', value: 'dark' },
                 ]}
                 value={colorMode}
                 onChange={setColorMode}
                 label="Color mode"
               />
             </View>
          </View>

          <View className="mb-8">
            <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">
              Theme Color
            </Text>
            <View 
              className="rounded-2xl p-4"
              style={{ 
                backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : 'rgba(241, 245, 249, 0.8)',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.8)',
              }}
            >
              {/* Color Circles Row */}
              <View className="flex-row items-center justify-around">
                {ACCENT_OPTIONS.map((option) => {
                  const selected = option.id === accentId;
                  return (
                    <TouchableOpacity
                      key={option.id}
                      onPress={() => setAccentId(option.id)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: option.primary,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {selected && (
                          <Feather name="check" size={16} color={option.onPrimary} />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          <View>
             <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">About</Text>
             <View className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4">
                <Text className="text-base text-slate-900 dark:text-white">Version 1.0.0</Text>
             </View>
          </View>

          <View className="mt-8">
            <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
              Account
            </Text>
            <View
              className="rounded-2xl p-4 flex-row items-center gap-3"
              style={{
                backgroundColor: isDark ? "rgba(30, 41, 59, 0.6)" : "rgba(254, 242, 242, 0.9)",
                borderWidth: 1,
                borderColor: isDark ? "rgba(248, 113, 113, 0.3)" : "rgba(248, 113, 113, 0.4)",
              }}
            >
              <View className="flex-1">
                <Text className="text-base font-semibold text-slate-900 dark:text-white">
                  Log out
                </Text>
                <Text className="text-sm text-slate-600 dark:text-slate-300" numberOfLines={2}>
                  {currentUser?.ProfileEntryResponse?.Username
                    ? `Sign out of @${currentUser.ProfileEntryResponse.Username}`
                    : "Sign out of your account"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={onLogout}
                disabled={isLoggingOut}
                className="flex-row items-center px-4 py-2 rounded-xl"
                style={{
                  backgroundColor: isDark ? "rgba(248, 113, 113, 0.2)" : "#fee2e2",
                  opacity: isLoggingOut ? 0.7 : 1,
                }}
              >
                {isLoggingOut ? (
                  <ActivityIndicator size="small" color={isDark ? "#fca5a5" : "#ef4444"} />
                ) : (
                  <>
                    <Feather name="log-out" size={18} color={isDark ? "#fca5a5" : "#ef4444"} />
                    <Text className="ml-2 font-semibold text-red-600 dark:text-red-300">
                      Log out
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </ScreenWrapper>
    </DesktopShell>
  );
}
