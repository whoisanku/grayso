import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { DeSoIdentityContext } from "react-deso-protocol";
import {
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { identity, getAllAccessGroups, type AccessGroupEntryResponse } from "deso-protocol";
import { Platform } from "react-native";

import {
  conversationThreadsKeys,
  fetchConversationThreads,
} from "@/state/queries/messages/threads";
import {
  decryptAccessGroupMessagesWithRetry,
  findAccessGroupPublicKey,
} from "@/features/messaging/api/conversations";
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
  const accessGroupsRef = useRef<AccessGroupEntryResponse[]>([]);
  const hasLoggedErrorRef = useRef(false);

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
    staleTime: 8000,
    refetchInterval: 8000,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const stableRefetch = useCallback(() => {
    void refetch();
  }, [refetch]);

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
    if (!data?.pages) return;

    for (const page of data.pages) {
      if (page?.accessGroups && page.accessGroups.length > 0) {
        accessGroupsRef.current = page.accessGroups;
        break;
      }
    }
  }, [data?.pages]);

  useEffect(() => {
    let isMounted = true;
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
          if (!isMounted) return;
          // Debounce refetches to avoid flooding when multiple inserts arrive
          if (debounceRef.current) {
            clearTimeout(debounceRef.current);
          }
          debounceRef.current = setTimeout(() => {
            if (isMounted) stableRefetch();
          }, Platform.OS === "web" ? 150 : 75);
        }
      )
      .on("broadcast", { event: "conversation_viewed" }, (payload) => {
        if (!isMounted) return;
        // Refetch conversations when a conversation is viewed on another device/tab
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
        debounceRef.current = setTimeout(() => {
          if (isMounted) stableRefetch();
        }, Platform.OS === "web" ? 150 : 75);
      })
      .on("broadcast", { event: "typing" }, ({ payload }: { payload: any }) => {
        if (!isMounted) return;
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
        console.log("✅ [useConversationThreads] Received new_message broadcast event:", payload);
        if (!isMounted) return;
        console.log("[useConversationThreads] Processing new_message event:", payload);
        // Optimistically update the latest message for the conversation
        const { conversationId, message } = payload;

        if (!message) {
          console.warn("[useConversationThreads] Payload missing message object");
          return;
        }

        // For new messages, we need to find the correct conversation key too
        // The payload structure for new_message is slightly different, usually doesn't have metadata at top level
        // But let's check message.SenderInfo
        const senderPublicKey = message?.SenderInfo?.OwnerPublicKeyBase58Check;

        // We might need to infer chat type or just try both keys?
        // Actually, for new_message, we want to update the preview.
        // If it's a DM, conversationId sent by sender is RecipientPK. We want SenderPK.
        // If it's a Group, conversationId is GroupID.

        // For DMs, the key should be the sender's public key. For group chats, it's the conversationId.
        const key = message?.ChatType === 'DM' && senderPublicKey
          ? senderPublicKey
          : conversationId;

        console.log("[useConversationThreads] Derived new_message key:", key);

        if (key && message) {
          // Normalize the message structure for decryption
          // The payload might have flat fields (EncryptedMessageText) or nested (MessageInfo.EncryptedText)

          let recipientOwnerPk = message.RecipientInfo?.OwnerPublicKeyBase58Check || message.RecipientAccessGroupOwnerPublicKeyBase58Check || "";

          // If recipient PK is missing, try to derive it
          if (!recipientOwnerPk && userPublicKey) {
            const senderPk = message.SenderInfo?.OwnerPublicKeyBase58Check || message.SenderAccessGroupOwnerPublicKeyBase58Check || "";

            if (senderPk && senderPk !== userPublicKey) {
              // If I am not the sender, I must be the recipient
              recipientOwnerPk = userPublicKey;
            } else if (senderPk === userPublicKey && conversationId) {
              // If I am the sender, the other key in conversationId is the recipient
              // Format is usually PK1-PK2-DM or similar. 
              // We can try to remove our key and see what's left.
              const parts = conversationId.split('-');
              const otherPart = parts.find((p: string) => p !== userPublicKey && p.startsWith('BC1'));
              if (otherPart) {
                recipientOwnerPk = otherPart;
              }
            }
          }

          // Try to find Access Group Public Keys if missing
          const senderAccessGroupKeyName = message.SenderInfo?.AccessGroupKeyName || message.SenderAccessGroupKeyName || "default-key";
          const recipientAccessGroupKeyName = message.RecipientInfo?.AccessGroupKeyName || message.RecipientAccessGroupKeyName || "default-key";

          const senderOwnerPk = message.SenderInfo?.OwnerPublicKeyBase58Check || message.SenderAccessGroupOwnerPublicKeyBase58Check || "";

          // We need to find the Access Group Public Key for both sender and recipient
          // We can look in accessGroupsRef.current

          // Helper to find key in our local cache
          const findKey = (ownerPk: string, keyName: string) => {
            if (!ownerPk) return "";
            return findAccessGroupPublicKey(accessGroupsRef.current, ownerPk, keyName) || "";
          };

          let senderAccessGroupPk = message.SenderInfo?.AccessGroupPublicKeyBase58Check ||
            message.SenderAccessGroupPublicKeyBase58Check ||
            findKey(senderOwnerPk, senderAccessGroupKeyName);

          // If sender access group PK is still missing, we must fetch it
          if (!senderAccessGroupPk && senderOwnerPk) {
            try {
              // We can't await here easily without making the whole thing async, which it is (void async IIFE below)
              // But we need the key BEFORE constructing messageToDecrypt if we want to be clean.
              // Actually, we can do it inside the async block.
            } catch (e) {
              console.warn("[useConversationThreads] Failed to fetch sender access groups", e);
            }
          }

          const recipientAccessGroupPk = message.RecipientInfo?.AccessGroupPublicKeyBase58Check ||
            message.RecipientAccessGroupPublicKeyBase58Check ||
            findKey(recipientOwnerPk, recipientAccessGroupKeyName);


          if (!userPublicKey) {
            console.warn("[useConversationThreads] Missing user public key for decryption");
            return;
          }

          void (async () => {
            try {
              // Fetch sender access group key if missing
              if (!senderAccessGroupPk && senderOwnerPk) {
                try {
                  const senderGroups = await getAllAccessGroups({ PublicKeyBase58Check: senderOwnerPk });
                  const allSenderGroups = (senderGroups.AccessGroupsOwned || []).concat(senderGroups.AccessGroupsMember || []);
                  senderAccessGroupPk = findAccessGroupPublicKey(allSenderGroups, senderOwnerPk, senderAccessGroupKeyName) || "";
                  console.log("[useConversationThreads] Fetched sender access group key:", senderAccessGroupPk);
                } catch (e) {
                  console.warn("[useConversationThreads] Failed to fetch sender access groups", e);
                }
              }

              const messageToDecrypt = {
                ...message,
                ChatType: message.ChatType || (message.RecipientAccessGroupKeyName ? 'GROUPCHAT' : 'DM'),
                SenderInfo: {
                  OwnerPublicKeyBase58Check: senderOwnerPk,
                  AccessGroupPublicKeyBase58Check: senderAccessGroupPk,
                  AccessGroupKeyName: senderAccessGroupKeyName,
                },
                RecipientInfo: {
                  OwnerPublicKeyBase58Check: recipientOwnerPk,
                  AccessGroupPublicKeyBase58Check: recipientAccessGroupPk,
                  AccessGroupKeyName: recipientAccessGroupKeyName,
                },
                MessageInfo: {
                  EncryptedText: message.MessageInfo?.EncryptedText || message.EncryptedMessageText || "",
                  TimestampNanos: message.MessageInfo?.TimestampNanos || payload.timestampNanos || 0,
                  TimestampNanosString: String(message.MessageInfo?.TimestampNanos || payload.timestampNanos || 0),
                  ExtraData: message.MessageInfo?.ExtraData || message.ExtraData || {},
                },
              };

              const { decrypted, updatedAllAccessGroups } =
                await decryptAccessGroupMessagesWithRetry(
                  userPublicKey,
                  [messageToDecrypt],
                  accessGroupsRef.current
                );

              if (!isMounted) return;

              accessGroupsRef.current = updatedAllAccessGroups;

              if (decrypted.length > 0) {
                const decryptedMsg = decrypted[0];
                if (decryptedMsg.error) {
                  console.warn("[useConversationThreads] Decryption returned error:", decryptedMsg.error);
                } else {
                  setLatestMessages(prev => ({
                    ...prev,
                    [key]: decryptedMsg
                  }));
                }
              }
            } catch (error) {
              if (!isMounted) return;
              console.warn("[useConversationThreads] Failed to decrypt new_message payload", error);
            }
          })();
        }
      })
      .subscribe((status, err) => {
        if (!isMounted) return;
        if (status === "SUBSCRIBED") {
          console.log("[useConversationThreads] Subscribed to global channel");
          hasLoggedErrorRef.current = false; // Reset on successful connection
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          if (!hasLoggedErrorRef.current) {
            console.warn(`[useConversationThreads] Channel ${status}. Will attempt reconnects silently.`);
            hasLoggedErrorRef.current = true;
          }
          // Trigger re-subscription after a short delay
          setTimeout(() => {
            if (isMounted) setReconnectKey(prev => prev + 1);
          }, 3000); // Increased delay to reduce reconnect frequency
        }
      });

    return () => {
      isMounted = false;
      console.log("[useConversationThreads] Cleaning up global channel:", channelIdentifier);
      channel.unsubscribe();
    };
  }, [currentUser?.PublicKeyBase58Check, stableRefetch, reconnectKey]);

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
