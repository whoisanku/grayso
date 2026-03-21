import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { DeSoIdentityContext } from "react-deso-protocol";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ScreenWrapper from "@/components/ScreenWrapper";
import { UserAvatar } from "@/components/UserAvatar";
import { PageTopBar, PageTopBarIconButton } from "@/components/ui/PageTopBar";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { SearchPill } from "@/components/ui/SearchPill";
import { useManualRefresh } from "@/hooks/useManualRefresh";
import type {
  FocusAccount,
  FocusUserSearchAccount,
} from "@/lib/focus/graphql";
import { getWebScrollbarStyle } from "@/lib/webScrollbar";
import { useAccentColor } from "@/state/theme/useAccentColor";
import { useSetDrawerOpen } from "@/state/shell";
import {
  formatPublicKey,
  getProfileImageUrl,
  resolveCurrentUserPublicKey,
} from "@/utils/deso";
import { useWalletAccount } from "@/features/wallet/api/useWalletAccount";
import { WalletMetricCard } from "@/features/wallet/components/WalletMetricCard";
import { useSearchAccounts } from "@/features/search/api/useSearchAccounts";

const DESO_ICON_URL =
  "https://focus.xyz/_next/image?url=%2Fassets%2Fcoin-deso.png&w=64&q=75";
const USDC_ICON_URL =
  "https://focus.xyz/_next/image?url=%2Fassets%2Fcoin-usdc.png&w=64&q=75";
const MOBILE_WALLET_BOTTOM_CLEARANCE = 96;

type SelectedWalletAccount = {
  username: string;
  publicKey: string;
};

function formatUsdFromCents(value?: number | null) {
  const dollars = Number(value ?? 0) / 100;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: dollars >= 1000 ? 0 : 2,
  }).format(Number.isFinite(dollars) ? dollars : 0);
}

function formatCompactNumber(value?: number | null) {
  const numeric = Number(value ?? 0);
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: numeric >= 100 ? 0 : 2,
  }).format(Number.isFinite(numeric) ? numeric : 0);
}

function formatDesoFromNanos(value?: string | null) {
  const numeric = Number(value ?? 0);
  const deso = Number.isFinite(numeric) ? numeric / 1_000_000_000 : 0;

  return `${formatCompactNumber(deso)} DESO`;
}

function getPreferredWealth(account?: FocusAccount | null) {
  return account?.accountWealthChainUser ?? account?.accountWealth ?? null;
}

function resolveSearchResultDisplayName(result: FocusUserSearchAccount) {
  const extraDataDisplayName = result.extraData?.DisplayName;
  if (typeof extraDataDisplayName === "string" && extraDataDisplayName.trim()) {
    return extraDataDisplayName.trim();
  }

  const username = result.username?.trim();
  if (username) {
    return username;
  }

  return formatPublicKey(result.publicKey);
}

function WalletScreenShimmer() {
  return (
    <View className="gap-4 px-4 pt-4">
      <View className="rounded-[24px] border border-slate-200/70 bg-slate-100/80 p-4 dark:border-slate-800/70 dark:bg-slate-900/60">
        <View className="h-12 rounded-full bg-slate-200 dark:bg-slate-800" />
        <View className="mt-4 h-4 w-48 rounded-full bg-slate-200 dark:bg-slate-800" />
      </View>

      <View className="rounded-[28px] border border-slate-200/70 bg-slate-100/80 p-5 dark:border-slate-800/70 dark:bg-slate-900/60">
        <View className="flex-row items-center gap-4">
          <View className="h-16 w-16 rounded-full bg-slate-200 dark:bg-slate-800" />
          <View className="flex-1">
            <View className="h-6 w-32 rounded-full bg-slate-200 dark:bg-slate-800" />
            <View className="mt-2 h-4 w-24 rounded-full bg-slate-200 dark:bg-slate-800" />
          </View>
        </View>
        <View className="mt-6 h-4 w-28 rounded-full bg-slate-200 dark:bg-slate-800" />
        <View className="mt-3 h-12 w-48 rounded-full bg-slate-200 dark:bg-slate-800" />
      </View>

      <View className="gap-3 md:flex-row">
        <View className="rounded-[24px] border border-slate-200/70 bg-slate-100/80 p-4 dark:border-slate-800/70 dark:bg-slate-900/60">
          <View className="h-5 w-20 rounded-full bg-slate-200 dark:bg-slate-800" />
          <View className="mt-4 h-10 w-32 rounded-full bg-slate-200 dark:bg-slate-800" />
        </View>
        <View className="rounded-[24px] border border-slate-200/70 bg-slate-100/80 p-4 dark:border-slate-800/70 dark:bg-slate-900/60">
          <View className="h-5 w-20 rounded-full bg-slate-200 dark:bg-slate-800" />
          <View className="mt-4 h-10 w-32 rounded-full bg-slate-200 dark:bg-slate-800" />
        </View>
      </View>
    </View>
  );
}

export function WalletScreen() {
  const { currentUser } = useContext(DeSoIdentityContext);
  const { isDark, accentColor } = useAccentColor();
  const setDrawerOpen = useSetDrawerOpen();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [selectedAccount, setSelectedAccount] =
    useState<SelectedWalletAccount | null>(null);

  const connectedPublicKey = resolveCurrentUserPublicKey(currentUser);
  const connectedUsername =
    currentUser?.ProfileEntryResponse?.Username?.trim() ?? "";

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 260);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const effectiveUsername = selectedAccount?.username || connectedUsername || undefined;
  const effectivePublicKey =
    effectiveUsername ? undefined : connectedPublicKey || undefined;

  const { data: account, isLoading, isFetching, error, refetch } =
    useWalletAccount({
      publicKey: effectivePublicKey,
      username: effectiveUsername,
    });

  const searchQueryForResults =
    selectedAccount &&
    debouncedSearchQuery.toLowerCase() === selectedAccount.username.toLowerCase()
      ? ""
      : debouncedSearchQuery;

  const {
    data: searchResults = [],
    isLoading: isSearchLoading,
    error: searchError,
  } = useSearchAccounts(searchQueryForResults);

  const wealth = useMemo(() => getPreferredWealth(account), [account]);
  const scrollBarStyle = useMemo(
    () => getWebScrollbarStyle(isDark),
    [isDark],
  );
  const isDesktopWeb = Platform.OS === "web" && width >= 1024;
  const isWideLayout = width >= 768;
  const bottomInset = isDesktopWeb
    ? 32
    : Math.max(insets.bottom, 15) + MOBILE_WALLET_BOTTOM_CLEARANCE;
  const refreshSpinnerColor = isDark ? "#f8fafc" : "#0f172a";

  const activePublicKey = account?.publicKey?.trim() || selectedAccount?.publicKey || connectedPublicKey;
  const activeUsername = account?.username?.trim() || selectedAccount?.username || connectedUsername;
  const isViewingAnotherWallet = Boolean(selectedAccount);
  const displayName = activeUsername || formatPublicKey(activePublicKey);

  const totalBalanceUsdCents =
    wealth?.totalBalanceUsdCents ?? account?.totalBalanceUsdCents ?? 0;
  const usdBalanceUsdCents = wealth?.usdBalanceUsdCents ?? 0;
  const desoBalanceUsdCents = wealth?.desoBalanceUsdCents ?? 0;
  const desoBalanceNanos = wealth?.desoBalanceNanos ?? "0";

  const openDrawer = useCallback(() => {
    setDrawerOpen(true);
  }, [setDrawerOpen]);

  const resetToOwnWallet = useCallback(() => {
    setSelectedAccount(null);
    setSearchQuery("");
    setDebouncedSearchQuery("");
  }, []);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);

      if (
        selectedAccount &&
        value.trim().toLowerCase() !== selectedAccount.username.toLowerCase()
      ) {
        setSelectedAccount(null);
      }
    },
    [selectedAccount],
  );

  const handleSelectSearchResult = useCallback(
    (result: FocusUserSearchAccount) => {
      const username = result.username?.trim();
      if (!username) {
        return;
      }

      setSelectedAccount({
        username,
        publicKey: result.publicKey,
      });
      setSearchQuery(username);
      setDebouncedSearchQuery(username);
    },
    [],
  );

  const { isRefreshing: isManualRefreshing, onRefresh } = useManualRefresh(
    async () => {
      await refetch();
    },
  );

  const metrics = [
    {
      key: "deso",
      title: "DESO",
      primaryValue: formatDesoFromNanos(desoBalanceNanos),
      secondaryValue: formatUsdFromCents(desoBalanceUsdCents),
      iconContainerClassName: "h-12 w-12 bg-transparent dark:bg-transparent",
      icon: (
        <Image
          source={{ uri: DESO_ICON_URL }}
          style={{ width: 32, height: 32 }}
          contentFit="contain"
          transition={200}
        />
      ),
    },
    {
      key: "usdc",
      title: "USDC",
      primaryValue: formatUsdFromCents(usdBalanceUsdCents),
      secondaryValue: "Stablecoin balance",
      iconContainerClassName: "h-12 w-12 bg-transparent dark:bg-transparent",
      icon: (
        <Image
          source={{ uri: USDC_ICON_URL }}
          style={{ width: 32, height: 32 }}
          contentFit="contain"
          transition={200}
        />
      ),
    },
  ];

  const showSearchResults = Boolean(searchQueryForResults);

  const content = (() => {
    if (!connectedPublicKey) {
      return (
        <View className="px-4 pt-4">
          <View className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800/80 dark:bg-slate-900/60">
            <Text className="text-lg font-semibold text-slate-900 dark:text-white">
              Wallet unavailable
            </Text>
            <Text className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Sign in with a wallet to view balances and search other accounts here.
            </Text>
          </View>
        </View>
      );
    }

    if (isLoading && !account) {
      return <WalletScreenShimmer />;
    }

    if (error) {
      return (
        <View className="px-4 pt-4">
          <View className="rounded-[24px] border border-red-200 bg-red-50 p-5 dark:border-red-900/40 dark:bg-red-900/20">
            <Text className="text-lg font-semibold text-red-700 dark:text-red-300">
              Unable to load wallet
            </Text>
            <Text className="mt-2 text-sm leading-6 text-red-600 dark:text-red-200">
              {error.message || "Something went wrong while fetching wallet data."}
            </Text>
            <Pressable
              onPress={() => {
                void refetch();
              }}
              className="mt-4 self-start rounded-full px-4 py-2"
              style={{ backgroundColor: accentColor }}
            >
              <Text className="text-sm font-semibold text-white">Retry</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return (
      <View style={{ overflow: "visible" }}>
        <View
          className="px-4 pb-3 pt-3"
          style={{
            zIndex: showSearchResults ? 120 : 1,
            position: "relative",
            overflow: "visible",
          }}
        >
          <View
            className="relative"
            style={{
              zIndex: showSearchResults ? 140 : 1,
              position: "relative",
              overflow: "visible",
            }}
          >
            <SearchPill
              value={searchQuery}
              onChangeText={handleSearchChange}
              onClear={resetToOwnWallet}
              isDark={isDark}
            />

            {showSearchResults ? (
              <View
                className="absolute left-0 right-0 overflow-hidden rounded-[26px] border border-slate-200/90 dark:border-slate-800/90"
                style={{
                  top: 64,
                  zIndex: 220,
                  elevation: 12,
                  backgroundColor: isDark ? "#111827" : "#ffffff",
                  shadowColor: "#000000",
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: isDark ? 0.28 : 0.12,
                  shadowRadius: 24,
                }}
              >
                {isSearchLoading ? (
                  <View className="flex-row items-center gap-3 px-4 py-4">
                    <ActivityIndicator
                      size="small"
                      color={isDark ? "#e2e8f0" : accentColor}
                    />
                    <Text className="text-sm text-slate-500 dark:text-slate-400">
                      Searching users...
                    </Text>
                  </View>
                ) : searchError ? (
                  <View className="px-4 py-4">
                    <Text className="text-sm text-red-600 dark:text-red-300">
                      Unable to search users right now.
                    </Text>
                  </View>
                ) : searchResults.length === 0 ? (
                  <View className="px-4 py-4">
                    <Text className="text-sm text-slate-500 dark:text-slate-400">
                      No users found for "{searchQueryForResults}".
                    </Text>
                  </View>
                ) : (
                  searchResults.map((result, index) => (
                    <Pressable
                      key={`${result.publicKey}-${result.username ?? index}`}
                      onPress={() => handleSelectSearchResult(result)}
                      className="flex-row items-center gap-3 px-4 py-3 active:opacity-80"
                      style={{
                        borderTopWidth: index === 0 ? 0 : 1,
                        borderTopColor: isDark
                          ? "rgba(30, 41, 59, 0.9)"
                          : "rgba(226, 232, 240, 0.9)",
                      }}
                    >
                      <UserAvatar
                        uri={getProfileImageUrl(result.publicKey)}
                        name={resolveSearchResultDisplayName(result)}
                        size={40}
                      />
                      <View className="min-w-0 flex-1">
                        <Text
                          className="text-[15px] font-semibold text-slate-900 dark:text-white"
                          numberOfLines={1}
                        >
                          {resolveSearchResultDisplayName(result)}
                        </Text>
                        <Text
                          className="mt-0.5 text-sm text-slate-500 dark:text-slate-400"
                          numberOfLines={1}
                        >
                          @{result.username ?? formatPublicKey(result.publicKey)}
                        </Text>
                      </View>
                      <Feather
                        name="arrow-up-right"
                        size={16}
                        color={isDark ? "#94a3b8" : "#64748b"}
                      />
                    </Pressable>
                  ))
                )}
              </View>
            ) : null}
          </View>

          {isViewingAnotherWallet ? (
            <View className="mt-3 flex-row items-center justify-between gap-3">
              <Text className="flex-1 text-sm text-slate-500 dark:text-slate-400">
                Viewing @{selectedAccount?.username}
              </Text>
              <Pressable
                onPress={resetToOwnWallet}
                className="rounded-full px-3 py-1.5"
                style={{ backgroundColor: accentColor }}
              >
                <Text className="text-xs font-semibold text-white">
                  My wallet
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View
          className="gap-4 px-4 pt-1"
          style={{ overflow: "visible" }}
        >
          <View
            className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800/80 dark:bg-slate-900/60"
            style={{ zIndex: 1 }}
          >
            <View className="flex-row items-center gap-4">
              <UserAvatar
                uri={getProfileImageUrl(activePublicKey)}
                name={displayName}
                size={64}
              />

              <View className="min-w-0 flex-1">
                <Text
                  className="text-xl font-bold text-slate-900 dark:text-white"
                  numberOfLines={1}
                >
                  {displayName}
                </Text>
                <Text
                  className="mt-1 text-sm text-slate-500 dark:text-slate-400"
                  numberOfLines={1}
                >
                  @{activeUsername || formatPublicKey(activePublicKey)}
                </Text>
                <Text
                  className="mt-1 text-xs uppercase tracking-[1.2px] text-slate-400 dark:text-slate-500"
                  numberOfLines={1}
                >
                  {formatPublicKey(activePublicKey)}
                </Text>
              </View>

              {isFetching && !isLoading ? (
                <ActivityIndicator
                  size="small"
                  color={isDark ? "#e2e8f0" : accentColor}
                />
              ) : null}
            </View>

            <Text className="mt-6 text-sm font-medium text-slate-500 dark:text-slate-400">
              Total wallet value
            </Text>
            <Text className="mt-2 text-[38px] font-bold tracking-[-0.8px] text-slate-900 dark:text-white">
              {formatUsdFromCents(totalBalanceUsdCents)}
            </Text>
          </View>

          <View className="flex-row flex-wrap gap-3" style={{ zIndex: 1 }}>
            {metrics.map((metric) => (
              <View
                key={metric.key}
                style={{ width: isWideLayout ? "48.8%" : "100%" }}
              >
                <WalletMetricCard
                  title={metric.title}
                  primaryValue={metric.primaryValue}
                  secondaryValue={metric.secondaryValue}
                  icon={metric.icon}
                  iconContainerClassName={metric.iconContainerClassName}
                />
              </View>
            ))}
          </View>

          {!wealth ? (
            <View className="rounded-[24px] border border-amber-200/80 bg-amber-50/90 p-4 dark:border-amber-900/40 dark:bg-amber-900/20">
              <Text className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                Detailed wealth data is unavailable for this account right now.
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  })();

  return (
    <ScreenWrapper
      edges={["top", "left", "right"]}
      keyboardAvoiding={false}
      backgroundColor={isDark ? "#0a0f1a" : "#ffffff"}
    >
      <View className="flex-1">
        <PageTopBar
          title="Wallet"
          leftSlot={
            !isDesktopWeb ? (
              <PageTopBarIconButton
                onPress={openDrawer}
                accessibilityLabel="Open menu"
              >
                <Feather
                  name="menu"
                  size={20}
                  color={isDark ? "#f8fafc" : "#0f172a"}
                />
              </PageTopBarIconButton>
            ) : undefined
          }
        />

        <PullToRefresh
          onRefresh={onRefresh}
          isRefreshing={isManualRefreshing}
          enabled={Platform.OS === "web" && !isDesktopWeb}
        >
          <ScrollView
            style={scrollBarStyle}
            refreshControl={
              Platform.OS !== "web" ? (
                <RefreshControl
                  tintColor={refreshSpinnerColor}
                  colors={[refreshSpinnerColor]}
                  progressBackgroundColor={isDark ? "#0f172a" : "#ffffff"}
                  refreshing={isManualRefreshing}
                  onRefresh={onRefresh}
                />
              ) : undefined
            }
            contentContainerStyle={{
              paddingBottom: bottomInset,
            }}
            showsVerticalScrollIndicator={Platform.OS === "web"}
            keyboardShouldPersistTaps="handled"
          >
            {content}
          </ScrollView>
        </PullToRefresh>
      </View>
    </ScreenWrapper>
  );
}
