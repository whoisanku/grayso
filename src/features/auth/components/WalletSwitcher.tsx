import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { UserAvatar } from "@/components/UserAvatar";
import { useWalletSwitcher } from "../hooks/useWalletSwitcher";

type WalletSwitcherProps = {
  minimal?: boolean;
  showTrigger?: boolean;
  externalOpen?: boolean;
  onExternalClose?: () => void;
};

export function WalletSwitcher({
  minimal = false,
  showTrigger = true,
  externalOpen,
  onExternalClose,
}: WalletSwitcherProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { accounts, pendingAction, switchToPublicKey, addWallet } =
    useWalletSwitcher();
  const [internalOpen, setInternalOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && windowWidth >= 1024;
  const insets = useSafeAreaInsets();
  const profileCardRef = useRef<View>(null);
  const [cardPosition, setCardPosition] = useState({ top: 0, left: 0, height: 0 });
  
  // Use external control if provided, otherwise use internal state
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;

  const measureAnchor = useCallback(() => {
    if (!profileCardRef.current) {
      return;
    }
    profileCardRef.current.measureInWindow((x, y, _width, height) => {
      setCardPosition({ top: y, left: x, height });
    });
  }, []);

  // Measure profile card position when it mounts or layout changes
  const handleLayout = useCallback(() => {
    if (!isDesktop) {
      return;
    }
    measureAnchor();
  }, [isDesktop, measureAnchor]);

  const currentAccount = useMemo(
    () => accounts.find((acc) => acc.isCurrent),
    [accounts]
  );

  const openMenu = useCallback(() => {
    if (externalOpen !== undefined) {
      return;
    }
    if (isDesktop && profileCardRef.current) {
      profileCardRef.current.measureInWindow((x, y, _width, height) => {
        setCardPosition({ top: y, left: x, height });
        setInternalOpen(true);
      });
      return;
    }
    setInternalOpen(true);
  }, [externalOpen, isDesktop]);

  const closeMenu = useCallback(() => {
    if (onExternalClose) {
      onExternalClose();
    } else {
      setInternalOpen(false);
    }
  }, [onExternalClose]);

  useEffect(() => {
    if (!isOpen || !isDesktop || !showTrigger) {
      return;
    }
    measureAnchor();

    if (Platform.OS !== "web") {
      return;
    }

    const handleReposition = () => {
      measureAnchor();
    };

    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [isDesktop, isOpen, measureAnchor, showTrigger]);

  const handleSelectAccount = useCallback(
    async (publicKey: string, isCurrent: boolean) => {
      if (isCurrent) {
        closeMenu();
        return;
      }
      await switchToPublicKey(publicKey);
      closeMenu();
    },
    [switchToPublicKey, closeMenu],
  );

  const handleAddWallet = useCallback(async () => {
    closeMenu();
    await addWallet();
  }, [addWallet, closeMenu]);

  if (!currentAccount) {
    return null;
  }

  const popoverWidth = minimal ? 200 : 280;
  const desktopLeft = Math.min(cardPosition.left, windowWidth - popoverWidth - 12);
  const desktopTop = cardPosition.top + cardPosition.height + 8;
  const useDesktopAnchor = isDesktop && cardPosition.height > 0;

  return (
    <>
      {showTrigger ? (
        minimal ? (
          <TouchableOpacity
            ref={profileCardRef}
            onPress={openMenu}
            onLayout={handleLayout}
            className="mb-3 items-center py-2 active:opacity-80"
          >
            <UserAvatar
              uri={currentAccount.avatarUrl}
              name={currentAccount.displayName}
              size={36}
            />
          </TouchableOpacity>
        ) : (
          <Pressable
            ref={profileCardRef}
            onPress={openMenu}
            onLayout={handleLayout}
            onHoverIn={() => setIsHovered(true)}
            onHoverOut={() => setIsHovered(false)}
            className="mb-3 flex-row items-center justify-between rounded-full py-2 px-3"
            style={{
              backgroundColor: isHovered
                ? (isDark ? "rgba(148, 163, 184, 0.1)" : "rgba(100, 116, 139, 0.05)")
                : "transparent",
              // Add transition for background color
              ...(Platform.OS === "web" && {
                transitionProperty: "background-color",
                transitionDuration: "250ms",
                transitionTimingFunction: "cubic-bezier(0.33, 1, 0.68, 1)",
                transitionDelay: isHovered ? "0ms" : "50ms",
              }),
            }}
          >
            {/* Avatar with scale/translate animation */}
            <View
              style={{
                position: "relative",
                zIndex: 10,
                ...(Platform.OS === "web" && {
                  transitionProperty: "transform",
                  transitionDuration: "250ms",
                  transitionTimingFunction: "cubic-bezier(0.33, 1, 0.68, 1)",
                  transitionDelay: isHovered ? "0ms" : "50ms",
                }),
                transform: isHovered
                  ? [{ scale: 2 / 3 }, { translateX: -22 }]
                  : [{ scale: 1 }, { translateX: 0 }],
              }}
            >
              <UserAvatar
                uri={currentAccount.avatarUrl}
                name={currentAccount.displayName}
                size={44}
              />
            </View>

            {/* Username and handle - fade in on hover */}
            <View
              className="flex-1"
              style={{
                marginLeft: -20, // Overlap with scaled avatar
                ...(Platform.OS === "web" && {
                  transitionProperty: "opacity",
                  transitionDuration: "250ms",
                  transitionTimingFunction: "cubic-bezier(0.33, 1, 0.68, 1)",
                  transitionDelay: isHovered ? "0ms" : "50ms",
                }),
                opacity: isHovered ? 1 : 0,
              }}
            >
              <Text
                className={`text-sm font-semibold leading-tight ${
                  isDark ? "text-slate-50" : "text-slate-900"
                }`}
                numberOfLines={1}
              >
                {currentAccount.username || currentAccount.displayName}
              </Text>
              <Text
                className={`text-xs leading-tight ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
                numberOfLines={1}
              >
                {currentAccount.shortPublicKey}
              </Text>
            </View>

            {/* Ellipsis icon - fade in on hover */}
            <View
              style={{
                ...(Platform.OS === "web" && {
                  transitionProperty: "opacity",
                  transitionDuration: "250ms",
                  transitionTimingFunction: "cubic-bezier(0.33, 1, 0.68, 1)",
                }),
                opacity: isHovered ? 1 : 0,
              }}
            >
              <Feather
                name="more-horizontal"
                size={16}
                color={isDark ? "#94a3b8" : "#64748b"}
              />
            </View>
          </Pressable>
        )
      ) : null}

      {/* Modal overlay for both desktop and mobile - positioned differently */}
      <Modal
        transparent
        animationType="fade"
        visible={isOpen}
        onRequestClose={closeMenu}
      >
        <Pressable 
          className="flex-1" 
          onPress={closeMenu}
          style={{ backgroundColor: "rgba(0, 0, 0, 0.4)" }}
        >
          {/* Wallet switcher popover */}
          <View
            style={{
              position: "absolute",
              // Desktop: Use measured profile card position
              // Mobile: Position above bottom nav
              ...(useDesktopAnchor
                ? {
                    top: desktopTop, // Below profile card with 8px gap
                    left: Math.max(12, desktopLeft),
                  }
                : {
                    bottom: Math.max(insets.bottom, 15) + 72, // Above bottom nav
                    right: 10,
                  }),
              width: popoverWidth,
            }}
            pointerEvents="box-none"
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              className="rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-white dark:bg-slate-900 p-2 shadow-2xl"
            >
              <Text
                className={`px-3 pb-1 text-xs font-semibold uppercase tracking-wider ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Wallets
              </Text>

              <View className="gap-1">
                {accounts.map((account) => {
                  const isPending =
                    pendingAction?.type === "switch" &&
                    pendingAction.publicKey === account.publicKey;
                  return (
                    <Pressable
                      key={account.publicKey}
                      disabled={Boolean(pendingAction)}
                      onPress={() =>
                        handleSelectAccount(account.publicKey, account.isCurrent)
                      }
                      className={`flex-row items-center gap-3 rounded-lg px-3 py-2 active:opacity-70 hover:bg-slate-200 dark:hover:bg-slate-800 ${
                        account.isCurrent
                          ? isDark
                            ? "bg-slate-800/60"
                            : "bg-slate-100"
                          : ""
                      }`}
                      style={Platform.OS === "web" ? ({ cursor: "pointer" } as any) : undefined}
                    >
                      <UserAvatar
                        uri={account.avatarUrl}
                        name={account.displayName}
                        size={28}
                      />
                      <View className="flex-1">
                        <Text
                          className={`text-sm font-medium ${
                            isDark ? "text-slate-50" : "text-slate-900"
                          }`}
                          numberOfLines={1}
                        >
                          @{account.username || account.displayName}
                        </Text>
                        <Text
                          className={`text-xs ${
                            isDark ? "text-slate-400" : "text-slate-500"
                          }`}
                          numberOfLines={1}
                        >
                          {account.shortPublicKey}
                        </Text>
                      </View>
                      {isPending ? (
                        <ActivityIndicator
                          size="small"
                          color={isDark ? "#e2e8f0" : "#0f172a"}
                        />
                      ) : account.isCurrent ? (
                        <Feather
                          name="check"
                          size={16}
                          color={isDark ? "#e2e8f0" : "#0f172a"}
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              <View className="my-2 h-px bg-slate-200 dark:bg-slate-700" />

              <Pressable
                disabled={Boolean(pendingAction)}
                onPress={handleAddWallet}
                className="flex-row items-center gap-2 rounded-lg px-3 py-2 active:opacity-70 hover:bg-slate-200 dark:hover:bg-slate-800"
                style={Platform.OS === "web" ? ({ cursor: "pointer" } as any) : undefined}
              >
                <Feather
                  name="plus"
                  size={16}
                  color={isDark ? "#e2e8f0" : "#0f172a"}
                />
                <Text
                  className={`text-sm font-medium ${
                    isDark ? "text-slate-50" : "text-slate-900"
                  }`}
                >
                  Add wallet
                </Text>
                {pendingAction?.type === "add" ? (
                  <ActivityIndicator
                    size="small"
                    color={isDark ? "#e2e8f0" : "#0f172a"}
                  />
                ) : null}
              </Pressable>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
