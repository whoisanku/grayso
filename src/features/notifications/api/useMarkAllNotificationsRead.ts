import {
  type InfiniteData,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import {
  markAllFocusNotificationsRead,
  type FocusNotificationCounts,
  type FocusNotificationListResult,
} from "@/lib/focus/graphql";
import { notificationsKeys } from "./keys";

function markNotificationPageItemsRead(
  page: FocusNotificationListResult,
): FocusNotificationListResult {
  return {
    ...page,
    items: page.items.map((item) => ({
      ...item,
      status:
        item.status?.toUpperCase() === "UNREAD" ||
          item.status?.toUpperCase() === "PROCESSED"
          ? "READ"
          : item.status,
      unreadCount: 0,
    })),
  };
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userPublicKey }: { userPublicKey: string }) =>
      markAllFocusNotificationsRead({ userPublicKey }),
    onSuccess: (_data, variables) => {
      const normalizedPublicKey = variables.userPublicKey.trim();
      if (!normalizedPublicKey) {
        return;
      }

      queryClient.setQueryData<FocusNotificationCounts>(
        notificationsKeys.counts(normalizedPublicKey),
        (previous) => {
          if (!previous) {
            return previous;
          }

          return {
            ...previous,
            unreadMessagesCount: 0,
            unreadThreadsCount: 0,
            unreadNotificationCount: 0,
          };
        },
      );

      queryClient.setQueriesData<InfiniteData<FocusNotificationListResult>>(
        {
          queryKey: [...notificationsKeys.base, "list", normalizedPublicKey],
        },
        (previous) => {
          if (!previous) {
            return previous;
          }

          return {
            ...previous,
            pages: previous.pages.map((page, pageIndex) => {
              const nextPage = markNotificationPageItemsRead(page);
              if (pageIndex !== 0) {
                return nextPage;
              }

              return {
                ...nextPage,
                counts: {
                  ...nextPage.counts,
                  unreadMessagesCount: 0,
                  unreadThreadsCount: 0,
                  unreadNotificationCount: 0,
                },
              };
            }),
          };
        },
      );
    },
  });
}
