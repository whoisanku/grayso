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
  Text,
  View,
  Image,
  TextInput,
  TouchableOpacity,
} from "react-native";
import {
  AccessGroupEntryResponse,
  ChatType,
  DecryptedMessageEntryResponse,
  PublicKeyToProfileEntryResponseMap,
} from "deso-protocol";
import {
  DEFAULT_KEY_MESSAGING_GROUP_NAME,
  encryptAndSendNewMessage,
  fetchPaginatedDmThreadMessages,
  fetchPaginatedGroupThreadMessages,
} from "../services/conversations";
import {
  FALLBACK_PROFILE_IMAGE,
  formatPublicKey,
  getProfileDisplayName,
  getProfileImageUrl,
} from "../utils/deso";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Conversation">;

const PAGE_SIZE = 10;

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
  const [profiles, setProfiles] = useState<PublicKeyToProfileEntryResponseMap>(
    {}
  );

  const isGroupChat = chatType === ChatType.GROUPCHAT;
  const counterPartyPublicKey =
    partyGroupOwnerPublicKeyBase58Check ?? threadPublicKey;

  const accessGroupsRef = useRef<AccessGroupEntryResponse[]>([]);
  const paginationCursorRef = useRef<string | null>(null);
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
        (a, b) =>
          (b.MessageInfo?.TimestampNanos ?? 0) -
          (a.MessageInfo?.TimestampNanos ?? 0)
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
        paginationCursorRef.current = null;
        hasMoreRef.current = true;
        setHasMore(true);
      } else {
        setIsLoading(true);
      }

      setError(null);

      try {
        let pageInfo: {
          hasNextPage: boolean;
          endCursor: string | null;
        } | null = null;
        let result:
          | Awaited<ReturnType<typeof fetchPaginatedDmThreadMessages>>
          | Awaited<ReturnType<typeof fetchPaginatedGroupThreadMessages>>;

        if (isGroupChat) {
          const groupChatTimestamp =
            (lastTimestampNanos ?? Date.now() * 1_000_000) * 10;
          const payload = {
            UserPublicKeyBase58Check:
              recipientInfo?.OwnerPublicKeyBase58Check ??
              messages[0]?.RecipientInfo?.OwnerPublicKeyBase58Check ??
              userPublicKey,
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

          const dmResult = await fetchPaginatedDmThreadMessages(
            payload,
            accessGroupsRef.current,
            {
              afterCursor: initial ? null : paginationCursorRef.current,
              limit: PAGE_SIZE,
            }
          );
          result = dmResult;
          pageInfo = dmResult.pageInfo;
        }

        const decryptedMessages = result.decrypted.filter(
          (msg): msg is DecryptedMessageEntryResponse => Boolean(msg)
        );

        console.log(
          "[ConversationScreen] Decrypted messages:",
          decryptedMessages.map((m) => ({
            hasDecryptedMessage: !!m.DecryptedMessage,
            decryptedMessage: m.DecryptedMessage?.substring(0, 50),
            error: (m as any).error,
            chatType: m.ChatType,
          }))
        );

        setMessages((prev) => {
          if (initial) {
            return [...decryptedMessages].sort(
              (a, b) =>
                (b.MessageInfo?.TimestampNanos ?? 0) -
                (a.MessageInfo?.TimestampNanos ?? 0)
            );
          }
          return mergeMessages(prev, decryptedMessages);
        });

        accessGroupsRef.current = result.updatedAllAccessGroups;
        setAccessGroups(result.updatedAllAccessGroups);

        // Merge in any new profiles from the result for rendering avatars/usernames
        if (result.publicKeyToProfileEntryResponseMap) {
          setProfiles((prev) => ({
            ...prev,
            ...result.publicKeyToProfileEntryResponseMap,
          }));
        }

        if (!isGroupChat && pageInfo) {
          const nextCursor = pageInfo.endCursor ?? null;
          const nextHasMore =
            Boolean(pageInfo.hasNextPage) && Boolean(nextCursor);
          paginationCursorRef.current = nextCursor;
          hasMoreRef.current = nextHasMore;
          setHasMore(nextHasMore);
        } else {
          const nextHasMore = decryptedMessages.length === PAGE_SIZE;
          paginationCursorRef.current = null;
          hasMoreRef.current = nextHasMore;
          setHasMore(nextHasMore);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load messages"
        );
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
      setAccessGroups([]);
      setHasMore(true);
      setError(null);
      setIsLoading(true);
      setIsRefreshing(false);

      accessGroupsRef.current = [];
      paginationCursorRef.current = null;
      hasMoreRef.current = true;
      isLoadingRef.current = false;

      try {
        await loadMessages(true, false);
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error ? err.message : "Failed to load messages"
          );
        }
      }
    };

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, [
    counterPartyPublicKey,
    userPublicKey,
    chatType,
    threadAccessGroupKeyName,
  ]);

  const renderItem: ListRenderItem<DecryptedMessageEntryResponse> = ({
    item,
  }) => {
    const senderPk = item.SenderInfo?.OwnerPublicKeyBase58Check ?? "";
    const isMine = Boolean(item.IsSender);
    const hasError = (item as any).error;
    const messageText =
      item.DecryptedMessage ||
      (hasError ? `Error: ${hasError}` : "Decrypting...");
    const timestamp = item.MessageInfo?.TimestampNanos;

    const senderProfile = profiles[senderPk];
    const displayName = getProfileDisplayName(senderProfile, senderPk);
    const avatarUri = getProfileImageUrl(senderPk, { groupChat: isGroupChat });

    return (
      <View
        className={`mb-3 flex-row items-end ${
          isMine ? "justify-end" : "justify-start"
        }`}
      >
        {!isMine && (
          <Image
            source={{ uri: avatarUri }}
            className="mx-2 h-8 w-8 rounded-full bg-slate-200"
          />
        )}

        <View
          className={`max-w-[75%] rounded-2xl p-2.5 ${
            isMine
              ? "rounded-tr-sm bg-emerald-100"
              : "rounded-tl-sm bg-slate-100"
          }`}
        >
          <Text
            className={`mb-1 text-xs font-semibold ${
              isMine ? "text-emerald-700 text-right" : "text-slate-600"
            }`}
          >
            {displayName}
          </Text>
          <Text
            className={`text-sm text-slate-900 ${
              isMine ? "text-right" : "text-left"
            }`}
          >
            {messageText}
          </Text>
          {timestamp ? (
            <Text
              className={`mt-1.5 text-[11px] text-slate-400 ${
                isMine ? "text-right" : "text-left"
              }`}
            >
              {formatTimestamp(timestamp)}
            </Text>
          ) : null}
        </View>

        {isMine && (
          <Image
            source={{ uri: avatarUri }}
            className="mx-2 h-8 w-8 rounded-full bg-slate-200"
          />
        )}
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
      <View className="mb-3 rounded-xl bg-red-50 p-3">
        <Text className="text-sm text-red-700">{error}</Text>
      </View>
    );
  }, [error]);

  const footer = useMemo(() => {
    if (!isLoading || messages.length === 0) return null;
    return (
      <View className="py-4">
        <ActivityIndicator size="small" />
      </View>
    );
  }, [isLoading, messages.length]);

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
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
        contentContainerClassName={
          messages.length === 0 ? "flex-grow items-center justify-center p-4" : "flex-grow justify-end p-4"
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
          <View className="items-center justify-center p-8">
            {isLoading ? (
              <ActivityIndicator size="large" />
            ) : (
              <Text className="mt-3 text-sm text-slate-500">No messages yet.</Text>
            )}
          </View>
        )}
      />

      <Composer
        isGroupChat={isGroupChat}
        userPublicKey={userPublicKey}
        counterPartyPublicKey={counterPartyPublicKey}
        threadAccessGroupKeyName={threadAccessGroupKeyName}
        userAccessGroupKeyName={userAccessGroupKeyName}
        onSent={() => loadMessages(true, true)}
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


type ComposerProps = {
  isGroupChat: boolean;
  userPublicKey: string;
  counterPartyPublicKey: string;
  threadAccessGroupKeyName: string;
  userAccessGroupKeyName: string;
  onSent?: () => void;
};

function Composer({
  isGroupChat,
  userPublicKey,
  counterPartyPublicKey,
  threadAccessGroupKeyName,
  userAccessGroupKeyName,
  onSent,
}: ComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const onSend = useCallback(async () => {
    if (!text.trim() || sending) return;
    try {
      setSending(true);

      // Use shared encryptAndSendNewMessage from services
      await encryptAndSendNewMessage(
        text.trim(),
        userPublicKey,
        counterPartyPublicKey,
        threadAccessGroupKeyName,
        userAccessGroupKeyName
      );

      // Optimistic clear and refresh
      setText("");
      onSent && onSent();
    } catch (e) {
      console.error("Send message error", e);
    } finally {
      setSending(false);
    }
  }, [
    text,
    sending,
    isGroupChat,
    userPublicKey,
    threadAccessGroupKeyName,
    onSent,
  ]);

  return (
    <View className="flex-row items-center border-t border-slate-200 bg-white px-3 py-2">
      <TextInput
        className="mr-2 flex-1 rounded-full border border-slate-200 px-3 py-2 text-base text-slate-900"
        placeholder={isGroupChat ? "Message group" : "Message"}
        value={text}
        onChangeText={setText}
        multiline
      />
      <TouchableOpacity
        className={`rounded-full bg-blue-600 px-3.5 py-2.5 ${
          sending || !text.trim() ? "opacity-50" : ""
        }`}
        onPress={onSend}
        disabled={sending || !text.trim()}
      >
        <Text className="font-semibold text-white">
          {sending ? "Sending" : "Send"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
