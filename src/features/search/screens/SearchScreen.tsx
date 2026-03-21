import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ScreenWrapper from "@/components/ScreenWrapper";
import { UserAvatar } from "@/components/UserAvatar";
import { PageTopBar, PageTopBarIconButton } from "@/components/ui/PageTopBar";
import { SearchPill } from "@/components/ui/SearchPill";
import { SearchIcon } from "@/components/icons/SearchIcon";
import { useSearchAccounts } from "@/features/search/api/useSearchAccounts";
import { getWebScrollbarStyle } from "@/lib/webScrollbar";
import { useAccentColor } from "@/state/theme/useAccentColor";
import { useSetDrawerOpen } from "@/state/shell";
import type { FocusUserSearchAccount } from "@/lib/focus/graphql";
import { RootStackParamList } from "@/navigation/types";
import { formatPublicKey, getProfileImageUrl } from "@/utils/deso";

const MOBILE_SEARCH_BOTTOM_CLEARANCE = 96;

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

function SearchResultRow({
  item,
  onPress,
}: {
  item: FocusUserSearchAccount;
  onPress: (item: FocusUserSearchAccount) => void;
}) {
  return (
    <Pressable onPress={() => onPress(item)} className="active:opacity-80">
      <View className="flex-row items-center gap-3 px-4 py-3">
        <UserAvatar
          uri={getProfileImageUrl(item.publicKey)}
          name={resolveSearchResultDisplayName(item)}
          size={48}
        />
        <View className="min-w-0 flex-1">
          <Text
            className="text-[16px] font-semibold text-slate-900 dark:text-white"
            numberOfLines={1}
          >
            {resolveSearchResultDisplayName(item)}
          </Text>
          <Text
            className="mt-0.5 text-sm text-slate-500 dark:text-slate-400"
            numberOfLines={1}
          >
            @{item.username?.trim() || formatPublicKey(item.publicKey)}
          </Text>
        </View>
        <Feather
          name="arrow-up-right"
          size={16}
          color="#94a3b8"
        />
      </View>
    </Pressable>
  );
}

export function SearchScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isDark, accentColor } = useAccentColor();
  const setDrawerOpen = useSetDrawerOpen();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 260);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const { data: results = [], isLoading, refetch, isFetching } =
    useSearchAccounts(debouncedSearchQuery);

  const scrollBarStyle = useMemo(
    () => getWebScrollbarStyle(isDark),
    [isDark],
  );
  const isDesktopWeb = Platform.OS === "web" && width >= 1024;
  const openDrawer = useCallback(() => {
    setDrawerOpen(true);
  }, [setDrawerOpen]);

  const handleSelectResult = useCallback(
    (item: FocusUserSearchAccount) => {
      const username = item.username?.trim() ?? "";
      const publicKey = item.publicKey?.trim() ?? "";

      if (!username && !publicKey) {
        return;
      }

      navigation.navigate("Main", {
        screen: "Profile",
        params: {
          username: username || undefined,
          publicKey: publicKey || undefined,
        },
      });
    },
    [navigation],
  );

  const listEmptyComponent = useMemo(() => {
    if (!debouncedSearchQuery) {
      return (
        <View className="flex-1 items-center justify-center px-8 py-16">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
            <SearchIcon
              size={28}
              color={isDark ? "#64748b" : "#94a3b8"}
              strokeWidth={1.8}
            />
          </View>
          <Text className="mt-4 text-center text-base font-medium text-slate-900 dark:text-white">
            Search profiles
          </Text>
          <Text className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400">
            Find any username and jump straight to that profile.
          </Text>
        </View>
      );
    }

    if (isLoading || isFetching) {
      return (
        <View className="flex-1 items-center justify-center px-8 py-16">
          <ActivityIndicator color={accentColor} />
        </View>
      );
    }

    return (
      <View className="flex-1 items-center justify-center px-8 py-16">
        <Feather
          name="user-x"
          size={42}
          color={isDark ? "#334155" : "#cbd5e1"}
        />
        <Text className="mt-4 text-center text-base font-medium text-slate-900 dark:text-white">
          No users found
        </Text>
        <Text className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400">
          Try a different username.
        </Text>
      </View>
    );
  }, [accentColor, debouncedSearchQuery, isDark, isFetching, isLoading]);

  return (
    <ScreenWrapper
      edges={["top", "left", "right"]}
      keyboardAvoiding={false}
      backgroundColor={isDark ? "#0a0f1a" : "#ffffff"}
    >
      <View className="flex-1">
        <PageTopBar
          title="Search"
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

        <View className="px-4 pb-3 pt-3">
          <SearchPill
            value={searchQuery}
            onChangeText={setSearchQuery}
            isDark={isDark}
          />
        </View>

        <FlatList
          data={results}
          style={scrollBarStyle}
          keyExtractor={(item) => item.publicKey}
          renderItem={({ item }) => (
            <SearchResultRow item={item} onPress={handleSelectResult} />
          )}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={Platform.OS === "web"}
          ListEmptyComponent={listEmptyComponent}
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: isDesktopWeb
              ? 32
              : Math.max(insets.bottom, 15) + MOBILE_SEARCH_BOTTOM_CLEARANCE,
          }}
          refreshControl={
            Platform.OS !== "web" && debouncedSearchQuery ? (
              <RefreshControl
                refreshing={isFetching}
                onRefresh={() => {
                  void refetch();
                }}
                tintColor={isDark ? "#f8fafc" : "#0f172a"}
                colors={[isDark ? "#f8fafc" : "#0f172a"]}
                progressBackgroundColor={isDark ? "#0f172a" : "#ffffff"}
              />
            ) : undefined
          }
        />
      </View>
    </ScreenWrapper>
  );
}
