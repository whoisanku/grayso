import {
  ChatType,
  DecryptedMessageEntryResponse,
  PublicKeyToProfileEntryResponseMap,
} from "deso-protocol";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  InfiniteData,
} from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { DeviceEventEmitter } from "react-native";
import {
  getMessagesQueryKey,
  fetchMessages,
} from "../../state/queries/messages";
import {
  DEFAULT_KEY_MESSAGING_GROUP_NAME,
} from "../../constants/messaging";
import { OUTGOING_MESSAGE_EVENT } from "../../constants/events";
import { StorageService } from "../../services/storage";

type UseConversationMessagesProps = {
  threadPublicKey: string;
  chatType: ChatType;
  userPublicKey: string;
  threadAccessGroupKeyName?: string;
  userAccessGroupKeyName?: string;
  partyGroupOwnerPublicKeyBase58Check?: string;
  lastTimestampNanos?: number;
  recipientInfo?: any;
  conversationId: string;
};

export const useConversationMessages = ({
  threadPublicKey,
  chatType,
  userPublicKey,
  threadAccessGroupKeyName = DEFAULT_KEY_MESSAGING_GROUP_NAME,
  userAccessGroupKeyName = DEFAULT_KEY_MESSAGING_GROUP_NAME,
  partyGroupOwnerPublicKeyBase58Check,
  conversationId,
}: UseConversationMessagesProps) => {
  const queryClient = useQueryClient();

  const queryKey = getMessagesQueryKey(
    conversationId,
    userPublicKey,
    threadPublicKey,
    chatType
  );

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    refetch,
    isError,
    error,
    isLoading,
  } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) =>
      fetchMessages({
        pageParam,
        userPublicKey,
        threadPublicKey,
        chatType,
        threadAccessGroupKeyName,
        userAccessGroupKeyName,
        partyGroupOwnerPublicKeyBase58Check,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.pageInfo.endCursor,
    staleTime: 1000 * 60, // 1 minute
  });

  const messages = useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap((page) => page.decrypted);
  }, [data]);

  const profiles = useMemo(() => {
    if (!data) return {};
    return data.pages.reduce((acc, page) => {
      return { ...acc, ...page.publicKeyToProfileEntryResponseMap };
    }, {} as PublicKeyToProfileEntryResponseMap);
  }, [data]);

  const handleComposerMessageSent = useCallback(
    (messageText: string) => {
      const timestampNanos = Math.round(Date.now() * 1e6);
      if (messageText.trim() === "🚀") {
         // Keep existing event emitter logic if needed
        DeviceEventEmitter.emit(OUTGOING_MESSAGE_EVENT, {
          conversationId,
          messageText,
          timestampNanos,
          chatType,
          threadPublicKey,
          threadAccessGroupKeyName,
          userAccessGroupKeyName,
        });
        return;
      }

      const optimisticMessage = {
        DecryptedMessage: messageText,
        IsSender: true,
        MessageInfo: {
          TimestampNanos: timestampNanos,
          TimestampNanosString: String(timestampNanos),
        },
        SenderInfo: {
          OwnerPublicKeyBase58Check: userPublicKey,
        },
        ChatType: chatType,
      } as DecryptedMessageEntryResponse;

      // Optimistic Update
      queryClient.setQueryData<InfiniteData<{ decrypted: DecryptedMessageEntryResponse[] }>>(
        queryKey,
        (oldData) => {
          if (!oldData) return oldData;
          const newPages = [...oldData.pages];
          if (newPages.length > 0) {
              // Add to first page
            newPages[0] = {
              ...newPages[0],
              decrypted: [optimisticMessage, ...newPages[0].decrypted],
            };
          }
          return {
            ...oldData,
            pages: newPages,
          };
        }
      );

      // Also save to storage if needed, but Query Cache is primary now
      // StorageService.saveChatHistory(conversationId, ...);
    },
    [
      chatType,
      userPublicKey,
      conversationId,
      threadPublicKey,
      threadAccessGroupKeyName,
      userAccessGroupKeyName,
      queryClient,
      queryKey,
    ]
  );

  return {
    messages,
    setMessages: () => {}, // No-op, managed by Query
    isLoading: isLoading || (isFetching && !isFetchingNextPage),
    isRefreshing: isFetching && !isFetchingNextPage,
    hasMore: hasNextPage,
    error: isError ? error?.message : null,
    profiles,
    isSendingMessage: false, // TODO: Implement mutation state
    setIsSendingMessage: () => {},
    loadMessages: async (initial = false) => {
        if (initial) {
            await refetch();
        } else {
            await fetchNextPage();
        }
    },
    handleComposerMessageSent,
    messageIdMap: new Map(), // TODO: derived state
    mergeMessages: () => [], // Deprecated
    profileCacheRef: { current: new Map() }, // Deprecated
  };
};
