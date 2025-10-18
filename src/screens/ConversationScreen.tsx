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
  Modal,
  NativeSyntheticEvent,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInputContentSizeChangeEventData,
  View,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  DeviceEventEmitter,
  Animated,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AccessGroupEntryResponse,
  ChatType,
  DecryptedMessageEntryResponse,
  PublicKeyToProfileEntryResponseMap,
  ProfileEntryResponse,
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
import { fetchAccessGroupMembers, GroupMember } from "../services/desoGraphql";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";
import { OUTGOING_MESSAGE_EVENT } from "../constants/events";

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
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [androidKeyboardOffset, setAndroidKeyboardOffset] = useState(0);
  const [reactionOverlay, setReactionOverlay] = useState<
    | {
        emoji: string;
        isSender: boolean;
      }
    | null
  >(null);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const lastRocketMessageKeyRef = useRef<string | null>(null);
  const reactionOverlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const reactionOverlayAnim = useRef(new Animated.Value(0)).current;

  const isGroupChat = chatType === ChatType.GROUPCHAT;
  const counterPartyPublicKey =
    partyGroupOwnerPublicKeyBase58Check ?? threadPublicKey;
  const recipientOwnerKey =
    (recipientInfo as { OwnerPublicKeyBase58Check?: string })?.OwnerPublicKeyBase58Check;

  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const conversationId = useMemo(
    () => `${counterPartyPublicKey}-${chatType}`,
    [counterPartyPublicKey, chatType]
  );

  const headerProfile = profiles[counterPartyPublicKey];
  
  const headerDisplayName = useMemo(() => {
    if (title?.trim()) {
      return title.trim();
    }
    if (isGroupChat) {
      return (
        recipientInfo?.AccessGroupKeyName ||
        headerProfile?.Username ||
        "Group"
      );
    }
    return getProfileDisplayName(headerProfile, counterPartyPublicKey);
  }, [counterPartyPublicKey, headerProfile, isGroupChat, recipientInfo?.AccessGroupKeyName, title]);

  const headerAvatarUri = useMemo(() => {
    if (isGroupChat) {
      return (
        getProfileImageUrl(recipientOwnerKey ?? counterPartyPublicKey, { groupChat: true }) ||
        FALLBACK_PROFILE_IMAGE
      );
    }
    return (
      getProfileImageUrl(counterPartyPublicKey) ||
      FALLBACK_PROFILE_IMAGE
    );
  }, [counterPartyPublicKey, isGroupChat, recipientOwnerKey]);

  const accessGroupsRef = useRef<AccessGroupEntryResponse[]>([]);
  const paginationCursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(true);
  const isLoadingRef = useRef(false);
  const oldestTimestampRef = useRef<number | null>(null);

  const loadGroupMembers = useCallback(async () => {
    if (!isGroupChat || loadingMembers) return;

    setLoadingMembers(true);
    try {
      const { members } = await fetchAccessGroupMembers({
        accessGroupKeyName: threadAccessGroupKeyName,
        accessGroupOwnerPublicKey: recipientOwnerKey ?? counterPartyPublicKey,
      });
      setGroupMembers(members);
    } catch (error) {
      console.error("[ConversationScreen] Failed to fetch group members", error);
    } finally {
      setLoadingMembers(false);
    }
  }, [isGroupChat, loadingMembers, threadAccessGroupKeyName, recipientOwnerKey, counterPartyPublicKey]);

  useEffect(() => {
    if (isGroupChat) {
      loadGroupMembers();
    }
  }, [isGroupChat, threadAccessGroupKeyName, recipientOwnerKey, counterPartyPublicKey]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View style={styles.headerTitleContainer}>
          <Image
            source={{ uri: headerAvatarUri }}
            style={styles.headerTitleAvatar}
          />
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={styles.headerTitleText}
          >
            {headerDisplayName || "Conversation"}
          </Text>
        </View>
      ),
    });
  }, [headerAvatarUri, headerDisplayName, navigation]);

  const mergeMessages = useCallback(
    (
      prev: DecryptedMessageEntryResponse[],
      next: DecryptedMessageEntryResponse[]
    ) => {
      const map = new Map<string, DecryptedMessageEntryResponse>();

      [...prev, ...next].forEach((message, idx) => {
        const timestamp =
          message.MessageInfo?.TimestampNanosString ??
          String(message.MessageInfo?.TimestampNanos ?? "");
        const senderKey =
          message.SenderInfo?.OwnerPublicKeyBase58Check ?? "unknown-sender";
        const uniqueKey = `${timestamp}-${senderKey}-${idx}`;

        map.set(uniqueKey, message);
      });

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
      console.log("[ConversationScreen] loadMessages called", {
        initial,
        isPullToRefresh,
        hasMore: hasMoreRef.current,
        isLoading: isLoadingRef.current,
        cursor: paginationCursorRef.current,
      });

      if (isLoadingRef.current || (!initial && !hasMoreRef.current)) {
        console.log("[ConversationScreen] loadMessages SKIPPED", {
          isLoading: isLoadingRef.current,
          hasMore: hasMoreRef.current,
        });
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
          const groupOwnerPublicKey =
            recipientOwnerKey ??
            partyGroupOwnerPublicKeyBase58Check ??
            counterPartyPublicKey ??
            userPublicKey;
          const payload = {
            UserPublicKeyBase58Check: groupOwnerPublicKey,
            AccessGroupKeyName: threadAccessGroupKeyName,
            MaxMessagesToFetch: PAGE_SIZE,
            StartTimeStamp: groupChatTimestamp,
            StartTimeStampString: String(groupChatTimestamp),
          } as const;

          console.log("[ConversationScreen] Fetching group messages", {
            chatType,
            payload,
            afterCursor: paginationCursorRef.current,
          });

          const groupResult = await fetchPaginatedGroupThreadMessages(
            payload,
            accessGroupsRef.current,
            userPublicKey,
            {
              afterCursor: initial ? null : paginationCursorRef.current,
              limit: PAGE_SIZE,
              recipientAccessGroupOwnerPublicKey: groupOwnerPublicKey,
            }
          );
          result = groupResult;
          pageInfo = groupResult.pageInfo;
        } else {
          const dmTimestamp = new Date().valueOf() * 1e6;
          const fallbackBeforeTimestamp = !initial
            ? oldestTimestampRef.current ?? undefined
            : undefined;
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
              fallbackBeforeTimestampNanos: fallbackBeforeTimestamp,
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
          const nextMessages = initial
            ? [...decryptedMessages].sort(
                (a, b) =>
                  (b.MessageInfo?.TimestampNanos ?? 0) -
                  (a.MessageInfo?.TimestampNanos ?? 0)
              )
            : mergeMessages(prev, decryptedMessages);

          const oldest =
            nextMessages[nextMessages.length - 1]?.MessageInfo
              ?.TimestampNanos ?? null;
          oldestTimestampRef.current = oldest;

          return nextMessages;
        });

        // Auto-load more if content doesn't fill screen
        if (initial && decryptedMessages.length === PAGE_SIZE && hasMoreRef.current) {
          setTimeout(() => {
            if (!isLoadingRef.current && hasMoreRef.current) {
              console.log("[ConversationScreen] Auto-loading more messages (content too short)");
              loadMessages(false);
            }
          }, 100);
        }

        accessGroupsRef.current = result.updatedAllAccessGroups;
        setAccessGroups(result.updatedAllAccessGroups);

        // Merge in any new profiles from the result for rendering avatars/usernames
        if (result.publicKeyToProfileEntryResponseMap) {
          setProfiles((prev) => ({
            ...prev,
            ...result.publicKeyToProfileEntryResponseMap,
          }));
        }

        if (!isGroupChat) {
          let nextCursor = pageInfo?.endCursor ?? paginationCursorRef.current;
          let nextHasMore = Boolean(pageInfo?.hasNextPage && nextCursor);

          if (!nextHasMore && decryptedMessages.length === PAGE_SIZE) {
            nextHasMore = true;
            if (!nextCursor) {
              nextCursor =
                decryptedMessages[decryptedMessages.length - 1]?.MessageInfo
                  ?.TimestampNanosString ?? null;
            }
          }

          paginationCursorRef.current = nextCursor ?? null;
          hasMoreRef.current = Boolean(nextHasMore && paginationCursorRef.current);
          setHasMore(hasMoreRef.current);
        } else {
          const nextHasMore = decryptedMessages.length === PAGE_SIZE;
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
      partyGroupOwnerPublicKeyBase58Check,
      mergeMessages,
      threadAccessGroupKeyName,
      userAccessGroupKeyName,
      userPublicKey,
      recipientOwnerKey,
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

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }

    const handleShow = (event: any) => {
      const height = event?.endCoordinates?.height ?? 0;
      setAndroidKeyboardOffset(Math.max(0, height - insets.bottom));
    };

    const handleHide = () => {
      setAndroidKeyboardOffset(0);
    };

    const showSub = Keyboard.addListener("keyboardDidShow", handleShow);
    const hideSub = Keyboard.addListener("keyboardDidHide", handleHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [insets.bottom]);

  useEffect(() => {
    return () => {
      if (reactionOverlayTimeoutRef.current) {
        clearTimeout(reactionOverlayTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!reactionOverlay) {
      return;
    }
    if (reactionOverlayTimeoutRef.current) {
      clearTimeout(reactionOverlayTimeoutRef.current);
    }
    reactionOverlayAnim.setValue(0);
    Animated.loop(
      Animated.sequence([
        Animated.timing(reactionOverlayAnim, {
          toValue: 1,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(reactionOverlayAnim, {
          toValue: -1,
          duration: 80,
          useNativeDriver: true,
        }),
      ]),
      { iterations: 6 }
    ).start();

    reactionOverlayTimeoutRef.current = setTimeout(() => {
      setReactionOverlay(null);
    }, 1200);
  }, [reactionOverlay]);

  useEffect(() => {
    if (messages.length === 0) {
      return;
    }

    const latest = messages[0];
    const messageText = latest.DecryptedMessage?.trim();
    if (messageText !== "🚀") {
      return;
    }

    const key =
      latest.MessageInfo?.TimestampNanosString ??
      `${latest.MessageInfo?.TimestampNanos ?? ""}-${
        latest.SenderInfo?.OwnerPublicKeyBase58Check ?? ""
      }`;

    if (!key || lastRocketMessageKeyRef.current === key) {
      return;
    }

    lastRocketMessageKeyRef.current = key;
    setReactionOverlay({
      emoji: "🚀",
      isSender: Boolean(latest.IsSender),
    });
  }, [messages]);

  const renderItem: ListRenderItem<DecryptedMessageEntryResponse> = ({
    item,
    index,
  }) => {
    const rawMessageText = item.DecryptedMessage?.trim();
    const senderPk = item.SenderInfo?.OwnerPublicKeyBase58Check ?? "";
    const isMine = Boolean(item.IsSender);
    const hasError = (item as any).error;
    const messageText =
      item.DecryptedMessage ||
      (hasError ? "Unable to decrypt this message." : "Decrypting…");
    const timestamp = item.MessageInfo?.TimestampNanos;
    const previousTimestamp =
      messages[index + 1]?.MessageInfo?.TimestampNanos ?? undefined;
    const nextMessage = messages[index - 1];
    const previousMessage = messages[index + 1];

    const senderProfile = profiles[senderPk];
    const displayName = getProfileDisplayName(senderProfile, senderPk);
    
    // For group chats, try to use profile pic from GraphQL first
    let avatarUri: string;
    if (isGroupChat && senderProfile?.ExtraData?.LargeProfilePicURL) {
      avatarUri = `https://node.deso.org/api/v0/get-single-profile-picture/${senderPk}?fallback=${senderProfile.ExtraData.LargeProfilePicURL}`;
    } else {
      avatarUri = getProfileImageUrl(senderPk, { groupChat: isGroupChat }) ?? FALLBACK_PROFILE_IMAGE;
    }
    const hasAvatar = Boolean(avatarUri);
    const showDayDivider = shouldShowDayDivider(timestamp, previousTimestamp);

    if (rawMessageText === "🚀") {
      return (
        <View style={{ marginBottom: 12 }}>
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
              <View className="mr-2" style={{ width: 32 }}>
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
            <Text
              style={
                isMine ? styles.rocketInlineEmoji : styles.rocketInlineEmojiOther
              }
            >
              🚀
            </Text>
          </View>
        </View>
      );
    }

    // Determine message grouping for curved edges
    const isNextMessageFromSameSender = nextMessage?.IsSender === item.IsSender;
    const isPreviousMessageFromSameSender = previousMessage?.IsSender === item.IsSender;
    
    // Check if messages are within 1 minute of each other for grouping
    const isNextMessageClose = nextMessage && timestamp && nextMessage.MessageInfo?.TimestampNanos
      ? Math.abs(timestamp - nextMessage.MessageInfo.TimestampNanos) < 60_000_000_000
      : false;
    const isPreviousMessageClose = previousMessage && timestamp && previousMessage.MessageInfo?.TimestampNanos
      ? Math.abs(timestamp - previousMessage.MessageInfo.TimestampNanos) < 60_000_000_000
      : false;

    const isFirstInGroup = !isPreviousMessageFromSameSender || !isPreviousMessageClose;
    const isLastInGroup = !isNextMessageFromSameSender || !isNextMessageClose;
    const isOnlyMessage = isFirstInGroup && isLastInGroup;

    // Dynamic border radius based on position in group
    const getBorderRadius = () => {
      if (isOnlyMessage) return { borderRadius: 20 };
      if (isMine) {
        if (isFirstInGroup) return { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomLeftRadius: 20, borderBottomRightRadius: 4 };
        if (isLastInGroup) return { borderTopLeftRadius: 20, borderTopRightRadius: 4, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 };
        return { borderTopLeftRadius: 20, borderTopRightRadius: 4, borderBottomLeftRadius: 20, borderBottomRightRadius: 4 };
      } else {
        if (isFirstInGroup) return { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomLeftRadius: 4, borderBottomRightRadius: 20 };
        if (isLastInGroup) return { borderTopLeftRadius: 4, borderTopRightRadius: 20, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 };
        return { borderTopLeftRadius: 4, borderTopRightRadius: 20, borderBottomLeftRadius: 4, borderBottomRightRadius: 20 };
      }
    };

    const marginBottom = isLastInGroup ? 12 : 2;

    return (
      <View style={{ marginBottom }}>
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
            <View className="mr-2" style={{ width: 32 }}>
              {isLastInGroup && hasAvatar ? (
                <Image
                  source={{ uri: avatarUri }}
                  className="h-8 w-8 rounded-full bg-gray-200"
                />
              ) : isLastInGroup ? (
                <View className="h-8 w-8 items-center justify-center rounded-full bg-gray-200">
                  <Feather name="user" size={16} color="#6b7280" />
                </View>
              ) : null}
            </View>
          ) : null}
          <View
            className={`max-w-[75%] px-3.5 py-2.5 ${
              isMine ? "bg-blue-500" : "bg-white"
            }`}
            style={[
              getBorderRadius(),
              isMine ? styles.outgoingBubbleShadow : styles.incomingBubbleShadow
            ]}
          >
            {!isMine && isFirstInGroup && (
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
            {isLastInGroup && (
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
            )}
          </View>
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
      <View className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3" style={{ transform: [{ scaleY: -1 }] }}>
        <Text className="text-sm font-medium text-red-900">{error}</Text>
      </View>
    );
  }, [error]);

  const footer = useMemo(() => {
    if (!isLoading || messages.length === 0) return null;
    return (
      <View className="py-5" style={{ transform: [{ scaleY: -1 }] }}>
        <ActivityIndicator size="small" color="#3b82f6" />
      </View>
    );
  }, [isLoading, messages.length]);

  const keyboardVerticalOffset = useMemo(() => {
    const offset = Number.isFinite(headerHeight) ? headerHeight : 0;
    return Platform.OS === "ios" ? offset : 0;
  }, [headerHeight]);

  const handleComposerMessageSent = useCallback(
    (messageText: string) => {
      const timestampNanos = Math.round(Date.now() * 1e6);
      if (messageText.trim() === "🚀") {
        setReactionOverlay({ emoji: "🚀", isSender: true });
        DeviceEventEmitter.emit(OUTGOING_MESSAGE_EVENT, {
          conversationId,
          messageText,
          timestampNanos,
          chatType,
          threadPublicKey: counterPartyPublicKey,
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

      setMessages((prev) => mergeMessages(prev, [optimisticMessage]));
    },
    [chatType, mergeMessages, userPublicKey]
  );

  const composerBottomInset = Math.max(insets.bottom, 8);

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
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
            onEndReachedThreshold={2}
            onEndReached={() => {
              console.log("[ConversationScreen] onEndReached triggered", {
                hasMore: hasMoreRef.current,
                isLoading: isLoadingRef.current,
                cursor: paginationCursorRef.current,
                messagesCount: messages.length,
              });
              if (!isLoadingRef.current && hasMoreRef.current) {
                loadMessages(false);
              }
            }}
            onScroll={(e) => {
              const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
              // For inverted list, scrolling up means contentOffset.y increases
              const distanceFromTop = contentOffset.y;
              
              console.log("[ConversationScreen] Scroll event", {
                contentOffsetY: contentOffset.y,
                contentHeight: contentSize.height,
                layoutHeight: layoutMeasurement.height,
                distanceFromTop,
              });
              
              if (distanceFromTop > 200 && !isLoadingRef.current && hasMoreRef.current) {
                console.log("[ConversationScreen] Manual scroll pagination trigger", {
                  distanceFromTop,
                  hasMore: hasMoreRef.current,
                });
                loadMessages(false);
              }
            }}
            scrollEventThrottle={200}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            refreshControl={
              <RefreshControl
                tintColor="#3b82f6"
                colors={["#3b82f6"]}
                refreshing={isRefreshing}
                onRefresh={() => loadMessages(true, true)}
              />
            }
            ListEmptyComponent={() => (
              <View className="items-center justify-center px-6 py-10" style={{ transform: [{ rotate: '180deg' }] }}>
                {isLoading ? (
                  <View className="items-center">
                    <ActivityIndicator size="large" color="#3b82f6" />
                    <Text className="mt-4 text-sm font-medium text-gray-500">
                      Loading messages...
                    </Text>
                  </View>
                ) : (
                  <View className="items-center rounded-2xl border border-gray-200 bg-white px-6 py-10">
                    <Feather name="message-circle" size={38} color="#9ca3af" />
                    <Text className="mt-4 text-lg font-semibold text-gray-900">
                      No messages yet
                    </Text>
                    <Text className="mt-1 text-center text-sm text-gray-500">
                      Start the conversation and it will appear here instantly.
                    </Text>
                  </View>
                )}
              </View>
            )}
          />
        </View>

        {isSendingMessage ? (
          <View style={styles.sendingBanner}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={styles.sendingBannerText}>Sending…</Text>
          </View>
        ) : null}

        {reactionOverlay ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.reactionOverlay,
              reactionOverlay.isSender
                ? styles.reactionOverlayRight
                : styles.reactionOverlayLeft,
              {
                transform: [
                  {
                    translateX: reactionOverlayAnim.interpolate({
                      inputRange: [-1, 1],
                      outputRange: [-4, 4],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.reactionOverlayEmoji}>
              {reactionOverlay.emoji}
            </Text>
          </Animated.View>
        ) : null}

        <Composer
          isGroupChat={isGroupChat}
          userPublicKey={userPublicKey}
          counterPartyPublicKey={counterPartyPublicKey}
          threadAccessGroupKeyName={threadAccessGroupKeyName}
          userAccessGroupKeyName={userAccessGroupKeyName}
          conversationId={conversationId}
          chatType={chatType}
          onMessageSent={handleComposerMessageSent}
          onSendingChange={setIsSendingMessage}
          bottomInset={composerBottomInset}
          androidKeyboardOffset={androidKeyboardOffset}
        />
      </KeyboardAvoidingView>

      <Modal
        visible={showMembersModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowMembersModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Group Members</Text>
            <TouchableOpacity
              onPress={() => setShowMembersModal(false)}
              style={styles.modalCloseButton}
            >
              <Feather name="x" size={24} color="#111" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {loadingMembers ? (
              <View style={styles.modalLoadingContainer}>
                <ActivityIndicator size="large" color="#3b82f6" />
              </View>
            ) : (
              groupMembers.map((member) => {
                const memberImageUrl = member.profilePic
                  ? `https://node.deso.org/api/v0/get-single-profile-picture/${member.publicKey}?fallback=${member.profilePic}`
                  : getProfileImageUrl(member.publicKey);
                return (
                  <View key={member.publicKey} style={styles.memberItem}>
                    <Image
                      source={{ uri: memberImageUrl }}
                      style={styles.memberAvatar}
                      resizeMode="cover"
                    />
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberUsername}>
                        {member.username || "Anonymous"}
                      </Text>
                      <Text style={styles.memberPublicKey} numberOfLines={1}>
                        {member.publicKey}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
            {!loadingMembers && groupMembers.length === 0 && (
              <View style={styles.modalEmptyContainer}>
                <Feather name="users" size={48} color="#9ca3af" />
                <Text style={styles.modalEmptyText}>No members found</Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  headerBackButton: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  headerTitle: {
    color: "#111",
    fontSize: 18,
    fontWeight: "600",
  },
  headerRightContainer: {
    paddingRight: 8,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#0ea5e9",
  },
  headerAvatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  groupAvatarsContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  groupMemberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#e5e7eb",
    borderWidth: 2,
    borderColor: "#fff",
  },
  groupMemberAvatarMore: {
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
  },
  groupMemberAvatarMoreText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  outgoingBubbleShadow: {
    shadowColor: "#3b82f6",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  incomingBubbleShadow: {
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  composerContainer: {
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 4,
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
    marginTop: 8,
    justifyContent: "space-between",
  },
  inputShell: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)",
  },
  composerTextInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    color: "#1e293b",
    padding: 0,
    marginLeft: 8,
  },
  inputEmoji: {
    opacity: 0.75,
  },
  trailingActions: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 10,
  },
  actionTouchable: {
    marginHorizontal: 6,
  },
  iconButtonBase: {
    height: 40,
    width: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonDisabled: {
    backgroundColor: "rgba(148, 163, 184, 0.4)",
  },
  iconButtonSend: {
    backgroundColor: "#2563eb",
  },
  sendButtonShadow: {
    shadowColor: "#2563eb",
    shadowOpacity: 0.45,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  rocketIcon: {
    fontSize: 24,
    marginLeft: 6,
  },
  rocketTouchable: {
    paddingHorizontal: 6,
  },
  rocketInlineEmoji: {
    fontSize: 28,
    color: "#2563eb",
  },
  rocketInlineEmojiOther: {
    fontSize: 28,
    color: "#0f172a",
  },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitleAvatar: {
    height: 34,
    width: 34,
    borderRadius: 17,
    marginRight: 10,
    backgroundColor: "#e5e7eb",
  },
  headerTitleText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    maxWidth: 180,
  },
  reactionOverlay: {
    position: "absolute",
    bottom: 108,
    alignItems: "center",
    zIndex: 20,
    elevation: 8,
  },
  reactionOverlayLeft: {
    left: 24,
  },
  reactionOverlayRight: {
    right: 24,
  },
  reactionOverlayEmoji: {
    fontSize: 42,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  sendingBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    backgroundColor: "rgba(37, 99, 235, 0.08)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(37, 99, 235, 0.25)",
  },
  sendingBannerText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: "600",
    color: "#1d4ed8",
    letterSpacing: 0.3,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111",
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
  },
  modalLoadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  modalEmptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  modalEmptyText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6b7280",
  },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#e5e7eb",
  },
  memberInfo: {
    marginLeft: 12,
    flex: 1,
  },
  memberUsername: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111",
    marginBottom: 2,
  },
  memberPublicKey: {
    fontSize: 12,
    color: "#6b7280",
  },
});


type ComposerProps = {
  isGroupChat: boolean;
  userPublicKey: string;
  counterPartyPublicKey: string;
  threadAccessGroupKeyName: string;
  userAccessGroupKeyName: string;
  conversationId: string;
  chatType: ChatType;
  onMessageSent?: (messageText: string) => void;
  onSendingChange?: (sending: boolean) => void;
  bottomInset?: number;
  androidKeyboardOffset?: number;
};

function Composer({
  isGroupChat,
  userPublicKey,
  counterPartyPublicKey,
  threadAccessGroupKeyName,
  userAccessGroupKeyName,
  conversationId,
  chatType,
  onMessageSent,
  onSendingChange,
  bottomInset = 0,
  androidKeyboardOffset = 0,
}: ComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [inputHeight, setInputHeight] = useState(32);
  const textInputRef = useRef<TextInput>(null);

  const focusInput = useCallback(() => {
    textInputRef.current?.focus();
  }, []);

  const handleContentSizeChange = useCallback(
    (event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
      const nextHeight = Math.min(
        120,
        Math.max(32, event.nativeEvent.contentSize.height)
      );
      setInputHeight(nextHeight);
    },
    []
  );

  const onSend = useCallback(async (messageText?: string) => {
    const textToSend = messageText || text.trim();
    if (!textToSend || sending) return;
    try {
      setSending(true);
      onSendingChange?.(true);

      await encryptAndSendNewMessage(
        textToSend,
        userPublicKey,
        counterPartyPublicKey,
        threadAccessGroupKeyName,
        userAccessGroupKeyName
      );

      const timestampNanos = Math.round(Date.now() * 1e6);
      onMessageSent?.(textToSend);
      DeviceEventEmitter.emit(OUTGOING_MESSAGE_EVENT, {
        conversationId,
        messageText: textToSend,
        timestampNanos,
        chatType,
        threadPublicKey: counterPartyPublicKey,
        threadAccessGroupKeyName,
        userAccessGroupKeyName,
      });
      setText("");
      focusInput();
    } catch (e) {
      console.error("Send message error", e);
    } finally {
      setSending(false);
      onSendingChange?.(false);
    }
  }, [
    text,
    sending,
    userPublicKey,
    counterPartyPublicKey,
    threadAccessGroupKeyName,
    userAccessGroupKeyName,
    onMessageSent,
    onSendingChange,
    focusInput,
    conversationId,
    chatType,
  ]);

  const sendRocket = useCallback(() => {
    onSend("🚀");
  }, [onSend]);

  const sendDisabled = sending || !text.trim();

  const containerPaddingBottom = bottomInset + androidKeyboardOffset;

  const sendButtonInnerStyle = [
    styles.iconButtonBase,
    sendDisabled ? styles.iconButtonDisabled : styles.iconButtonSend,
    !sendDisabled ? styles.sendButtonShadow : null,
  ];

  return (
    <View
      style={[styles.composerContainer, { paddingBottom: containerPaddingBottom }]}
    >
      <View style={styles.composerRow}>
        <View style={styles.inputShell}>
          <Feather name="smile" size={20} color="#60a5fa" style={styles.inputEmoji} />
          <TextInput
            ref={textInputRef}
            placeholder={isGroupChat ? "Message the group…" : "Message…"}
            placeholderTextColor="rgba(31, 41, 55, 0.45)"
            value={text}
            onChangeText={setText}
            multiline
            keyboardAppearance="light"
            autoCorrect
            autoCapitalize="sentences"
            textAlignVertical="center"
            returnKeyType="default"
            blurOnSubmit={false}
            onContentSizeChange={handleContentSizeChange}
            style={[
              styles.composerTextInput,
              {
                minHeight: 32,
                maxHeight: 80,
              },
            ]}
          />
        </View>
        <View style={styles.trailingActions}>
          {text.trim().length === 0 ? (
            <TouchableOpacity
              onPress={sendRocket}
              disabled={sending}
              activeOpacity={0.85}
              style={[styles.actionTouchable, styles.rocketTouchable]}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#2563eb" />
              ) : (
                <Text style={styles.rocketIcon}>🚀</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => onSend()}
              disabled={sendDisabled}
              activeOpacity={0.85}
              style={styles.actionTouchable}
            >
              <View style={sendButtonInnerStyle as any}>
                {sending ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Feather
                    name="send"
                    size={18}
                    color="#ffffff"
                    style={{ marginLeft: 2 }}
                  />
                )}
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}
