import React, { useCallback } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useColorScheme } from "nativewind";
import { Feather } from "@expo/vector-icons";

import { UserAvatar } from "@/components/UserAvatar";
import { useWalletSwitcher, type WalletAccount } from "@/features/auth/hooks/useWalletSwitcher";
import { getBorderColor } from "@/theme/borders";

type WalletListProps = {
  onSelectWallet?: (account: WalletAccount) => void;
  onSelectAddWallet?: () => void;
  addWalletLabel?: string;
};

export function WalletList({
  onSelectWallet,
  onSelectAddWallet,
  addWalletLabel = "Add wallet",
}: WalletListProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { accounts, pendingAction, switchToPublicKey, addWallet } = useWalletSwitcher();

  const handleSelectWallet = useCallback(
    (account: WalletAccount) => {
      if (account.isCurrent) {
        return; // Already on this wallet
      }
      onSelectWallet?.(account);
      switchToPublicKey(account.publicKey);
    },
    [onSelectWallet, switchToPublicKey]
  );

  const handleAddWallet = useCallback(() => {
    onSelectAddWallet?.();
    addWallet();
  }, [onSelectAddWallet, addWallet]);

  const isPending = !!pendingAction;

  return (
    <View
      style={{
        borderRadius: 12,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: getBorderColor(isDark, "contrast_low"),
        backgroundColor: isDark ? "rgba(30, 41, 59, 0.5)" : "rgba(255, 255, 255, 0.95)",
      }}
      className="overflow-hidden"
    >
      {accounts.map((account, index) => (
        <React.Fragment key={account.publicKey}>
          <WalletItem
            account={account}
            onSelect={handleSelectWallet}
            isPending={isPending && pendingAction?.type === "switch" && pendingAction?.publicKey === account.publicKey}
            disabled={isPending}
          />
          {index < accounts.length - 1 && (
            <View
              style={{
                height: 1,
                backgroundColor: getBorderColor(isDark, "subtle"),
              }}
            />
          )}
        </React.Fragment>
      ))}
      
      {/* Divider before Add Wallet */}
      <View
        style={{
          height: 1,
          backgroundColor: getBorderColor(isDark, "subtle"),
        }}
      />
      
      {/* Add Wallet Button */}
      <TouchableOpacity
        onPress={isPending ? undefined : handleAddWallet}
        disabled={isPending}
        activeOpacity={0.7}
        className="flex-1"
      >
        <View
          className="flex-1 flex-row items-center p-4 gap-3"
          style={{
            opacity: isPending ? 0.5 : 1,
          }}
        >
          <View
            className="rounded-full justify-center items-center"
            style={{
              width: 48,
              height: 48,
              backgroundColor: isDark ? "rgba(51, 65, 85, 0.5)" : "rgba(226, 232, 240, 0.8)",
            }}
          >
            <Feather name="plus" size={20} color={isDark ? "#94a3b8" : "#64748b"} />
          </View>
          <Text className="flex-1 text-base font-medium text-slate-900 dark:text-white">
            {addWalletLabel}
          </Text>
          <Feather name="chevron-right" size={20} color={isDark ? "#94a3b8" : "#64748b"} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

type WalletItemProps = {
  account: WalletAccount;
  onSelect: (account: WalletAccount) => void;
  isPending: boolean;
  disabled: boolean;
};

function WalletItem({ account, onSelect, isPending, disabled }: WalletItemProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const handlePress = useCallback(() => {
    if (!disabled) {
      onSelect(account);
    }
  }, [account, onSelect, disabled]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
      className="w-full"
    >
      <View
        className="flex-1 flex-row items-center p-4 gap-3"
        style={{
          opacity: disabled && !isPending ? 0.5 : 1,
          backgroundColor: isPending ? (isDark ? "rgba(51, 65, 85, 0.3)" : "rgba(226, 232, 240, 0.5)") : "transparent",
        }}
      >
        <UserAvatar
          uri={account.avatarUrl}
          name={account.displayName}
          size={48}
        />

        <View className="flex-1 gap-1 pr-8">
          <Text
            className="text-base font-medium leading-tight text-slate-900 dark:text-white"
            numberOfLines={1}
          >
            {account.displayName}
          </Text>
          <Text
            className="text-sm leading-tight text-slate-600 dark:text-slate-300"
            numberOfLines={1}
          >
            @{account.username || account.shortPublicKey}
          </Text>
        </View>

        {account.isCurrent ? (
          <View
            className="rounded-full justify-center items-center"
            style={{
              width: 20,
              height: 20,
              backgroundColor: "#10b981",
            }}
          >
            <Feather name="check" size={12} color="#ffffff" />
          </View>
        ) : isPending ? (
          <ActivityIndicator size="small" color={isDark ? "#94a3b8" : "#64748b"} />
        ) : (
          <Feather name="chevron-right" size={20} color={isDark ? "#94a3b8" : "#64748b"} />
        )}
      </View>
    </TouchableOpacity>
  );
}
