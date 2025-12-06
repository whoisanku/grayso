import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useColorScheme } from "nativewind";
import ScreenWrapper from "../../../components/ScreenWrapper";
import { Feather } from "@expo/vector-icons";

export default function SettingsScreen({ navigation }: any) {
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

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
             onPress={toggleColorScheme}
             className="flex-row items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4"
           >
              <View className="flex-row items-center">
                 <Feather name={isDark ? "moon" : "sun"} size={20} color={isDark ? "white" : "black"} />
                 <Text className="ml-3 text-base font-medium text-slate-900 dark:text-white">Dark Mode</Text>
              </View>
              <View className={`h-6 w-11 rounded-full ${isDark ? 'bg-blue-500' : 'bg-slate-300'} justify-center px-1`}>
                 <View className={`h-4 w-4 rounded-full bg-white shadow-sm ${isDark ? 'self-end' : 'self-start'}`} />
              </View>
           </TouchableOpacity>
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
