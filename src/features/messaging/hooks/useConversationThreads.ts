import { useContext, useEffect, useMemo, useRef, useState } from "react";
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
  typingStatuses: Record<string, boolean>;
  latestMessages: Record<string, any>;
};

export const useConversationThreads = (
  options: { enabled?: boolean } = {}
): UseConversationThreadsResult => {
  const { currentUser } = useContext(DeSoIdentityContext);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();
  const [typingStatuses, setTypingStatuses] = useState<Record<string, boolean>>({});
  const [latestMessages, setLatestMessages] = useState<Record<string, any>>({});
  const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [reconnectKey, setReconnectKey] = useState(0);

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
    console.log("[useConversationThreads] Subscribing to global channel:", channelIdentifier);

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
      .on("broadcast", { event: "conversation_viewed" }, (payload) => {
        // Refetch conversations when a conversation is viewed on another device/tab
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
        debounceRef.current = setTimeout(() => {
          void refetch();
        }, Platform.OS === "web" ? 150 : 75);
      })
      .on("broadcast", { event: "typing" }, ({ payload }: { payload: any }) => {
        console.log("[useConversationThreads] Received typing event:", payload);
        const { conversationId, is_typing, senderPublicKey, metadata } = payload;

        // Determine the correct key for the conversation map
        // For DMs, the key is the sender's public key (from the recipient's perspective)
        // For Groups, it's the conversationId (which should be the group key)
        const key = metadata?.chatType === 'DM' && senderPublicKey
          ? senderPublicKey
          : conversationId;

        console.log("[useConversationThreads] Derived typing key:", key, "is_typing:", is_typing);

        if (!key) return;

        setTypingStatuses((prev) => ({
          ...prev,
          [key]: is_typing,
        }));

        // Clear existing timeout
        if (typingTimeoutsRef.current[key]) {
          clearTimeout(typingTimeoutsRef.current[key]);
        }

        // Auto-clear typing status after 5 seconds if no updates
        if (is_typing) {
          typingTimeoutsRef.current[key] = setTimeout(() => {
            setTypingStatuses((prev) => ({
              ...prev,
              [key]: false,
            }));
          }, 5000);
        }
      })
      .on("broadcast", { event: "new_message" }, ({ payload }: { payload: any }) => {
        console.log("[useConversationThreads] Received new_message event:", payload);
        // Optimistically update the latest message for the conversation
        const { conversationId, message } = payload;

        // For new messages, we need to find the correct conversation key too
        // The payload structure for new_message is slightly different, usually doesn't have metadata at top level
        // But let's check message.SenderInfo
        const senderPublicKey = message?.SenderInfo?.OwnerPublicKeyBase58Check;

        // We might need to infer chat type or just try both keys?
        // Actually, for new_message, we want to update the preview.
        // If it's a DM, conversationId sent by sender is RecipientPK. We want SenderPK.
        // If it's a Group, conversationId is GroupID.

        // Let's try to use senderPublicKey if it's a DM (implied if conversationId matches our PK?)
        // Or safer: update both potential keys if we aren't sure, or check if conversationId matches userPublicKey

        let key = conversationId;
        if (conversationId === userPublicKey && senderPublicKey) {
          key = senderPublicKey;
        }

        if (conversationId === userPublicKey && senderPublicKey) {
          key = senderPublicKey;
        }

        console.log("[useConversationThreads] Derived new_message key:", key);

        if (key && message) {
          setLatestMessages(prev => ({
            ...prev,
            [key]: message
          }));

          // Also trigger a refetch to ensure consistency
          if (debounceRef.current) {
            clearTimeout(debounceRef.current);
          }
          debounceRef.current = setTimeout(() => {
            void refetch();
          }, Platform.OS === "web" ? 150 : 75);
        }
      })
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          console.log("[useConversationThreads] Subscribed to global channel");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          console.warn(`[useConversationThreads] Channel status: ${status}. Attempting to reconnect...`);
          // Remove the channel to ensure a clean slate
          supabase.removeChannel(channel);
          // Trigger re-subscription after a short delay
          setTimeout(() => {
            setReconnectKey(prev => prev + 1);
          }, 1000);
        }
      });

    return () => {
      console.log("[useConversationThreads] Cleaning up global channel:", channelIdentifier);
      channel.unsubscribe();
    };
  }, [currentUser?.PublicKeyBase58Check, refetch, reconnectKey]);

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
    typingStatuses,
    latestMessages,
  };
};
