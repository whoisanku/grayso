import { useQuery } from "@tanstack/react-query";
import { identity } from "deso-protocol";

import {
  fetchFocusNotificationCounts,
  type FocusNotificationCounts,
} from "@/lib/focus/graphql";
import { notificationsKeys } from "./keys";

const EMPTY_COUNTS: FocusNotificationCounts = {
  unreadMessagesCount: 0,
  unreadThreadsCount: 0,
  totalUnclaimedMessageTipsUsdCents: 0,
  unreadNotificationCount: 0,
};

export function useNotificationCounts(userPublicKey?: string) {
  const normalizedPublicKey = userPublicKey?.trim() ?? "";

  const query = useQuery<FocusNotificationCounts>({
    queryKey: notificationsKeys.counts(normalizedPublicKey || "current-user"),
    queryFn: async () => {
      let resolvedPublicKey = normalizedPublicKey;
      if (!resolvedPublicKey) {
        try {
          const snapshot = await identity.snapshot();
          resolvedPublicKey =
            snapshot?.currentUser?.publicKey?.trim() ??
            (
              snapshot?.currentUser as
                | { PublicKeyBase58Check?: string | null }
                | null
                | undefined
            )?.PublicKeyBase58Check?.trim() ??
            "";
        } catch {
          resolvedPublicKey = "";
        }
      }

      if (!resolvedPublicKey) {
        return EMPTY_COUNTS;
      }

      return fetchFocusNotificationCounts({
        userPublicKey: resolvedPublicKey,
      });
    },
    enabled: true,
    staleTime: 8000,
    refetchInterval: 12000,
    refetchOnWindowFocus: false,
  });

  return {
    ...query,
    counts: query.data ?? EMPTY_COUNTS,
    error: query.error?.message ?? null,
  };
}
