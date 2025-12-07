import React from "react";
import { View, Text, TouchableOpacity, ScrollView, Platform } from "react-native";
import { useColorScheme } from "nativewind";
import ScreenWrapper from "../../../components/ScreenWrapper";
import { Feather } from "@expo/vector-icons";
import { useAccentColor } from "../../../state/theme/useAccentColor";
import { ACCENT_OPTIONS } from "../../../state/theme/AppThemeProvider";

export default function SettingsScreen({ navigation }: any) {
  const { colorScheme, setColorScheme, toggleColorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const {
    accentId,
    setAccentId,
    accentColor,
    accentStrong,
    accentSurface,
    accentSoft,
  } = useAccentColor();

  const handleToggle = () => {
    const newScheme = isDark ? "light" : "dark";
    
    // For web, we need to update the DOM class as well
    if (Platform.OS === "web") {
      setColorScheme(newScheme);
      // Update the root element class for web
      if (typeof document !== "undefined") {
        document.documentElement.classList.remove("dark", "light");
        document.documentElement.classList.add(newScheme);
        // Persist to localStorage
        localStorage.setItem("colorScheme", newScheme);
      }
    } else {
      toggleColorScheme();
    }
  };

  return (
    <ScreenWrapper
      backgroundColor={isDark ? "#0a0f1a" : "#ffffff"}
      edges={['top', 'left', 'right']}
    >
      <View className="flex-row items-center px-4 py-3 border-b border-slate-100 dark:border-slate-800">
         <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3">
            <Feather name="arrow-left" size={24} color={isDark ? "white" : "black"} />
         </TouchableOpacity>
         <Text className="text-xl font-bold text-slate-900 dark:text-white">Settings</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View className="mb-6">
           <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Appearance</Text>
           <TouchableOpacity
             onPress={handleToggle}
             className="flex-row items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4"
             style={{ borderWidth: 1, borderColor: isDark ? "#1f2937" : "#e2e8f0" }}
           >
              <View className="flex-row items-center">
                 <Feather name={isDark ? "moon" : "sun"} size={20} color={isDark ? "white" : "black"} />
                 <Text className="ml-3 text-base font-medium text-slate-900 dark:text-white">Dark Mode</Text>
              </View>
              <View
                className="h-6 w-11 rounded-full justify-center px-1"
                style={{ backgroundColor: isDark ? accentStrong : "#cbd5e1" }}
              >
                 <View
                   className="h-4 w-4 rounded-full bg-white shadow-sm"
                   style={{ alignSelf: isDark ? "flex-end" : "flex-start", backgroundColor: isDark ? "#fff" : "#fff" }}
                 />
              </View>
           </TouchableOpacity>
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
  );
}
