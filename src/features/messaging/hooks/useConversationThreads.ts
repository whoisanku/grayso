import { useContext, useEffect, useMemo, useRef } from "react";
import { DeSoIdentityContext } from "react-deso-protocol";
import {
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { identity } from "deso-protocol";
import { Platform } from "react-native";

import {
  conversationThreadsKeys,
  fetchConversationThreads,
} from "@/state/queries/messages/threads";
import type { ConversationMap, ThreadMetaMap } from "@/features/messaging/api/conversations";
import type { PublicKeyToProfileEntryResponseMap } from "deso-protocol";
import type { GroupMember } from "@/lib/deso/graphql";
import {
  getSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/supabaseClient";
import { StorageService } from "@/lib/storage";

type ThreadsPage = Awaited<ReturnType<typeof fetchConversationThreads>>;
type GroupMembersMap = Record<string, GroupMember[]>;
type GroupExtraMap = Record<string, Record<string, string> | null>;

type UseConversationThreadsResult = {
  conversations: ConversationMap;
  profiles: PublicKeyToProfileEntryResponseMap;
  groupMembers: GroupMembersMap;
  groupExtraData: GroupExtraMap;
  threadMeta: ThreadMetaMap;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean | undefined;
  isFetching: boolean;
  error: string | null;
  reload: () => Promise<unknown>;
  loadMore: () => Promise<unknown>;
};

export const useConversationThreads = (
  options: { enabled?: boolean } = {}
): UseConversationThreadsResult => {
  const { currentUser } = useContext(DeSoIdentityContext);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();

  // Hydrate cached conversations immediately for fast paint
  useEffect(() => {
    const userPk = currentUser?.PublicKeyBase58Check;
    if (!userPk) return;
    (async () => {
      const cached = await StorageService.getConversationThreads(userPk);
      if (cached) {
        const hydrated =
          cached && typeof cached === "object" && "pages" in cached
            ? cached
            : {
                pages: [cached],
                pageParams: [0],
              };
        queryClient.setQueryData(
          conversationThreadsKeys.all(userPk),
          hydrated
        );
      }
    })();
  }, [currentUser?.PublicKeyBase58Check, queryClient]);

  const initialPageParam = 0;

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<
    ThreadsPage,
    Error,
    InfiniteData<ThreadsPage>,
    ReturnType<typeof conversationThreadsKeys.all>,
    number
  >({
    queryKey: conversationThreadsKeys.all(currentUser?.PublicKeyBase58Check),
    queryFn: async ({ pageParam }) => {
      try {
        return await fetchConversationThreads(currentUser!.PublicKeyBase58Check, {
          offset: pageParam ?? 0,
          limit: 20,
        });
      } catch (e: any) {
        const message: string = e?.message ?? "";
        if (message.includes("Cannot decrypt messages")) {
          console.warn("Unable to decrypt conversations for current user", {
            publicKey: currentUser?.PublicKeyBase58Check,
            error: e,
          });
          try {
            await identity.logout();
          } catch (logoutError) {
            console.warn("Failed to logout after decryption error", logoutError);
          }
        }
        throw e;
      }
    },
    getNextPageParam: (lastPage) =>
      lastPage && typeof lastPage === "object"
        ? lastPage.nextOffset ?? undefined
        : undefined,
    initialPageParam,
    enabled: !!currentUser?.PublicKeyBase58Check && (options.enabled ?? true),
    staleTime: 30_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Persist conversations to storage when updated (debounced)
  useEffect(() => {
    const userPk = currentUser?.PublicKeyBase58Check;
    if (!userPk || !data?.pages) return;

    const debounceMs = Platform.OS === "web" ? 2000 : 1000;

    if (persistTimeoutRef.current) {
      clearTimeout(persistTimeoutRef.current);
    }

    persistTimeoutRef.current = setTimeout(() => {
      void StorageService.saveConversationThreads(userPk, data);
    }, debounceMs);

    return () => {
      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current);
      }
    };
  }, [currentUser?.PublicKeyBase58Check, data]);

  useEffect(() => {
    const userPublicKey = currentUser?.PublicKeyBase58Check;
    const supabaseEnabled = isSupabaseConfigured();

    if (!supabaseEnabled || !userPublicKey) {
      return;
    }

    const supabase = getSupabaseClient();
    const channelIdentifier = `messages:${userPublicKey}`;

    const channel = supabase
      .channel(channelIdentifier)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        () => {
          // Debounce refetches to avoid flooding when multiple inserts arrive
          if (debounceRef.current) {
            clearTimeout(debounceRef.current);
          }
          debounceRef.current = setTimeout(() => {
            void refetch();
          }, Platform.OS === "web" ? 150 : 75);
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.warn("Supabase realtime subscription error", err);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("Supabase realtime subscription status", status);
        }
      });

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      void channel.unsubscribe();
    };
  }, [currentUser?.PublicKeyBase58Check, refetch]);

  const merged = useMemo(() => {
    if (!data?.pages) {
      return {
        conversations: {} as ConversationMap,
        profiles: {} as PublicKeyToProfileEntryResponseMap,
        groupMembers: {} as GroupMembersMap,
        groupExtraData: {} as GroupExtraMap,
        threadMeta: {} as ThreadMetaMap,
      };
    }

    const conversations = data.pages.reduce<ThreadsPage["conversations"]>(
      (acc, page) => ({ ...acc, ...page.conversations }),
      {}
    );
    const profiles = data.pages.reduce<ThreadsPage["profiles"]>(
      (acc, page) => ({ ...acc, ...page.profiles }),
      {}
    );
    const groupMembers = data.pages.reduce<GroupMembersMap>(
      (acc, page) => ({ ...acc, ...page.groupMembers }),
      {} as GroupMembersMap
    );
    const groupExtraData = data.pages.reduce<GroupExtraMap>(
      (acc, page) => ({ ...acc, ...page.groupExtraData }),
      {} as GroupExtraMap
    );
    const threadMeta = data.pages.reduce<ThreadMetaMap>(
      (acc, page) => ({ ...acc, ...page.threadMeta }),
      {} as ThreadMetaMap
    );

    return { conversations, profiles, groupMembers, groupExtraData, threadMeta };
  }, [data?.pages]);

  return {
    conversations: merged.conversations,
    profiles: merged.profiles,
    groupMembers: merged.groupMembers,
    groupExtraData: merged.groupExtraData,
    threadMeta: merged.threadMeta,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    isFetching,
    error: isError ? (error as Error).message : null,
    reload: refetch,
    loadMore: fetchNextPage,
  };
};
