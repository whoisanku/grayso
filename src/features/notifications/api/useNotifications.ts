import { useMemo } from "react";
import { type InfiniteData, useInfiniteQuery } from "@tanstack/react-query";

import {
  fetchFocusNotifications,
  type FocusNotificationCounts,
  type FocusNotificationListResult,
} from "@/lib/focus/graphql";
import { notificationsKeys } from "./keys";

const EMPTY_COUNTS: FocusNotificationCounts = {
  unreadMessagesCount: 0,
  unreadThreadsCount: 0,
  totalUnclaimedMessageTipsUsdCents: 0,
  unreadNotificationCount: 0,
};

export function useNotifications({
  userPublicKey,
  enabled = true,
  pageSize = 30,
}: {
  userPublicKey?: string;
  enabled?: boolean;
  pageSize?: number;
}) {
  const normalizedPublicKey = userPublicKey?.trim() ?? "";

  const query = useInfiniteQuery<
    FocusNotificationListResult,
    Error,
    InfiniteData<FocusNotificationListResult>,
    ReturnType<typeof notificationsKeys.list>,
    number
  >({
    queryKey: notificationsKeys.list(normalizedPublicKey || "anonymous", pageSize),
    queryFn: ({ pageParam }) => {
      if (!normalizedPublicKey) {
        throw new Error("Public key is required to fetch notifications");
      }

      return fetchFocusNotifications({
        userPublicKey: normalizedPublicKey,
        first: pageSize,
        offset: pageParam ?? 0,
      });
    },
    getNextPageParam: (lastPage) => lastPage.nextOffset ?? undefined,
    initialPageParam: 0,
    enabled: enabled && Boolean(normalizedPublicKey),
    staleTime: 8000,
    refetchInterval: (baseQuery) => {
      const pages = baseQuery.state.data?.pages.length ?? 0;
      return pages <= 1 ? 12000 : false;
    },
    refetchOnWindowFocus: false,
  });

  const allItems = useMemo(() => {
    const seenIds = new Set<string>();
    const flattened: FocusNotificationListResult["items"] = [];

    for (const page of query.data?.pages ?? []) {
      for (const item of page.items) {
        if (seenIds.has(item.id)) {
          continue;
        }
        seenIds.add(item.id);
        flattened.push(item);
      }
    }

    return flattened;
  }, [query.data?.pages]);

  const counts = useMemo(
    () => query.data?.pages[0]?.counts ?? EMPTY_COUNTS,
    [query.data?.pages],
  );

  const unreadCount = counts.unreadNotificationCount;

  return {
    ...query,
    items: allItems,
    counts,
    unreadCount,
    error: query.error?.message ?? null,
    isRefreshing: query.isRefetching && !query.isFetchingNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: Boolean(query.hasNextPage),
    reload: query.refetch,
    loadMore: query.fetchNextPage,
  };
}
