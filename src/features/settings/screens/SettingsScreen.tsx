import React, { useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView, Platform, DeviceEventEmitter, useWindowDimensions } from "react-native";
import { useColorScheme } from "nativewind";
import ScreenWrapper from "../../../components/ScreenWrapper";
import { Feather } from "@expo/vector-icons";
import { useAccentColor } from "../../../state/theme/useAccentColor";
import { ACCENT_OPTIONS } from "../../../state/theme/AppThemeProvider";
import { DesktopShell } from "@/features/messaging/components/desktop/DesktopShell";
import { useAppearance } from "../../../state/theme/useAppearance";
import { SegmentedControl } from "../../../components/ui/SegmentedControl";

export function SettingsScreen({ navigation }: any) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { colorMode, setColorMode } = useAppearance();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && windowWidth >= 1024;
  
  const {
    accentId,
    setAccentId,
    accentColor,
    accentStrong,
    accentSurface,
    accentSoft,
  } = useAccentColor();

  const handleBackPress = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
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
        </ScrollView>
      </ScreenWrapper>
    </DesktopShell>
  );
}

