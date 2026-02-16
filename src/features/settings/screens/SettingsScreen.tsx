import React, { useContext, useState } from "react";
import { View, Text, Pressable, TouchableOpacity, ScrollView, Platform, ActivityIndicator, LayoutAnimation } from "react-native";
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
import { useAuthTransition } from "@/state/auth/AuthTransitionProvider";
import { useWalletSwitcher } from "@/features/auth/hooks/useWalletSwitcher";
import { WalletList } from "@/features/auth/components/WalletList";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { UserAvatar } from "@/components/UserAvatar";
import { getProfileDisplayName, getProfileImageUrl, formatPublicKey } from "@/utils/deso";
import { PageTopBar, PageTopBarIconButton } from "@/components/ui/PageTopBar";

export function SettingsScreen({ navigation }: any) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { colorMode, setColorMode } = useAppearance();
  const { currentUser } = useContext(DeSoIdentityContext);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { startAuthTransition, endAuthTransition } = useAuthTransition();
  const { accounts } = useWalletSwitcher();
  const [showWallets, setShowWallets] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  
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
      startAuthTransition("logout");
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
      endAuthTransition();
    }
  };

  const profile = currentUser?.ProfileEntryResponse;
  const publicKey = currentUser?.PublicKeyBase58Check || "";
  const displayName = getProfileDisplayName(profile, publicKey);
  const username = profile?.Username || formatPublicKey(publicKey);
  const avatarUrl = getProfileImageUrl(publicKey);

  return (
    <DesktopShell>
      <ScreenWrapper
        backgroundColor={isDark ? "#0a0f1a" : "#ffffff"}
        edges={['top']}
      >
        <PageTopBar
          title="Settings"
          leftSlot={
            <PageTopBarIconButton
              onPress={handleBackPress}
              accessibilityLabel="Go back"
            >
              <Feather
                name="arrow-left"
                size={20}
                color={isDark ? "#f8fafc" : "#0f172a"}
              />
            </PageTopBarIconButton>
          }
        />

        <ScrollView>
          {/* Profile Card */}
          <View className="items-center py-8 px-4 border-b border-slate-200 dark:border-slate-800">
            <UserAvatar
              uri={avatarUrl}
              name={displayName}
              size={80}
            />
            <Text className="mt-3 text-xl font-bold text-slate-900 dark:text-white">
              {displayName}
            </Text>
            <Text className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              @{username}
            </Text>
          </View>

          {/* Switch Account Section */}
          {accounts.length > 1 && (
            <View className="border-b border-slate-200 dark:border-slate-800">
              <Pressable
                onPress={() => {
                  if (Platform.OS !== "web") {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  }
                  setShowWallets(!showWallets);
                }}
                className="flex-row items-center justify-between px-4 py-4 transition-colors duration-150 hover:bg-slate-200 dark:hover:bg-slate-800 active:opacity-80 cursor-pointer"
              >
                <View className="flex-row items-center gap-3">
                  <Feather name="users" size={20} color={isDark ? "#e2e8f0" : "#0f172a"} />
                  <Text className="text-base text-slate-900 dark:text-white">Switch account</Text>
                </View>
                {showWallets ? (
                  <Feather name="chevron-up" size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                ) : (
                  <AvatarStack maxVisible={3} size={24} />
                )}
              </Pressable>
              {showWallets && (
                <View className="px-4 pb-4">
                  <WalletList />
                </View>
              )}
            </View>
          )}

          {/* Appearance Section */}
          <View className="border-b border-slate-200 dark:border-slate-800">
            <Pressable
              onPress={() => {
                if (Platform.OS !== "web") {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                }
                setShowAppearance(!showAppearance);
              }}
              className="flex-row items-center justify-between px-4 py-4 transition-colors duration-150 hover:bg-slate-200 dark:hover:bg-slate-800 active:opacity-80 cursor-pointer"
            >
              <View className="flex-row items-center gap-3">
                <Feather name="droplet" size={20} color={isDark ? "#e2e8f0" : "#0f172a"} />
                <Text className="text-base text-slate-900 dark:text-white">Appearance</Text>
              </View>
              <Feather 
                name={showAppearance ? "chevron-up" : "chevron-right"} 
                size={20} 
                color={isDark ? "#94a3b8" : "#64748b"} 
              />
            </Pressable>

            {/* Appearance Content */}
            {showAppearance && (
              <View className="px-4 pb-4 bg-slate-50 dark:bg-slate-900/50">
                {/* Color Mode */}
                <View className="mb-4">
                  <Text className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Color Mode
                  </Text>
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

                {/* Theme Color */}
                <View>
                  <Text className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                    Theme Color
                  </Text>
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
            )}
          </View>


          {/* Sign Out */}
          <View className="pt-4 px-4 pb-8">
            <Pressable
              onPress={onLogout}
              disabled={isLoggingOut}
              className="py-4 rounded-xl px-3 -mx-3 transition-colors duration-150 hover:bg-slate-200 dark:hover:bg-slate-800 active:opacity-80 cursor-pointer"
            >
              <View className="flex-row items-center">
                {isLoggingOut ? (
                  <ActivityIndicator size="small" color={isDark ? "#fca5a5" : "#ef4444"} />
                ) : (
                  <Text className="text-base font-medium text-red-600 dark:text-red-400">
                    Sign out
                  </Text>
                )}
              </View>
            </Pressable>
          </View>
        </ScrollView>
      </ScreenWrapper>
    </DesktopShell>
  );
}
