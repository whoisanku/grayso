import React, { useCallback, useContext, useMemo } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Feather } from "@expo/vector-icons";
import { DeSoIdentityContext } from "react-deso-protocol";
import { useIsFocused } from "@react-navigation/native";

import ScreenWrapper from "@/components/ScreenWrapper";
import { PageTopBar, PageTopBarIconButton } from "@/components/ui/PageTopBar";
import { useAccentColor } from "@/state/theme/useAccentColor";
import { useSetDrawerOpen } from "@/state/shell";
import { useNotifications } from "@/features/notifications/api/useNotifications";
import { useMarkAllNotificationsRead } from "@/features/notifications/api/useMarkAllNotificationsRead";
import { NotificationFeedItem } from "@/features/notifications/components/NotificationFeedItem";
import { NotificationsShimmer } from "@/features/notifications/components/NotificationsShimmer";
import { resolveCurrentUserPublicKey } from "@/utils/deso";

export function NotificationsScreen() {
  const { currentUser } = useContext(DeSoIdentityContext);
  const { isDark, accentColor } = useAccentColor();
  const { width } = useWindowDimensions();

  const setDrawerOpen = useSetDrawerOpen();
  const isDesktopWeb = Platform.OS === "web" && width >= 1024;
  const isFocused = useIsFocused();

  const userPublicKey = resolveCurrentUserPublicKey(currentUser);
  const {
    items,
    unreadCount,
    isLoading,
    isRefreshing,
    isFetchingNextPage,
    hasNextPage,
    error,
    reload,
    loadMore,
  } = useNotifications({
    userPublicKey,
    enabled: Boolean(userPublicKey),
    pageSize: 40,
  });
  const { mutateAsync: markAllRead, isPending: isMarkAllReadPending } =
    useMarkAllNotificationsRead();
  const didTriggerMarkReadRef = React.useRef(false);

  React.useEffect(() => {
    if (!isFocused) {
      didTriggerMarkReadRef.current = false;
      return;
    }

    if (!userPublicKey || unreadCount <= 0) {
      return;
    }

    if (isMarkAllReadPending || didTriggerMarkReadRef.current) {
      return;
    }

    didTriggerMarkReadRef.current = true;
    void markAllRead({ userPublicKey }).catch(() => {
      didTriggerMarkReadRef.current = false;
    });
  }, [
    isFocused,
    isMarkAllReadPending,
    markAllRead,
    unreadCount,
    userPublicKey,
  ]);

  const openDrawer = useCallback(() => {
    setDrawerOpen(true);
  }, [setDrawerOpen]);

  const renderEmptyState = useMemo(() => {
    if (!userPublicKey) {
      return (
        <View className="flex-1 items-center justify-center px-6 py-16">
          <Text className="text-lg font-semibold text-slate-900 dark:text-white">
            Sign in to view notifications
          </Text>
          <Text className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
            Notifications will appear here after login.
          </Text>
        </View>
      );
    }

    if (isLoading) {
      return <NotificationsShimmer />;
    }

    if (error) {
      return (
        <View className="flex-1 items-center justify-center px-6 py-16">
          <Text className="text-base font-semibold text-red-600 dark:text-red-300">
            Unable to load notifications
          </Text>
          <Text className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
            {error}
          </Text>
          <Pressable
            onPress={() => void reload()}
            className="mt-4 rounded-full px-4 py-2"
            style={{ backgroundColor: accentColor }}
          >
            <Text className="text-sm font-semibold text-white">Retry</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View className="flex-1 items-center justify-center px-6 py-16">
        <Text className="text-lg font-semibold text-slate-900 dark:text-white">
          No notifications
        </Text>
        <Text className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
          Likes, comments, follows, tips, and message activity will show up here.
        </Text>
      </View>
    );
  }, [accentColor, error, isLoading, reload, userPublicKey]);

  return (
    <ScreenWrapper
      edges={["top", "left", "right"]}
      keyboardAvoiding={false}
      backgroundColor={isDark ? "#0a0f1a" : "#ffffff"}
    >
      <View className="flex-1">
        <PageTopBar
          title="Notifications"
          subtitle={unreadCount > 0 ? `${unreadCount} unread` : undefined}
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

        <FlashList
          data={items}
          renderItem={({ item }) => (
            <NotificationFeedItem item={item} />
          )}
          keyExtractor={(item) => item.id}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              void loadMore();
            }
          }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View className="items-center py-5">
                <ActivityIndicator
                  size="small"
                  color={isDark ? "#e2e8f0" : accentColor}
                />
              </View>
            ) : null
          }
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              tintColor={isDark ? "#e2e8f0" : "#334155"}
              refreshing={isRefreshing}
              onRefresh={() => {
                void reload();
              }}
            />
          }
          contentContainerStyle={
            items.length === 0
              ? { flexGrow: 1 }
              : undefined
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      </View>
    </ScreenWrapper>
  );
}
