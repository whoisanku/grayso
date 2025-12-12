import React from "react";
import { View, Text, Modal, TouchableOpacity, Platform } from "react-native";
import { useColorScheme } from "nativewind";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { WalletList } from "./WalletList";
import { getBorderColor } from "@/theme/borders";

type SwitchWalletDialogProps = {
  visible: boolean;
  onClose: () => void;
};

export function SwitchWalletDialog({ visible, onClose }: SwitchWalletDialogProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType={Platform.OS === "web" ? "fade" : "slide"}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        className="flex-1 justify-end"
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.5)",
        }}
      >
        {/* Modal Content - prevent close on content press */}
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View
            className={Platform.OS === "web" ? "mx-auto max-w-md w-full" : "w-full"}
            style={{
              backgroundColor: isDark ? "#0f172a" : "#ffffff",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingBottom: Platform.OS === "web" ? 24 : Math.max(insets.bottom, 16),
              paddingTop: 8,
              borderTopWidth: 1,
              borderLeftWidth: Platform.OS === "web" ? 1 : 0,
              borderRightWidth: Platform.OS === "web" ? 1 : 0,
              borderColor: getBorderColor(isDark, "contrast_low"),
              ...(Platform.OS === "web" && {
                borderBottomLeftRadius: 24,
                borderBottomRightRadius: 24,
                borderBottomWidth: 1,
                marginBottom: 24,
              }),
            }}
          >
            {/* Handle Bar (mobile only) */}
            {Platform.OS !== "web" && (
              <View className="items-center py-2">
                <View
                  style={{
                    width: 36,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: isDark ? "rgba(148, 163, 184, 0.3)" : "rgba(100, 116, 139, 0.3)",
                  }}
                />
              </View>
            )}

            {/* Header */}
            <View className="flex-row items-center justify-between px-5 py-3">
              <Text className="text-2xl font-semibold text-slate-900 dark:text-white">
                Switch Wallet
              </Text>
              <TouchableOpacity
                onPress={onClose}
                className="p-2 rounded-full"
                style={{
                  backgroundColor: isDark ? "rgba(51, 65, 85, 0.5)" : "rgba(226, 232, 240, 0.8)",
                }}
              >
                <Feather name="x" size={20} color={isDark ? "#94a3b8" : "#64748b"} />
              </TouchableOpacity>
            </View>

            {/* Wallet List */}
            <View className="px-5 pb-2">
              <WalletList
                onSelectWallet={onClose}
                onSelectAddWallet={onClose}
              />
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
