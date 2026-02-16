import { useContext, useEffect, useRef, useMemo, useState } from "react";
import { DeSoIdentityContext } from "react-deso-protocol";
import { useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";
import {
  fetchConversations,
  getConversationsQueryKey,
} from "@/state/queries/messages/list";
import { PublicKeyToProfileEntryResponseMap } from "deso-protocol";
import { ConversationMap } from "@/features/messaging/api/conversations";
import { identity } from "deso-protocol";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabaseClient";
import { Platform } from "react-native";
import type { GroupMember } from "@/lib/deso/graphql";

type Mailbox = "inbox" | "spam";

type ConversationsPage = Awaited<ReturnType<typeof fetchConversations>>;
type GroupMembersMap = Record<string, GroupMember[]>;
type GroupExtraMap = Record<string, Record<string, string> | null>;

type UseConversationsResult = {
  conversations: ConversationMap;
  profiles: PublicKeyToProfileEntryResponseMap;
  groupMembers: GroupMembersMap;
  groupExtraData: GroupExtraMap;
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

export const useConversations = (
  mailbox: Mailbox = "inbox",
  options: { enabled?: boolean } = {},
): UseConversationsResult => {
  const { currentUser } = useContext(DeSoIdentityContext);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [typingStatuses, setTypingStatuses] = useState<Record<string, boolean>>(
    {},
  );
  const [latestMessages, setLatestMessages] = useState<Record<string, any>>({});
  const typingTimeoutsRef = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});

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
    ConversationsPage,
    Error,
    InfiniteData<ConversationsPage>,
    ReturnType<typeof getConversationsQueryKey>,
    number
  >({
    queryKey: getConversationsQueryKey(
      currentUser?.PublicKeyBase58Check,
      mailbox,
    ),
    queryFn: async ({ pageParam }) => {
      try {
        return await fetchConversations(currentUser!.PublicKeyBase58Check, {
          offset: pageParam ?? 0,
          limit: 20,
          mailbox,
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
            console.warn(
              "Failed to logout after decryption error",
              logoutError,
            );
          }
        }
        throw e;
      }
    },
    getNextPageParam: (lastPage) =>
      lastPage && typeof lastPage === "object"
        ? (lastPage.nextOffset ?? undefined)
        : undefined,
    initialPageParam,
    enabled: !!currentUser?.PublicKeyBase58Check && (options.enabled ?? true),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

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
          debounceRef.current = setTimeout(
            () => {
              void refetch();
            },
            Platform.OS === "web" ? 150 : 75,
          );
        },
      )
      .subscribe((status, err) => {
        if (err) {
          console.warn("Supabase realtime subscription error", err);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("Supabase realtime subscription status", status);
        }
      })
      .on("broadcast", { event: "conversation_viewed" }, (payload) => {
        // Refetch conversations when a conversation is viewed on another device/tab
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
        debounceRef.current = setTimeout(
          () => {
            void refetch();
          },
          Platform.OS === "web" ? 150 : 75,
        );
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const { conversationId, is_typing } = payload;
        if (!conversationId) return;

        setTypingStatuses((prev) => ({
          ...prev,
          [conversationId]: is_typing,
        }));

        // Clear existing timeout
        if (typingTimeoutsRef.current[conversationId]) {
          clearTimeout(typingTimeoutsRef.current[conversationId]);
        }

        // Auto-clear typing status after 5 seconds if no updates
        if (is_typing) {
          typingTimeoutsRef.current[conversationId] = setTimeout(() => {
            setTypingStatuses((prev) => ({
              ...prev,
              [conversationId]: false,
            }));
          }, 5000);
        }
      })
      .on("broadcast", { event: "new_message" }, ({ payload }) => {
        // Optimistically update the latest message for the conversation
        const { conversationId, message } = payload;
        if (conversationId && message) {
          setLatestMessages((prev) => ({
            ...prev,
            [conversationId]: message,
          }));

          // Also trigger a refetch to ensure consistency
          if (debounceRef.current) {
            clearTimeout(debounceRef.current);
          }
          debounceRef.current = setTimeout(
            () => {
              void refetch();
            },
            Platform.OS === "web" ? 150 : 75,
          );
        }
      });

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      // Clear all typing timeouts
      Object.values(typingTimeoutsRef.current).forEach(clearTimeout);
      void channel.unsubscribe();
    };
  }, [currentUser?.PublicKeyBase58Check, refetch]);

  const merged = useMemo(() => {
    if (!data?.pages) {
      return {
        conversations: {},
        profiles: {},
        groupMembers: {} as GroupMembersMap,
        groupExtraData: {} as GroupExtraMap,
      };
    }
    const conversations = data.pages.reduce<ConversationsPage["conversations"]>(
      (acc, page) => ({ ...acc, ...page.conversations }),
      {},
    );
    const profiles = data.pages.reduce<ConversationsPage["profiles"]>(
      (acc, page) => ({ ...acc, ...page.profiles }),
      {},
    );
    const groupMembers = data.pages.reduce<GroupMembersMap>(
      (acc, page) => ({
        ...acc,
        ...page.groupMembers,
      }),
      {} as GroupMembersMap,
    );

    const groupExtraData = data.pages.reduce<GroupExtraMap>(
      (acc, page) => ({
        ...acc,
        ...page.groupExtraData,
      }),
      {} as GroupExtraMap,
    );
    return {
      conversations,
      profiles,
      groupMembers,
      groupExtraData,
    };
  }, [data?.pages]);

  return {
    conversations: merged.conversations,
    profiles: merged.profiles,
    groupMembers: merged.groupMembers,
    groupExtraData: merged.groupExtraData,
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
