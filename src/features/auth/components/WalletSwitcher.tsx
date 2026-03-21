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
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { identity } from "deso-protocol";
import { useColorScheme } from "nativewind";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { UserAvatar } from "@/components/UserAvatar";
import { useWalletSwitcher } from "../hooks/useWalletSwitcher";
import { RootStackParamList } from "@/navigation/types";
import { handleLogout } from "@/lib/auth";
import { Toast } from "@/components/ui/Toast";
import { useAuthTransition } from "@/state/auth/AuthTransitionProvider";

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
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { startAuthTransition, endAuthTransition } = useAuthTransition();
  const [internalOpen, setInternalOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && windowWidth >= 1024;
  const insets = useSafeAreaInsets();
  const profileCardRef = useRef<View>(null);
  const [cardPosition, setCardPosition] = useState({ top: 0, left: 0, width: 0, height: 0 });
  
  // Use external control if provided, otherwise use internal state
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;

  const measureAnchor = useCallback(() => {
    if (!profileCardRef.current) {
      return;
    }
    profileCardRef.current.measureInWindow((x, y, width, height) => {
      setCardPosition({ top: y, left: x, width, height });
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
  const currentProfileParams = useMemo(
    () =>
      currentAccount
        ? {
            username: currentAccount.username || undefined,
            publicKey: currentAccount.publicKey || undefined,
          }
        : undefined,
    [currentAccount],
  );

  const openMenu = useCallback(() => {
    if (externalOpen !== undefined) {
      return;
    }
    if (isDesktop && profileCardRef.current) {
      profileCardRef.current.measureInWindow((x, y, width, height) => {
        setCardPosition({ top: y, left: x, width, height });
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
      if (isCurrent || pendingAction || isSigningOut) {
        closeMenu();
        return;
      }
      await switchToPublicKey(publicKey);
      closeMenu();
    },
    [switchToPublicKey, closeMenu, pendingAction, isSigningOut],
  );

  const handleAddWallet = useCallback(async () => {
    if (pendingAction || isSigningOut) {
      return;
    }
    closeMenu();
    await addWallet();
  }, [addWallet, closeMenu, pendingAction, isSigningOut]);

  const handleGoToProfile = useCallback(() => {
    closeMenu();
    navigation.navigate("Main", {
      screen: "Profile",
      params: currentProfileParams,
    });
  }, [closeMenu, currentProfileParams, navigation]);

  const handleSignOut = useCallback(async () => {
    if (pendingAction || isSigningOut) return;
    setIsSigningOut(true);
    startAuthTransition("logout");
    try {
      await handleLogout(() => identity.logout());
      Toast.show({
        type: "success",
        text1: "Signed out",
        text2: "Come back soon!",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Please try again";
      Toast.show({
        type: "error",
        text1: "Logout failed",
        text2: message,
      });
    } finally {
      endAuthTransition();
      setIsSigningOut(false);
      closeMenu();
    }
  }, [
    pendingAction,
    isSigningOut,
    startAuthTransition,
    endAuthTransition,
    closeMenu,
  ]);

  if (!currentAccount) {
    return null;
  }

  // Keep popover same width as trigger
  const popoverWidth = minimal ? 180 : Math.max(180, cardPosition.width);
  // Position popover aligned with trigger
  const desktopLeft = cardPosition.left;
  const desktopTop = cardPosition.top + cardPosition.height + 4;
  const useDesktopAnchor = isDesktop && cardPosition.height > 0;
  const overlayBackground = isDesktop
    ? "transparent"
    : "rgba(0, 0, 0, 0.5)";

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
            className="mb-3 flex-row items-center rounded-full pl-1 pr-2"
            style={[
              { gap: 6, paddingVertical: 3 },
              {
                backgroundColor: isHovered || isOpen
                  ? (isDark ? "rgba(148, 163, 184, 0.12)" : "rgba(100, 116, 139, 0.08)")
                  : "transparent",
                ...(Platform.OS === "web" && {
                  transitionProperty: "background-color",
                  transitionDuration: "150ms",
                  cursor: "pointer",
                }),
              },
            ]}
          >
            {/* Avatar - always visible, scales down when active to align with nav icons */}
            <View
              style={[
                Platform.OS === "web" ? {
                  transitionProperty: "transform",
                  transitionDuration: "200ms",
                } as any : undefined,
                (isHovered || isOpen) ? {
                  transform: [{ scale: 0.7 }, { translateX: -6 }],
                } : undefined,
              ]}
            >
              <UserAvatar
                uri={currentAccount.avatarUrl}
                name={currentAccount.displayName}
                size={48}
              />
            </View>

            {/* Name and handle - only visible on hover/open like Bluesky */}
            <View
              className="flex-1 min-w-0"
              style={[
                { marginLeft: -8 },
                Platform.OS === "web" ? {
                  transitionProperty: "opacity",
                  transitionDuration: "150ms",
                } as any : undefined,
                { opacity: isHovered || isOpen ? 1 : 0 },
              ]}
            >
              <Text
                className={`text-[14px] font-bold leading-tight ${
                  isDark ? "text-slate-50" : "text-slate-900"
                }`}
                numberOfLines={1}
              >
                {currentAccount.displayName || currentAccount.username}
              </Text>
              <Text
                className={`text-[12px] leading-tight mt-0.5 ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
                numberOfLines={1}
              >
                @{currentAccount.username || currentAccount.shortPublicKey}
              </Text>
            </View>

            {/* Ellipsis icon - only visible on hover/open like Bluesky */}
            <View
              style={[
                Platform.OS === "web" ? {
                  transitionProperty: "opacity",
                  transitionDuration: "150ms",
                } as any : undefined,
                { opacity: isHovered || isOpen ? 1 : 0 },
              ]}
            >
              <Feather
                name="more-horizontal"
                size={18}
                color={isDark ? "#94a3b8" : "#64748b"}
              />
            </View>
          </Pressable>
        )
      ) : null}

      {/* Modal overlay for both desktop and mobile - positioned differently */}
      <Modal
        transparent
        animationType={isDesktop ? "fade" : "fade"}
        visible={isOpen}
        onRequestClose={closeMenu}
        statusBarTranslucent
      >
        <Pressable 
          className="flex-1" 
          onPress={closeMenu}
          style={{ backgroundColor: overlayBackground }}
        >
          {/* Wallet switcher popover */}
          <View
            style={{
              position: "absolute",
              // Desktop: Use measured profile card position
              // Mobile: Position centered or above bottom nav
              ...(useDesktopAnchor
                ? {
                    top: desktopTop,
                    left: Math.max(12, desktopLeft),
                  }
                : Platform.OS === "web"
                  ? {
                      // Web mobile - positioned near bottom but not as a sheet
                      bottom: Math.max(insets.bottom, 20) + 80,
                      left: 16,
                      right: 16,
                      width: "auto",
                      maxWidth: 320,
                    }
                  : {
                      // Native mobile - above bottom nav
                      bottom: Math.max(insets.bottom, 15) + 72,
                      right: 12,
                      left: 12,
                      width: "auto",
                      maxWidth: 320,
                    }),
              ...(useDesktopAnchor ? { width: popoverWidth } : {}),
            }}
            pointerEvents="box-none"
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              className="rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-white dark:bg-slate-900 shadow-xl"
              style={{ paddingVertical: 6, paddingHorizontal: 6 }}
            >
              {/* Switch account header */}
              <Text
                className={`px-2 pt-1 pb-2 text-xs font-semibold ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Switch account
              </Text>

              <View className="gap-0.5">
                {accounts.map((account) => {
                  const isPending =
                    pendingAction?.type === "switch" &&
                    pendingAction.publicKey === account.publicKey;
                  return (
                    <Pressable
                      key={account.publicKey}
                      disabled={Boolean(pendingAction) || isSigningOut}
                      onPress={() =>
                        handleSelectAccount(account.publicKey, account.isCurrent)
                      }
                      className="flex-row items-center rounded-md px-2 py-2 active:opacity-70 hover:bg-slate-100 dark:hover:bg-slate-800"
                      style={[
                        { gap: 10 },
                        Platform.OS === "web" ? ({ cursor: "pointer" } as any) : undefined
                      ]}
                    >
                      <UserAvatar
                        uri={account.avatarUrl}
                        name={account.displayName}
                        size={24}
                      />
                      <Text
                        className={`flex-1 text-sm ${
                          isDark ? "text-slate-50" : "text-slate-900"
                        }`}
                        numberOfLines={1}
                      >
                        @{account.username || account.shortPublicKey}
                      </Text>
                      {isPending ? (
                        <ActivityIndicator
                          size="small"
                          color={isDark ? "#e2e8f0" : "#0f172a"}
                        />
                      ) : account.isCurrent ? (
                        <View
                          className="items-center justify-center rounded-full"
                          style={{
                            width: 16,
                            height: 16,
                            backgroundColor: isDark ? "#22c55e" : "#16a34a",
                          }}
                        >
                          <Feather
                            name="check"
                            size={10}
                            color="#ffffff"
                          />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              <View className="my-1.5 mx-1 h-px bg-slate-200/80 dark:bg-slate-700/50" />

              <View className="gap-0.5">
                <Pressable
                  onPress={handleGoToProfile}
                  disabled={Boolean(pendingAction) || isSigningOut}
                  className="flex-row items-center rounded-md px-2 py-2 active:opacity-70 hover:bg-slate-100 dark:hover:bg-slate-800"
                  style={[
                    { gap: 10 },
                    Platform.OS === "web" ? ({ cursor: "pointer" } as any) : undefined
                  ]}
                >
                  <Feather
                    name="user"
                    size={18}
                    color={isDark ? "#94a3b8" : "#64748b"}
                  />
                  <Text
                    className={`text-sm ${
                      isDark ? "text-slate-50" : "text-slate-900"
                    }`}
                  >
                    Go to profile
                  </Text>
                </Pressable>

                <Pressable
                  disabled={Boolean(pendingAction) || isSigningOut}
                  onPress={handleAddWallet}
                  className="flex-row items-center rounded-md px-2 py-2 active:opacity-70 hover:bg-slate-100 dark:hover:bg-slate-800"
                  style={[
                    { gap: 10 },
                    Platform.OS === "web" ? ({ cursor: "pointer" } as any) : undefined
                  ]}
                >
                  <Feather
                    name="plus"
                    size={18}
                    color={isDark ? "#94a3b8" : "#64748b"}
                  />
                  <Text
                    className={`text-sm flex-1 ${
                      isDark ? "text-slate-50" : "text-slate-900"
                    }`}
                  >
                    Add another account
                  </Text>
                  {pendingAction?.type === "add" ? (
                    <ActivityIndicator
                      size="small"
                      color={isDark ? "#e2e8f0" : "#0f172a"}
                    />
                  ) : null}
                </Pressable>

                <Pressable
                  disabled={Boolean(pendingAction) || isSigningOut}
                  onPress={handleSignOut}
                  className="flex-row items-center rounded-md px-2 py-2 active:opacity-70 hover:bg-slate-100 dark:hover:bg-slate-800"
                  style={[
                    { gap: 10 },
                    Platform.OS === "web" ? ({ cursor: "pointer" } as any) : undefined
                  ]}
                >
                  <Feather
                    name="log-out"
                    size={18}
                    color={isDark ? "#f87171" : "#dc2626"}
                  />
                  <Text
                    className={`text-sm flex-1 ${
                      isDark ? "text-red-300" : "text-red-600"
                    }`}
                  >
                    Sign out
                  </Text>
                  {isSigningOut ? (
                    <ActivityIndicator
                      size="small"
                      color={isDark ? "#fecaca" : "#dc2626"}
                    />
                  ) : null}
                </Pressable>
              </View>

            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
