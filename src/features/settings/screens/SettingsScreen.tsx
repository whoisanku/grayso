import React, { useContext } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { DeSoIdentityContext } from "react-deso-protocol";
import { identity } from "deso-protocol";
import { LiquidGlassView } from "../../../utils/liquidGlass";
import { RootStackParamList } from "../../../navigation/types";

type SettingsNavigationProp = NativeStackNavigationProp<RootStackParamList, "Settings">;

type SettingRowProps = {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value?: React.ReactNode;
  onPress?: () => void;
  isDark: boolean;
  isDestructive?: boolean;
};

function SettingRow({ icon, label, value, onPress, isDark, isDestructive }: SettingRowProps) {
  const content = (
    <View className="flex-row items-center justify-between py-4 px-4">
      <View className="flex-row items-center">
        <View className={`w-9 h-9 rounded-xl items-center justify-center ${isDestructive ? 'bg-red-100 dark:bg-red-900/30' : 'bg-slate-100 dark:bg-slate-800'}`}>
          <Feather 
            name={icon} 
            size={18} 
            color={isDestructive ? "#ef4444" : (isDark ? "#94a3b8" : "#64748b")} 
          />
        </View>
        <Text className={`ml-3 text-base ${isDestructive ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>
          {label}
        </Text>
      </View>
      {value !== undefined && value}
      {onPress && !value && (
        <Feather name="chevron-right" size={20} color={isDark ? "#64748b" : "#94a3b8"} />
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

export default function SettingsScreen() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const navigation = useNavigation<SettingsNavigationProp>();
  const { currentUser } = useContext(DeSoIdentityContext);

  const handleLogout = async () => {
    try {
      await identity.logout();
      navigation.reset({
        index: 0,
        routes: [{ name: "Login" }],
      });
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const toggleTheme = () => {
    setColorScheme(isDark ? "light" : "dark");
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-[#0a0f1a]">
      {/* Header */}
      <View className="flex-row items-center px-4 py-4 border-b border-slate-100 dark:border-slate-800">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="mr-3"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {LiquidGlassView ? (
            <LiquidGlassView
              effect="regular"
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Feather name="chevron-left" size={22} color={isDark ? "#fff" : "#000"} />
            </LiquidGlassView>
          ) : (
            <Feather name="chevron-left" size={24} color={isDark ? "#fff" : "#000"} />
          )}
        </TouchableOpacity>
        <Text className="text-xl font-bold text-slate-900 dark:text-white">
          Settings
        </Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Appearance Section */}
        <View className="mt-6">
          <Text className="px-4 mb-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Appearance
          </Text>
          <View className="bg-white dark:bg-[#0a0f1a] border-t border-b border-slate-100 dark:border-slate-800">
            <SettingRow
              icon="moon"
              label="Dark Mode"
              isDark={isDark}
              value={
                <Switch
                  value={isDark}
                  onValueChange={toggleTheme}
                  trackColor={{ false: "#e2e8f0", true: "#3b82f6" }}
                  thumbColor="white"
                />
              }
            />
          </View>
        </View>

        {/* Account Section */}
        <View className="mt-6">
          <Text className="px-4 mb-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Account
          </Text>
          <View className="bg-white dark:bg-[#0a0f1a] border-t border-b border-slate-100 dark:border-slate-800">
            <SettingRow
              icon="log-out"
              label="Sign Out"
              isDark={isDark}
              isDestructive
              onPress={handleLogout}
            />
          </View>
        </View>

        {/* App Info */}
        <View className="mt-8 items-center pb-8">
          <Text className="text-xs text-slate-400 dark:text-slate-500">
            Version 1.0.0
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
