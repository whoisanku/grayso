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
  Keyboard,
  DeviceEventEmitter,
  Animated,
} from "react-native";
import Swipeable from 'react-native-gesture-handler/Swipeable';
import * as Haptics from 'expo-haptics';
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
import { Feather, Ionicons } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";

import { OUTGOING_MESSAGE_EVENT } from "../constants/events";
import { useColorScheme } from "nativewind";
import { KeyboardAvoidingView, useKeyboardHandler } from "react-native-keyboard-controller";
import { runOnJS } from "react-native-reanimated";
import ScreenWrapper from "../components/ScreenWrapper";

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
    initialGroupMembers,
  } = route.params;

  const [messages, setMessages] = useState<DecryptedMessageEntryResponse[]>([]);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
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
  const [reactionOverlay, setReactionOverlay] = useState<
    | {
      emoji: string;
      isSender: boolean;
    }
    | null
  >(null);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>(
    initialGroupMembers || []
  );
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<DecryptedMessageEntryResponse | null>(null);
  const lastRocketMessageKeyRef = useRef<string | null>(null);
  const reactionOverlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const reactionOverlayAnim = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);
  const scrollOffsetRef = useRef(0);

  const checkAndScrollToBottom = useCallback(() => {
    if (scrollOffsetRef.current < 50) {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
  }, []);

  useKeyboardHandler({
    onStart: (e) => {
      "worklet";
      if (e.height > 0) {
        runOnJS(checkAndScrollToBottom)();
      }
    }
  }, [checkAndScrollToBottom]);

  const isGroupChat = chatType === ChatType.GROUPCHAT;
  const counterPartyPublicKey =
    partyGroupOwnerPublicKeyBase58Check ?? threadPublicKey;
  const recipientOwnerKey =
    (recipientInfo as { OwnerPublicKeyBase58Check?: string })?.OwnerPublicKeyBase58Check;

  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
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
    if (isGroupChat && groupMembers.length === 0) {
      loadGroupMembers();
    }
  }, [isGroupChat, threadAccessGroupKeyName, recipientOwnerKey, counterPartyPublicKey, groupMembers.length]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const mergeMessages = useCallback(
    (
      prev: DecryptedMessageEntryResponse[],
      next: DecryptedMessageEntryResponse[]
    ) => {
      const map = new Map<string, DecryptedMessageEntryResponse>();

      // Add new messages first (source of truth)
      next.forEach((message) => {
        const timestamp =
          message.MessageInfo?.TimestampNanosString ??
          String(message.MessageInfo?.TimestampNanos ?? "");
        const senderKey =
          message.SenderInfo?.OwnerPublicKeyBase58Check ?? "unknown-sender";
        const uniqueKey = `${timestamp}-${senderKey}`;
        map.set(uniqueKey, message);
      });

      // Merge previous messages, checking for duplicates
      prev.forEach((message) => {
        const timestamp =
          message.MessageInfo?.TimestampNanosString ??
          String(message.MessageInfo?.TimestampNanos ?? "");
        const senderKey =
          message.SenderInfo?.OwnerPublicKeyBase58Check ?? "unknown-sender";
        const uniqueKey = `${timestamp}-${senderKey}`;

        if (map.has(uniqueKey)) return;

        // Fuzzy duplicate check for optimistic messages
        // If we have a message with same content, sender, and roughly same time (5s window)
        const isDuplicate = Array.from(map.values()).some((existing) => {
          const timeDiff = Math.abs(
            (existing.MessageInfo?.TimestampNanos ?? 0) -
            (message.MessageInfo?.TimestampNanos ?? 0)
          );
          return (
            existing.DecryptedMessage === message.DecryptedMessage &&
            existing.SenderInfo?.OwnerPublicKeyBase58Check ===
            message.SenderInfo?.OwnerPublicKeyBase58Check &&
            timeDiff < 5000 * 1e6 // 5 seconds
          );
        });

        if (!isDuplicate) {
          map.set(uniqueKey, message);
        }
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
      `${latest.MessageInfo?.TimestampNanos ?? ""}-${latest.SenderInfo?.OwnerPublicKeyBase58Check ?? ""
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

  const handleReply = useCallback((message: DecryptedMessageEntryResponse) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReplyToMessage(message);
  }, []);

  // Create a lookup map for fast message retrieval by ID (TimestampNanosString)
  const messageIdMap = useMemo(() => {
    const map = new Map<string, DecryptedMessageEntryResponse>();
    messages.forEach((m) => {
      if (m.MessageInfo?.TimestampNanosString) {
        map.set(m.MessageInfo.TimestampNanosString, m);
      }
    });
    return map;
  }, [messages]);

  const renderItem: ListRenderItem<DecryptedMessageEntryResponse> = ({
    item,
    index,
  }) => {
    return (
      <MessageBubble
        item={item}
        index={index}
        messages={messages}
        profiles={profiles}
        isGroupChat={isGroupChat}
        onReply={handleReply}
        messageIdMap={messageIdMap}
        isDark={isDark}
      />
    );
  };

  // Extracted to a separate component to use hooks/refs correctly
  const MessageBubble = ({
    item,
    index,
    messages,
    profiles,
    isGroupChat,
    onReply,
    messageIdMap,
    isDark,
  }: {
    item: DecryptedMessageEntryResponse;
    index: number;
    messages: DecryptedMessageEntryResponse[];
    profiles: PublicKeyToProfileEntryResponseMap;
    isGroupChat: boolean;
    onReply: (message: DecryptedMessageEntryResponse) => void;
    messageIdMap: Map<string, DecryptedMessageEntryResponse>;
    isDark: boolean;
  }) => {
    const swipeableRef = useRef<Swipeable>(null);
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

    // Reply logic
    const repliedToMessageId = item.MessageInfo?.ExtraData?.RepliedToMessageId;
    const repliedToMessage = repliedToMessageId
      ? messageIdMap.get(repliedToMessageId)
      : null;

    const renderReplyPreview = () => {
      if (!repliedToMessageId) return null;

      // If we found the message locally, use it. Otherwise try fallback from ExtraData.
      const fallbackText = item.MessageInfo?.ExtraData?.RepliedToMessageDecryptedText;
      const replyText = repliedToMessage?.DecryptedMessage || fallbackText || "Message not loaded";

      const replySenderPk = repliedToMessage?.SenderInfo?.OwnerPublicKeyBase58Check;
      const replySenderProfile = replySenderPk ? profiles[replySenderPk] : null;
      const replyDisplayName = replySenderPk
        ? getProfileDisplayName(replySenderProfile, replySenderPk)
        : "Replied Message";

      return (
        <View
          style={{
            backgroundColor: isMine ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.05)",
            borderLeftWidth: 4,
            borderLeftColor: isMine ? "rgba(255, 255, 255, 0.5)" : "#3b82f6",
            borderRadius: 4,
            padding: 6,
            marginBottom: 6,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "700",
              color: isMine ? "rgba(255, 255, 255, 0.9)" : "#3b82f6",
              marginBottom: 2,
            }}
            numberOfLines={1}
          >
            {replyDisplayName}
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: isMine ? "rgba(255, 255, 255, 0.8)" : "#4b5563",
            }}
            numberOfLines={2}
          >
            {replyText}
          </Text>
        </View>
      );
    };

    const renderSwipeAction = (
      _progress: Animated.AnimatedInterpolation<number>,
      dragX: Animated.AnimatedInterpolation<number>
    ) => {
      const scale = dragX.interpolate({
        inputRange: [-50, 0, 50],
        outputRange: [1, 0, 1],
        extrapolate: "clamp",
      });

      return (
        <View
          style={{
            justifyContent: "center",
            alignItems: "center",
            width: 50,
            height: "100%",
          }}
        >
          <Animated.View style={{ transform: [{ scale }] }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: isDark ? "#334155" : "#e2e8f0",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Feather name="corner-up-left" size={18} color={isDark ? "#cbd5e1" : "#64748b"} />
            </View>
          </Animated.View>
        </View>
      );
    };

    if (rawMessageText === "🚀") {
      return (
        <View style={{ marginBottom: 12 }}>
          {showDayDivider ? (
            <View className="items-center py-1">
              <View className="rounded-full bg-gray-200 px-3 py-1 dark:bg-slate-800">
                <Text className="text-[10px] font-semibold uppercase tracking-wide text-gray-600 dark:text-slate-400">
                  {formatDayLabel(timestamp)}
                </Text>
              </View>
            </View>
          ) : null}
          <View
            className={`flex-row px-1 ${isMine ? "justify-end" : "justify-start"
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
                  <View className="h-8 w-8 items-center justify-center rounded-full bg-gray-200 dark:bg-slate-700">
                    <Feather name="user" size={16} color={isDark ? "#94a3b8" : "#6b7280"} />
                  </View>
                )}
              </View>
            ) : null}
            <Text
              className={`text-[28px] ${isMine ? "text-[#4f46e5]" : "text-[#0f172a] dark:text-white"
                }`}
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
        if (isLastInGroup) return { borderTopLeftRadius: 20, borderTopRightRadius: 0, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 };
        return { borderTopLeftRadius: 20, borderTopRightRadius: 4, borderBottomLeftRadius: 20, borderBottomRightRadius: 4 };
      } else {
        if (isFirstInGroup) return { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomLeftRadius: 4, borderBottomRightRadius: 20 };
        if (isLastInGroup) return { borderTopLeftRadius: 0, borderTopRightRadius: 20, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 };
        return { borderTopLeftRadius: 4, borderTopRightRadius: 20, borderBottomLeftRadius: 4, borderBottomRightRadius: 20 };
      }
    };

    const marginBottom = isLastInGroup ? 16 : 2;

    return (
      <View style={{ marginBottom }}>
        {showDayDivider ? (
          <View className="items-center py-1">
            <View className="rounded-full bg-gray-200 px-3 py-1 dark:bg-slate-800">
              <Text className="text-[10px] font-semibold uppercase tracking-wide text-gray-600 dark:text-slate-400">
                {formatDayLabel(timestamp)}
              </Text>
            </View>
          </View>
        ) : null}
        <Swipeable
          ref={swipeableRef}
          renderRightActions={isMine ? renderSwipeAction : undefined}
          renderLeftActions={isMine ? undefined : renderSwipeAction}
          onSwipeableWillOpen={() => {
            onReply(item);
            swipeableRef.current?.close();
          }}
          overshootRight={false}
          overshootLeft={false}
        >
          <View
            className={`flex-row px-1 ${isMine ? "justify-end" : "justify-start"
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
                  <View className="h-8 w-8 items-center justify-center rounded-full bg-gray-200 dark:bg-slate-700">
                    <Feather name="user" size={16} color={isDark ? "#94a3b8" : "#6b7280"} />
                  </View>
                ) : null}
              </View>
            ) : null}
            <View
              className={`max-w-[75%] px-4 py-3 ${isMine ? "bg-[#0085ff]" : "bg-[#f1f3f5] dark:bg-[#161e27]"
                }`}
              style={[
                getBorderRadius(),
              ]}
            >
              {!isMine && isFirstInGroup && (
                <Text
                  className="mb-1 text-[11px] font-bold text-slate-500 dark:text-slate-400"
                  numberOfLines={1}
                >
                  {displayName}
                </Text>
              )}
              {renderReplyPreview()}
              <Text
                className={`text-[16px] leading-[22px] ${isMine ? "text-white" : "text-[#0f172a] dark:text-white"
                  }`}
              >
                {messageText}
              </Text>
              {isLastInGroup && (
                <View
                  className={`mt-1.5 flex-row items-center ${isMine ? "justify-end" : "justify-start"
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
                          className={`text-[11px] ${isMine ? "text-blue-100" : "text-slate-400 dark:text-slate-500"
                            }`}
                        >
                          {formatTimestamp(timestamp)}
                        </Text>
                      ) : null}
                    </>
                  )}
                </View>
              )}
            </View>
          </View>
        </Swipeable>
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
    if (messages.length === 0) return null;

    return (
      <View className="py-4 items-center">
        {isLoading ? (
          <ActivityIndicator size="small" color="#3b82f6" />
        ) : hasMore ? (
          <TouchableOpacity
            onPress={() => loadMessages(false)}
            className="bg-slate-100 px-4 py-2 rounded-full active:bg-slate-200 dark:bg-slate-800 dark:active:bg-slate-700"
          >
            <Text className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Load older messages
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }, [isLoading, messages.length, hasMore, loadMessages]);

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
    <ScreenWrapper
      edges={['top', 'left', 'right', 'bottom']}
      keyboardAvoiding={true}
      keyboardVerticalOffset={0}
      backgroundColor={isDark ? "#000000" : "#ffffff"}
      useKeyboardController={true}
    >
      {/* Custom Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-black">
        <View className="flex-row items-center flex-1">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="mr-3"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="arrow-left" size={24} color={isDark ? "#f8fafc" : "#0f172a"} />
          </TouchableOpacity>

          <View className="flex-1">
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              className="text-[17px] font-bold tracking-[-0.3px] text-[#0f172a] dark:text-[#f8fafc]"
            >
              {headerDisplayName || "Conversation"}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => {
            if (isGroupChat) {
              setShowMembersModal(true);
            }
          }}
          disabled={!isGroupChat}
          activeOpacity={0.6}
          className="flex-row items-center ml-2"
        >
          {isGroupChat ? (
            <View className="flex-row">
              {loadingMembers || (groupMembers.length === 0 && !headerAvatarUri) ? (
                // Loading placeholders
                [0, 1, 2].map((i) => (
                  <View
                    key={`placeholder-${i}`}
                    className={`h-9 w-9 rounded-full bg-slate-200 border-2 border-white dark:bg-slate-700 dark:border-slate-800 ${i > 0 ? "-ml-[15px]" : ""}`}
                    style={{
                      zIndex: 3 - i,
                    }}
                  />
                ))
              ) : (
                groupMembers.slice(0, 3).map((member, index) => {
                  const uri = member.profilePic
                    ? `https://node.deso.org/api/v0/get-single-profile-picture/${member.publicKey}?fallback=${member.profilePic}`
                    : getProfileImageUrl(member.publicKey) || FALLBACK_PROFILE_IMAGE;

                  return (
                    <View
                      key={member.publicKey}
                      className={`h-9 w-9 rounded-full bg-slate-200 border-2 border-white dark:bg-slate-700 dark:border-slate-800 ${index > 0 ? "-ml-[15px]" : ""}`}
                      style={{
                        zIndex: 3 - index,
                      }}
                    >
                      <Image
                        source={{ uri }}
                        className="h-full w-full rounded-full"
                      />
                    </View>
                  );
                })
              )}
            </View>
          ) : (
            <Image
              source={{ uri: headerAvatarUri }}
              className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-700"
            />
          )}
        </TouchableOpacity>
      </View>
      <View className="flex-1">
        {isLoading && messages.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
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
                : "px-4 pb-3"
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
              scrollOffsetRef.current = distanceFromTop;

              // Show scroll-to-bottom button if we are more than 400px up
              if (distanceFromTop > 400) {
                if (!showScrollToBottom) setShowScrollToBottom(true);
              } else {
                if (showScrollToBottom) setShowScrollToBottom(false);
              }

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
              <View className="items-center justify-center px-6 py-10">
                {isLoading ? (
                  <View className="items-center">
                    <ActivityIndicator size="large" color="#3b82f6" />
                    <Text className="mt-4 text-sm font-medium text-gray-500">
                      Loading messages...
                    </Text>
                  </View>
                ) : (
                  <View className="items-center rounded-2xl border border-gray-200 bg-white px-6 py-10 dark:border-slate-800 dark:bg-slate-900">
                    <Feather name="message-circle" size={38} color={isDark ? "#64748b" : "#9ca3af"} />
                    <Text className="mt-4 text-lg font-semibold text-gray-900 dark:text-slate-200">
                      No messages yet
                    </Text>
                    <Text className="mt-1 text-center text-sm text-gray-500 dark:text-slate-400">
                      Start the conversation and it will appear here instantly.
                    </Text>
                  </View>
                )}
              </View>
            )}
          />
        )}
        {showScrollToBottom && (
          <TouchableOpacity
            onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
            className="absolute bottom-4 right-4 h-10 w-10 bg-white dark:bg-slate-700 rounded-full items-center justify-center shadow-md border border-gray-200 dark:border-slate-600 z-10"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 4,
              elevation: 4
            }}
          >
            <Feather name="chevron-down" size={24} color={isDark ? "#fff" : "#4b5563"} />
          </TouchableOpacity>
        )}
      </View>

      {isSendingMessage ? (
        <View className="flex-row items-center justify-center py-1.5 bg-[#4f46e5]/10 border-t border-[#4f46e5]/20">
          <ActivityIndicator size="small" color="#2563eb" />
          <Text className="ml-2 text-xs font-semibold text-[#4f46e5] tracking-wide">Sending…</Text>
        </View>
      ) : null}

      {reactionOverlay ? (
        <Animated.View
          pointerEvents="none"
          className={`absolute bottom-[108px] z-20 items-center elevation-8 ${reactionOverlay.isSender ? "right-6" : "left-6"
            }`}
          style={{
            transform: [
              {
                translateX: reactionOverlayAnim.interpolate({
                  inputRange: [-1, 1],
                  outputRange: [-4, 4],
                }),
              },
            ],
          }}
        >
          <Text className="text-[42px] shadow-black/30 shadow-offset-[0px_4px] shadow-radius-8 elevation-4">
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
        recipientAccessGroupPublicKeyBase58Check={recipientInfo?.AccessGroupPublicKeyBase58Check}
        replyToMessage={replyToMessage}
        onCancelReply={() => setReplyToMessage(null)}
        profiles={profiles}
      />

      <Modal
        visible={showMembersModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowMembersModal(false)}
      >
        <SafeAreaView className="flex-1 bg-white dark:bg-black">
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-800">
            <Text className="text-xl font-bold text-[#111] dark:text-white">Group Members</Text>
            <TouchableOpacity
              onPress={() => setShowMembersModal(false)}
              className="p-1"
            >
              <Feather name="x" size={24} color={isDark ? "#fff" : "#111"} />
            </TouchableOpacity>
          </View>
          <ScrollView className="flex-1">
            {loadingMembers ? (
              <View className="flex-1 items-center justify-center py-14">
                <ActivityIndicator size="large" color="#3b82f6" />
              </View>
            ) : (
              groupMembers.map((member) => {
                const memberImageUrl = member.profilePic
                  ? `https://node.deso.org/api/v0/get-single-profile-picture/${member.publicKey}?fallback=${member.profilePic}`
                  : getProfileImageUrl(member.publicKey);
                return (
                  <View key={member.publicKey} className="flex-row items-center px-5 py-3 border-b border-gray-100 dark:border-slate-800">
                    <Image
                      source={{ uri: memberImageUrl }}
                      className="h-12 w-12 rounded-full bg-gray-200 dark:bg-slate-700"
                      resizeMode="cover"
                    />
                    <View className="ml-3 flex-1">
                      <Text className="text-base font-semibold text-[#111] dark:text-white mb-0.5">
                        {member.username || "Anonymous"}
                      </Text>
                      <Text className="text-xs text-gray-500 dark:text-gray-400" numberOfLines={1}>
                        {member.publicKey}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
            {!loadingMembers && groupMembers.length === 0 && (
              <View className="flex-1 items-center justify-center py-14">
                <Feather name="users" size={48} color="#9ca3af" />
                <Text className="mt-4 text-base text-gray-500">No members found</Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </ScreenWrapper>
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
  recipientAccessGroupPublicKeyBase58Check?: string;
  replyToMessage?: DecryptedMessageEntryResponse | null;
  onCancelReply?: () => void;
  profiles?: PublicKeyToProfileEntryResponseMap;
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
  recipientAccessGroupPublicKeyBase58Check,
  replyToMessage,
  onCancelReply,
  profiles = {},
}: ComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [inputHeight, setInputHeight] = useState(32);
  const textInputRef = useRef<TextInput>(null);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSending(true);
      onSendingChange?.(true);

      const extraData: { [k: string]: string } = {};
      if (replyToMessage && replyToMessage.MessageInfo?.TimestampNanosString) {
        extraData.RepliedToMessageId = replyToMessage.MessageInfo.TimestampNanosString;
        if (replyToMessage.MessageInfo.EncryptedText) {
          extraData.RepliedToMessageEncryptedText = replyToMessage.MessageInfo.EncryptedText;
        }
      }

      await encryptAndSendNewMessage(
        textToSend,
        userPublicKey,
        counterPartyPublicKey,
        threadAccessGroupKeyName,
        userAccessGroupKeyName,
        recipientAccessGroupPublicKeyBase58Check,
        extraData
      );

      const timestampNanos = Math.round(Date.now() * 1e6);
      onMessageSent?.(textToSend);
      if (onCancelReply) onCancelReply();
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

  const sendDisabled = sending || !text.trim();
  const hasText = text.trim().length > 0;

  const containerPaddingBottom = bottomInset;

  const replyPreview = useMemo(() => {
    if (!replyToMessage) return null;
    const senderPk = replyToMessage.SenderInfo?.OwnerPublicKeyBase58Check;
    const senderProfile = senderPk ? profiles[senderPk] : null;
    const displayName = senderPk ? getProfileDisplayName(senderProfile, senderPk) : "Unknown";
    const messageText = replyToMessage.DecryptedMessage || "Message not loaded";

    return (
      <View
        className={`flex-row items-center py-2 px-3 border-t ${isDark
          ? "bg-[#1e293b] border-[#334155]"
          : "bg-[#f1f5f9] border-[#e2e8f0]"
          }`}
      >
        <View className="flex-1">
          <Text className="text-xs font-semibold text-[#3b82f6] mb-0.5">
            Replying to {displayName}
          </Text>
          <Text className={`text-xs ${isDark ? "text-[#cbd5e1]" : "text-[#64748b]"}`} numberOfLines={1}>
            {messageText}
          </Text>
        </View>
        <TouchableOpacity onPress={onCancelReply} className="p-1">
          <Feather name="x" size={20} color={isDark ? "#94a3b8" : "#64748b"} />
        </TouchableOpacity>
      </View>
    );
  }, [replyToMessage, onCancelReply, isDark, profiles]);

  return (
    <View
      className={`border-t border-slate-200 dark:border-slate-800 ${isDark ? "bg-[#000]" : "bg-[#fff]"
        }`}
      style={{
        paddingBottom: containerPaddingBottom,
      }}
    >
      {replyPreview}
      <View className="flex-row items-end mx-3 mt-3 justify-between">
        <View className={`flex-1 rounded-3xl flex-row items-center pl-4 pr-1.5 py-1.5 ${isDark ? "bg-[#1e293b]" : "bg-[#f1f5f9]"
          }`}>
          <TextInput
            ref={textInputRef}
            placeholder={isGroupChat ? "Message the group…" : "Write a message"}
            placeholderTextColor={isDark ? "#94a3b8" : "#64748b"}
            value={text}
            onChangeText={setText}
            multiline
            keyboardAppearance={isDark ? "dark" : "light"}
            autoCorrect
            autoCapitalize="sentences"
            textAlignVertical="center"
            returnKeyType="default"
            blurOnSubmit={false}
            onContentSizeChange={handleContentSizeChange}
            className={`flex-1 text-base leading-5 p-0 ml-0 ${isDark ? "text-[#f8fafc]" : "text-[#1e293b]"
              }`}
            style={{
              minHeight: 24,
              maxHeight: 80,
              paddingVertical: 4,
            }}
          />
          <TouchableOpacity
            onPress={() => onSend()}
            disabled={sendDisabled}
            activeOpacity={0.85}
            className="ml-2"
          >
            <View className={`h-8 w-8 rounded-full items-center justify-center ${!hasText ? (isDark ? "bg-[#334155]" : "bg-[#e2e8f0]") : "bg-[#0085ff]"
              }`}>
              {sending ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Ionicons
                  name="arrow-up"
                  size={20}
                  color={!hasText ? (isDark ? "#94a3b8" : "#64748b") : "#ffffff"}
                />
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
