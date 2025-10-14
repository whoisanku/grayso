import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  ListRenderItem,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  AccessGroupEntryResponse,
  ChatType,
  DecryptedMessageEntryResponse,
} from "deso-protocol";
import {
  DEFAULT_KEY_MESSAGING_GROUP_NAME,
  fetchPaginatedDmThreadMessages,
  fetchPaginatedGroupThreadMessages,
} from "../services/conversations";
import { formatPublicKey } from "../utils/deso";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Conversation">;

const PAGE_SIZE = 25;

export default function ConversationScreen({ navigation, route }: Props) {
  const {
    threadPublicKey,
    chatType,
    userPublicKey,
    threadAccessGroupKeyName = DEFAULT_KEY_MESSAGING_GROUP_NAME,
    userAccessGroupKeyName = DEFAULT_KEY_MESSAGING_GROUP_NAME,
    partyGroupOwnerPublicKeyBase58Check,
    lastTimestampNanos,
    title,
    recipientInfo,
  } = route.params;

  const [messages, setMessages] = useState<DecryptedMessageEntryResponse[]>([]);
  const [accessGroups, setAccessGroups] = useState<AccessGroupEntryResponse[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursorTimestamp, setCursorTimestamp] = useState<number | undefined>(
    lastTimestampNanos
  );

  const isGroupChat = chatType === ChatType.GROUPCHAT;
  const counterPartyPublicKey =
    partyGroupOwnerPublicKeyBase58Check ?? threadPublicKey;

  const accessGroupsRef = useRef<AccessGroupEntryResponse[]>([]);
  const cursorTimestampRef = useRef<number | undefined>(lastTimestampNanos);
  const hasMoreRef = useRef(true);
  const isLoadingRef = useRef(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: title ?? "Conversation" });
  }, [navigation, title]);

  const mergeMessages = useCallback(
    (
      prev: DecryptedMessageEntryResponse[],
      next: DecryptedMessageEntryResponse[]
    ) => {
      const map = new Map<string, DecryptedMessageEntryResponse>();

      for (const message of [...prev, ...next]) {
        const key =
          message.MessageInfo?.TimestampNanosString ??
          `${message.MessageInfo?.TimestampNanos ?? Math.random()}`;
        if (!key) {
          continue;
        }
        map.set(key, message);
      }

      return Array.from(map.values()).sort(
        (a, b) => (b.MessageInfo?.TimestampNanos ?? 0) - (a.MessageInfo?.TimestampNanos ?? 0)
      );
    },
    []
  );

  const loadMessages = useCallback(
    async (initial = false, isPullToRefresh = false) => {
      if (isLoadingRef.current || (!initial && !hasMoreRef.current)) {
        return;
      }

      isLoadingRef.current = true;
      if (initial) {
        if (isPullToRefresh) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }
      } else {
        setIsLoading(true);
      }

      setError(null);

      try {
        let result: Awaited<ReturnType<typeof fetchPaginatedDmThreadMessages>>;

        if (isGroupChat) {
          const groupChatTimestamp = (lastTimestampNanos ?? Date.now() * 1_000_000) * 10;
          const payload = {
            UserPublicKeyBase58Check: recipientInfo?.OwnerPublicKeyBase58Check ?? messages[0]?.RecipientInfo?.OwnerPublicKeyBase58Check ?? userPublicKey,
            AccessGroupKeyName: threadAccessGroupKeyName,
            MaxMessagesToFetch: PAGE_SIZE,
            StartTimeStamp: groupChatTimestamp,
            StartTimeStampString: String(groupChatTimestamp),
          } as const;

          console.log("[ConversationScreen] Fetching group messages", {
            chatType,
            payload,
          });

          result = await fetchPaginatedGroupThreadMessages(
            payload,
            accessGroupsRef.current,
            userPublicKey
          );
        } else {
          const dmTimestamp = new Date().valueOf() * 1e6;
          const payload = {
            UserGroupOwnerPublicKeyBase58Check: userPublicKey,
            UserGroupKeyName: userAccessGroupKeyName,
            PartyGroupOwnerPublicKeyBase58Check: counterPartyPublicKey,
            PartyGroupKeyName: threadAccessGroupKeyName,
            MaxMessagesToFetch: PAGE_SIZE,
            StartTimeStamp: dmTimestamp,
            StartTimeStampString: String(dmTimestamp),
          } as const;

          console.log("[ConversationScreen] Fetching DM messages", {
            chatType,
            payload,
          });

          result = await fetchPaginatedDmThreadMessages(
            payload,
            accessGroupsRef.current
          );
        }

        const decryptedMessages = result.decrypted.filter(
          (msg): msg is DecryptedMessageEntryResponse => Boolean(msg)
        );

        console.log("[ConversationScreen] Decrypted messages:", decryptedMessages.map(m => ({
          hasDecryptedMessage: !!m.DecryptedMessage,
          decryptedMessage: m.DecryptedMessage?.substring(0, 50),
          error: (m as any).error,
          chatType: m.ChatType,
        })));

        setMessages((prev) => {
          if (initial) {
            return [...decryptedMessages].sort(
              (a, b) =>
                (b.MessageInfo?.TimestampNanos ?? 0) - (a.MessageInfo?.TimestampNanos ?? 0)
            );
          }
          return mergeMessages(prev, decryptedMessages);
        });

        accessGroupsRef.current = result.updatedAllAccessGroups;
        setAccessGroups(result.updatedAllAccessGroups);

        const nextHasMore = decryptedMessages.length === PAGE_SIZE;
        hasMoreRef.current = nextHasMore;
        setHasMore(nextHasMore);

        const oldestMessageInBatch = decryptedMessages.sort(
          (a, b) =>
            (a.MessageInfo?.TimestampNanos ?? 0) - (b.MessageInfo?.TimestampNanos ?? 0)
        )[0];

        if (oldestMessageInBatch?.MessageInfo?.TimestampNanos) {
          const nextCursor = Math.max(
            0,
            Number(oldestMessageInBatch.MessageInfo.TimestampNanos) - 1
          );
          cursorTimestampRef.current = nextCursor;
          setCursorTimestamp(nextCursor);
        } else if (initial) {
          cursorTimestampRef.current = undefined;
          setCursorTimestamp(undefined);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load messages");
      } finally {
        isLoadingRef.current = false;
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [
      counterPartyPublicKey,
      isGroupChat,
      lastTimestampNanos,
      mergeMessages,
      threadAccessGroupKeyName,
      userAccessGroupKeyName,
      userPublicKey,
    ]
  );

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      // Reset state for the new conversation
      setMessages([]);
      setCursorTimestamp(lastTimestampNanos);
      setAccessGroups([]);
      setHasMore(true);
      setError(null);
      setIsLoading(true);
      setIsRefreshing(false);

      accessGroupsRef.current = [];
      cursorTimestampRef.current = lastTimestampNanos;
      hasMoreRef.current = true;
      isLoadingRef.current = false;

      try {
        await loadMessages(true, false);
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load messages");
        }
      }
    };

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, [counterPartyPublicKey, userPublicKey, chatType, threadAccessGroupKeyName]);

  const renderItem: ListRenderItem<DecryptedMessageEntryResponse> = ({ item }) => {
    const senderPk = item.SenderInfo?.OwnerPublicKeyBase58Check;
    const hasError = (item as any).error;
    const preview = item.DecryptedMessage || (hasError ? `Error: ${hasError}` : "Decrypting...");
    const timestamp = item.MessageInfo?.TimestampNanos;

    return (
      <View style={styles.messageContainer}>
        <Text style={styles.sender}>{formatPublicKey(senderPk ?? "")}</Text>
        <Text style={styles.messageBody}>{preview}</Text>
        {timestamp ? (
          <Text style={styles.timestamp}>{formatTimestamp(timestamp)}</Text>
        ) : null}
      </View>
    );
  };

  const keyExtractor = (
    item: DecryptedMessageEntryResponse,
    index: number
  ): string => {
    return (
      item.MessageInfo?.TimestampNanosString ??
      `${item.MessageInfo?.TimestampNanos ?? "unknown"}-${index}`
    );
  };

  const header = useMemo(() => {
    if (!error) return null;
    return (
      <View style={styles.errorBanner}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }, [error]);

  const footer = useMemo(() => {
    if (!isLoading || messages.length === 0) return null;
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" />
      </View>
    );
  }, [isLoading, messages.length]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    >
      <FlatList
        data={messages}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        inverted
        contentContainerStyle={
          messages.length === 0 ? styles.emptyListContent : styles.listContent
        }
        onEndReachedThreshold={0.3}
        onEndReached={() => loadMessages(false)}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadMessages(true, true)}
          />
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            {isLoading ? (
              <ActivityIndicator size="large" />
            ) : (
              <Text style={styles.emptyText}>No messages yet.</Text>
            )}
          </View>
        )}
      />
    </KeyboardAvoidingView>
  );
}

function formatTimestamp(timestampNanos: number): string {
  const date = new Date(Number(timestampNanos) / 1_000_000);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now = Date.now();
  const diff = now - date.getTime();
  const oneDay = 24 * 60 * 60 * 1000;

  if (diff < oneDay) {
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  listContent: {
    flexGrow: 1,
    padding: 16,
    justifyContent: "flex-end",
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  messageContainer: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
  },
  sender: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 4,
  },
  messageBody: {
    fontSize: 14,
    color: "#0f172a",
  },
  timestamp: {
    marginTop: 6,
    fontSize: 11,
    color: "#94a3b8",
  },
  errorBanner: {
    padding: 12,
    backgroundColor: "#fee2e2",
    borderRadius: 12,
    marginBottom: 12,
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 14,
  },
  loadingFooter: {
    paddingVertical: 16,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyText: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 12,
  },
});
