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
  NativeSyntheticEvent,
  Platform,
  RefreshControl,
  Text,
  TextInputContentSizeChangeEventData,
  View,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
  getProfileDisplayName,
  getProfileImageUrl,
} from "../utils/deso";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

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
    index,
  }) => {
    const senderPk = item.SenderInfo?.OwnerPublicKeyBase58Check ?? "";
    const isMine = Boolean(item.IsSender);
    const hasError = (item as any).error;
    const messageText =
      item.DecryptedMessage ||
      (hasError ? "Unable to decrypt this message." : "Decrypting…");
    const timestamp = item.MessageInfo?.TimestampNanos;
    const previousTimestamp =
      messages[index + 1]?.MessageInfo?.TimestampNanos ?? undefined;

    const senderProfile = profiles[senderPk];
    const displayName = getProfileDisplayName(senderProfile, senderPk);
    const avatarUri =
      getProfileImageUrl(senderPk, { groupChat: isGroupChat }) ??
      FALLBACK_PROFILE_IMAGE;
    const hasAvatar = Boolean(avatarUri);
    const showDayDivider = shouldShowDayDivider(timestamp, previousTimestamp);

    return (
      <View className="mb-3">
        {showDayDivider ? (
          <View className="items-center py-3">
            <View className="rounded-full bg-gray-200 px-3 py-1">
              <Text className="text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                {formatDayLabel(timestamp)}
              </Text>
            </View>
          </View>
        ) : null}
        <View
          className={`flex-row px-1 ${
            isMine ? "justify-end" : "justify-start"
          }`}
        >
          {!isMine ? (
            <View className="mr-2">
              {hasAvatar ? (
                <Image
                  source={{ uri: avatarUri }}
                  className="h-8 w-8 rounded-full bg-gray-200"
                />
              ) : (
                <View className="h-8 w-8 items-center justify-center rounded-full bg-gray-200">
                  <Feather name="user" size={16} color="#6b7280" />
                </View>
              )}
            </View>
          ) : null}
          <View
            className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 ${
              isMine ? "bg-blue-500" : "bg-white"
            }`}
            style={
              isMine ? styles.outgoingBubbleShadow : styles.incomingBubbleShadow
            }
          >
            {!isMine && (
              <Text
                className="mb-1 text-[10px] font-semibold text-gray-500"
                numberOfLines={1}
              >
                {displayName}
              </Text>
            )}
            <Text
              className={`text-[15px] leading-5 ${
                isMine ? "text-white" : "text-gray-900"
              }`}
            >
              {messageText}
            </Text>
            <View
              className={`mt-1 flex-row items-center ${
                isMine ? "justify-end" : "justify-start"
              }`}
            >
              {hasError ? (
                <Text className="text-[10px] font-medium text-red-500">
                  Failed to decrypt
                </Text>
              ) : (
                <>
                  {timestamp ? (
                    <Text
                      className={`text-[10px] ${
                        isMine ? "text-white/80" : "text-gray-400"
                      }`}
                    >
                      {formatTimestamp(timestamp)}
                    </Text>
                  ) : null}
                  {isMine ? (
                    <Feather
                      name="check"
                      size={12}
                      color="rgba(255,255,255,0.75)"
                      style={{ marginLeft: 4 }}
                    />
                  ) : null}
                </>
              )}
            </View>
          </View>
          {isMine ? (
            <View className="ml-2">
              {hasAvatar ? (
                <Image
                  source={{ uri: avatarUri }}
                  className="h-8 w-8 rounded-full bg-blue-100"
                />
              ) : (
                <View className="h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                  <Feather name="user" size={16} color="#3b82f6" />
                </View>
              )}
            </View>
          ) : null}
        </View>
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
      <View className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
        <Text className="text-sm font-medium text-red-900">{error}</Text>
      </View>
    );
  }, [error]);

  const footer = useMemo(() => {
    if (!isLoading || messages.length === 0) return null;
    return (
      <View className="py-5">
        <ActivityIndicator size="small" color="#3b82f6" />
      </View>
    );
  }, [isLoading, messages.length]);

  const keyboardVerticalOffset = Platform.OS === "ios" ? 78 : 0;

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        <View className="flex-1">
          <FlatList
            data={messages}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ListHeaderComponent={header}
            ListFooterComponent={footer}
            inverted
            showsVerticalScrollIndicator={false}
            contentContainerClassName={
              messages.length === 0
                ? "flex-grow items-center justify-center px-6 pb-16"
                : "px-4 pb-8"
            }
            maintainVisibleContentPosition={
              Platform.OS === "ios"
                ? { minIndexForVisible: 0, autoscrollToTopThreshold: 40 }
                : undefined
            }
            onEndReachedThreshold={0.35}
            onEndReached={() => loadMessages(false)}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                tintColor="#3b82f6"
                colors={["#3b82f6"]}
                refreshing={isRefreshing}
                onRefresh={() => loadMessages(true, true)}
              />
            }
            ListEmptyComponent={() => (
              <View className="items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-10">
                {isLoading ? (
                  <ActivityIndicator size="large" color="#3b82f6" />
                ) : (
                  <>
                    <Feather name="message-circle" size={38} color="#9ca3af" />
                    <Text className="mt-4 text-lg font-semibold text-gray-900">
                      No messages yet
                    </Text>
                    <Text className="mt-1 text-center text-sm text-gray-500">
                      Start the conversation and it will appear here instantly.
                    </Text>
                  </>
                )}
              </View>
            )}
          />
        </View>

        <Composer
          isGroupChat={isGroupChat}
          userPublicKey={userPublicKey}
          counterPartyPublicKey={counterPartyPublicKey}
          threadAccessGroupKeyName={threadAccessGroupKeyName}
          userAccessGroupKeyName={userAccessGroupKeyName}
          onSent={() => loadMessages(true, true)}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
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

function shouldShowDayDivider(
  currentTimestampNanos?: number,
  previousTimestampNanos?: number
): boolean {
  if (!currentTimestampNanos) {
    return false;
  }

  if (!previousTimestampNanos) {
    return true;
  }

  const currentDate = new Date(currentTimestampNanos / 1_000_000);
  const previousDate = new Date(previousTimestampNanos / 1_000_000);

  if (
    Number.isNaN(currentDate.getTime()) ||
    Number.isNaN(previousDate.getTime())
  ) {
    return false;
  }

  return !isSameCalendarDay(currentDate, previousDate);
}

function formatDayLabel(timestampNanos?: number): string {
  if (!timestampNanos) {
    return "";
  }

  const date = new Date(timestampNanos / 1_000_000);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);

  if (isSameCalendarDay(date, now)) {
    return "Today";
  }

  if (isSameCalendarDay(date, yesterday)) {
    return "Yesterday";
  }

  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const styles = StyleSheet.create({
  incomingBubbleShadow: {
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  outgoingBubbleShadow: {
    shadowColor: "#3b82f6",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  composerShadow: {
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
});


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
  const [inputHeight, setInputHeight] = useState(44);
  const textInputRef = useRef<TextInput>(null);

  const focusInput = useCallback(() => {
    if (Platform.OS === "ios") {
      requestAnimationFrame(() => textInputRef.current?.focus());
    } else {
      textInputRef.current?.focus();
    }
  }, []);

  const handleContentSizeChange = useCallback(
    (event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
      const nextHeight = Math.min(
        140,
        Math.max(44, event.nativeEvent.contentSize.height)
      );
      setInputHeight(nextHeight);
    },
    []
  );

  const onSend = useCallback(async () => {
    if (!text.trim() || sending) return;
    try {
      setSending(true);

      await encryptAndSendNewMessage(
        text.trim(),
        userPublicKey,
        counterPartyPublicKey,
        threadAccessGroupKeyName,
        userAccessGroupKeyName
      );

      setText("");
      focusInput();
      onSent && onSent();
    } catch (e) {
      console.error("Send message error", e);
    } finally {
      setSending(false);
    }
  }, [
    text,
    sending,
    userPublicKey,
    counterPartyPublicKey,
    threadAccessGroupKeyName,
    userAccessGroupKeyName,
    onSent,
    focusInput,
  ]);

  const sendDisabled = sending || !text.trim();

  return (
    <View className="border-t border-gray-200 bg-white px-4 pb-4 pt-3">
      <View
        className="flex-row items-center rounded-3xl border border-gray-200 bg-gray-50 px-4 py-2"
        style={styles.composerShadow}
      >
        <TextInput
          ref={textInputRef}
          className="flex-1 text-base leading-5 text-gray-900"
          placeholder={isGroupChat ? "Message the group…" : "Message…"}
          placeholderTextColor="#9ca3af"
          value={text}
          onChangeText={setText}
          multiline
          keyboardAppearance="light"
          autoCorrect
          autoCapitalize="sentences"
          textAlignVertical="top"
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={onSend}
          onContentSizeChange={handleContentSizeChange}
          style={{
            minHeight: 40,
            maxHeight: 120,
            height: inputHeight,
            paddingTop: 8,
            paddingBottom: 8,
          }}
        />
        <TouchableOpacity
          className="ml-3"
          onPress={onSend}
          disabled={sendDisabled}
          activeOpacity={0.8}
        >
          <View
            className={`h-10 w-10 items-center justify-center rounded-full ${
              sendDisabled ? "bg-blue-300" : "bg-blue-500"
            }`}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Feather
                name="send"
                size={16}
                color="#ffffff"
              />
            )}
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}
