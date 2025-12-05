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
  Keyboard,
  ListRenderItem,
  Modal,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInputContentSizeChangeEventData,
  View,
  Image,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  DeviceEventEmitter,
  Animated,
  Dimensions,
} from "react-native";
import Reanimated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring, 
  interpolate, 
  runOnJS,
  Extrapolation,
  FadeInDown,
  FadeOutUp,
  LinearTransition,
} from "react-native-reanimated";
import { Easing } from "react-native";
import { BlurView } from "expo-blur";
import * as Clipboard from "expo-clipboard";
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AccessGroupEntryResponse,
  ChatType,
  DecryptedMessageEntryResponse,
  PublicKeyToProfileEntryResponseMap,
  ProfileEntryResponse,
} from "deso-protocol";
import { DEFAULT_KEY_MESSAGING_GROUP_NAME } from "../constants/messaging";
import {
  encryptAndSendNewMessage,
  fetchPaginatedDmThreadMessages,
  fetchPaginatedGroupThreadMessages,
} from "../services/conversations";
import {
  FALLBACK_PROFILE_IMAGE,
  getProfileDisplayName,
  getProfileImageUrl,
} from "../../../utils/deso";
import { fetchAccessGroupMembers, GroupMember } from "../services/desoGraphql";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../navigation/types";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";

import { OUTGOING_MESSAGE_EVENT } from "../constants/events";
import { useColorScheme } from "nativewind";
import { useKeyboardHandler, useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";

import ScreenWrapper from "../../../components/ScreenWrapper";
import {
  AUTO_LOAD_DELAY_MS,
  MESSAGE_GROUPING_WINDOW_NS,
  MESSAGE_PAGE_SIZE,
  SCROLL_PAGINATION_TRIGGER,
  SCROLL_TO_BOTTOM_THRESHOLD,
} from "../constants/messaging";

type Props = NativeStackScreenProps<RootStackParamList, "Conversation">;

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
  const scrollToBottomAnim = useRef(new Animated.Value(1)).current;
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
  const [selectedMessage, setSelectedMessage] = useState<DecryptedMessageEntryResponse | null>(null);
  const [editingMessage, setEditingMessage] = useState<DecryptedMessageEntryResponse | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const actionSheetAnim = useRef(new Animated.Value(0)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const [selectedBubbleLayout, setSelectedBubbleLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const bubbleLayoutsRef = useRef<Map<string, { x: number; y: number; width: number; height: number }>>(new Map());
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

      return normalizeAndSortMessages(Array.from(map.values()));
    },
    []
  );

  const loadMessages = useCallback(
    async (initial = false, isPullToRefresh = false) => {
      if (__DEV__) {
        console.log("[ConversationScreen] loadMessages called", {
          initial,
          isPullToRefresh,
          hasMore: hasMoreRef.current,
          isLoading: isLoadingRef.current,
          cursor: paginationCursorRef.current,
        });
      }

      if (isLoadingRef.current || (!initial && !hasMoreRef.current)) {
        if (__DEV__) {
          console.log("[ConversationScreen] loadMessages SKIPPED", {
            isLoading: isLoadingRef.current,
            hasMore: hasMoreRef.current,
          });
        }
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
            MaxMessagesToFetch: MESSAGE_PAGE_SIZE,
            StartTimeStamp: groupChatTimestamp,
            StartTimeStampString: String(groupChatTimestamp),
          } as const;

          if (__DEV__) {
            console.log("[ConversationScreen] Fetching group messages", {
              chatType,
              payload,
              afterCursor: paginationCursorRef.current,
            });
          }

          const groupResult = await fetchPaginatedGroupThreadMessages(
            payload,
            accessGroupsRef.current,
            userPublicKey,
            {
              afterCursor: initial ? null : paginationCursorRef.current,
              limit: MESSAGE_PAGE_SIZE,
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
            MaxMessagesToFetch: MESSAGE_PAGE_SIZE,
            StartTimeStamp: dmTimestamp,
            StartTimeStampString: String(dmTimestamp),
          } as const;

          if (__DEV__) {
            console.log("[ConversationScreen] Fetching DM messages", {
              chatType,
              payload,
            });
          }

          const dmResult = await fetchPaginatedDmThreadMessages(
            payload,
            accessGroupsRef.current,
            {
              afterCursor: initial ? null : paginationCursorRef.current,
              limit: MESSAGE_PAGE_SIZE,
              fallbackBeforeTimestampNanos: fallbackBeforeTimestamp,
            }
          );
          result = dmResult;
          pageInfo = dmResult.pageInfo;
        }

        const decryptedMessages = result.decrypted.filter(
          (msg): msg is DecryptedMessageEntryResponse => Boolean(msg)
        );

        if (__DEV__) {
          console.log(
            "[ConversationScreen] Decrypted messages:",
            decryptedMessages.map((m) => ({
              hasDecryptedMessage: !!m.DecryptedMessage,
              decryptedMessage: m.DecryptedMessage?.substring(0, 50),
              error: (m as any).error,
              chatType: m.ChatType,
            }))
          );
        }

        setMessages((prev) => {
          const nextMessages = initial
            ? normalizeAndSortMessages([...decryptedMessages])
            : mergeMessages(prev, decryptedMessages);

          const oldest =
            nextMessages[nextMessages.length - 1]?.MessageInfo
              ?.TimestampNanos ?? null;
          oldestTimestampRef.current = oldest;

          return nextMessages;
        });

        // Auto-load more if content doesn't fill screen
        if (initial && decryptedMessages.length === MESSAGE_PAGE_SIZE && hasMoreRef.current) {
          setTimeout(() => {
            if (!isLoadingRef.current && hasMoreRef.current) {
              if (__DEV__) {
                console.log("[ConversationScreen] Auto-loading more messages (content too short)");
              }
              loadMessages(false);
            }
          }, AUTO_LOAD_DELAY_MS);
        }

        accessGroupsRef.current = result.updatedAllAccessGroups;

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

          if (!nextHasMore && decryptedMessages.length === MESSAGE_PAGE_SIZE) {
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

          if (!nextHasMore && decryptedMessages.length === MESSAGE_PAGE_SIZE) {
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
    const messageText = getDisplayedMessageText(latest)?.trim();
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

  const animateOpenActions = useCallback(() => {
    actionSheetAnim.stopAnimation();
    backdropAnim.stopAnimation();
    actionSheetAnim.setValue(0);
    backdropAnim.setValue(0);
    Animated.parallel([
      Animated.timing(backdropAnim, {
        toValue: 1,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(actionSheetAnim, {
        toValue: 1,
        duration: 80,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [actionSheetAnim, backdropAnim]);

  const animateCloseActions = useCallback(
    (onFinished?: () => void) => {
      actionSheetAnim.stopAnimation();
      backdropAnim.stopAnimation();
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(actionSheetAnim, {
          toValue: 0,
          duration: 80,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          onFinished?.();
        }
      });
    },
    [actionSheetAnim, backdropAnim]
  );

  const handleMessageLongPress = useCallback(
    (
      message: DecryptedMessageEntryResponse,
      layout?: { x: number; y: number; width: number; height: number }
    ) => {
      // Trigger haptic immediately for responsive feel
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);

      // Get layout immediately to avoid delays
      const messageId = getMessageId(message);
      let bubbleLayout = layout;

      if (!bubbleLayout && messageId) {
        bubbleLayout = bubbleLayoutsRef.current.get(messageId) || undefined;
      }

      const finalLayout = bubbleLayout || getFallbackBubbleLayout();

      // Batch all state updates together for better performance
      // This prevents multiple re-renders
      setSelectedMessage(message);
      setSelectedBubbleLayout(finalLayout);

      // Start animation immediately after state is set
      requestAnimationFrame(() => {
        animateOpenActions();
      });
    },
    [animateOpenActions]
  );

  const handleCloseMessageActions = useCallback(() => {
    // Light haptic on dismiss
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateCloseActions(() => {
      setSelectedMessage(null);
      setSelectedBubbleLayout(null);
    });
  }, [animateCloseActions]);

  const handleActionReply = useCallback(() => {
    if (!selectedMessage) return;
    handleReply(selectedMessage);
    handleCloseMessageActions();
  }, [selectedMessage, handleReply, handleCloseMessageActions]);

  const handleActionCopy = useCallback(async () => {
    if (!selectedMessage) return;
    const text = getDisplayedMessageText(selectedMessage) || "";
    if (!text.trim()) return;
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    handleCloseMessageActions();
  }, [selectedMessage, handleCloseMessageActions]);

  const startEditingMessage = useCallback(
    (message?: DecryptedMessageEntryResponse | null) => {
      const target = message ?? selectedMessage;
      if (!target || !target.IsSender) return;
      if (!getMessageId(target)) return;
      const draft =
        getDisplayedMessageText(target) ||
        target.DecryptedMessage ||
        "";
      setEditDraft(draft);
      setEditingMessage(target);
      handleCloseMessageActions();
    },
    [selectedMessage, handleCloseMessageActions]
  );

  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null);
    setEditDraft("");
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingMessage) return;

    const trimmed = editDraft.trim();
    const messageId = getMessageId(editingMessage);
    if (!trimmed || !messageId) {
      return;
    }

    const currentText = getDisplayedMessageText(editingMessage)?.trim() || "";
    if (trimmed === currentText) {
      handleCancelEdit();
      return;
    }

    try {
      setIsSavingEdit(true);
      const extraData = {
        edited: "true",
        editedMessage: trimmed,
        editedMessageId: messageId,
      };

      await encryptAndSendNewMessage(
        trimmed,
        userPublicKey,
        counterPartyPublicKey,
        threadAccessGroupKeyName,
        userAccessGroupKeyName,
        recipientInfo?.AccessGroupPublicKeyBase58Check,
        extraData
      );

      setMessages((prev) =>
        normalizeAndSortMessages(
          prev.map((msg) => {
            const id = getMessageId(msg);
            if (id !== messageId) return msg;

            const nextExtraData = {
              ...(msg.MessageInfo?.ExtraData || {}),
              ...extraData,
            };

            return {
              ...msg,
              MessageInfo: {
                ...(msg.MessageInfo || {}),
                ExtraData: nextExtraData,
              },
            };
          })
        )
      );
      handleCancelEdit();
    } catch (error) {
      console.error("[ConversationScreen] Failed to edit message", error);
    } finally {
      setIsSavingEdit(false);
    }
  }, [
    counterPartyPublicKey,
    editDraft,
    editingMessage,
    handleCancelEdit,
    threadAccessGroupKeyName,
    userAccessGroupKeyName,
    userPublicKey,
    recipientInfo?.AccessGroupPublicKeyBase58Check,
  ]);

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

  const renderItem: ListRenderItem<DecryptedMessageEntryResponse> = useCallback(
    ({ item, index }) => {
      const previousMessage = messages[index + 1];
      const nextMessage = messages[index - 1];
      const previousTimestamp = previousMessage?.MessageInfo?.TimestampNanos;

      return (
        <MemoizedMessageBubble
          item={item}
          previousMessage={previousMessage}
          nextMessage={nextMessage}
          previousTimestamp={previousTimestamp}
          profiles={profiles}
          isGroupChat={isGroupChat}
          onReply={handleReply}
          onLongPress={handleMessageLongPress}
          onBubbleMeasure={(id, layout) => {
            bubbleLayoutsRef.current.set(id, layout);
          }}
          messageIdMap={messageIdMap}
          isDark={isDark}
        />
      );
    },
    [handleMessageLongPress, handleReply, isDark, isGroupChat, messageIdMap, messages, profiles]
  );

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

  const sendQuickHello = useCallback(async () => {
    const messageText = "Hi 👋";
    const timestampNanos = Math.round(Date.now() * 1e6);
    
    // Create optimistic message
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

    try {
      // Actually send the message via DeSo API
      await encryptAndSendNewMessage(
        messageText,
        userPublicKey,
        counterPartyPublicKey,
        threadAccessGroupKeyName,
        userAccessGroupKeyName,
        recipientInfo?.AccessGroupPublicKeyBase58Check
      );

      // Emit event for any listeners
      DeviceEventEmitter.emit(OUTGOING_MESSAGE_EVENT, {
        conversationId,
        messageText,
        timestampNanos,
        chatType,
        threadPublicKey: counterPartyPublicKey,
        threadAccessGroupKeyName,
        userAccessGroupKeyName,
      });
    } catch (error) {
      console.error("[sendQuickHello] Failed to send message:", error);
    }
  }, [chatType, conversationId, counterPartyPublicKey, mergeMessages, recipientInfo?.AccessGroupPublicKeyBase58Check, threadAccessGroupKeyName, userAccessGroupKeyName, userPublicKey]);

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
      <Pressable 
        style={{ flex: 1 }} 
        onPress={() => Keyboard.dismiss()}
      >
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
            // Performance optimizations
            removeClippedSubviews={true}
            windowSize={5}
            maxToRenderPerBatch={5}
            updateCellsBatchingPeriod={100}
            initialNumToRender={10}
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
              if (distanceFromTop > SCROLL_TO_BOTTOM_THRESHOLD) {
                if (!showScrollToBottom) {
                  scrollToBottomAnim.setValue(1); // Reset opacity when showing
                  setShowScrollToBottom(true);
                }
              } else {
                if (showScrollToBottom) setShowScrollToBottom(false);
              }
              if (distanceFromTop > SCROLL_PAGINATION_TRIGGER && !isLoadingRef.current && hasMoreRef.current) {
                loadMessages(false);
              }
            }}
            scrollEventThrottle={100}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="on-drag"
            onScrollBeginDrag={() => Keyboard.dismiss()}
            refreshControl={
              <RefreshControl
                tintColor="#3b82f6"
                colors={["#3b82f6"]}
                refreshing={isRefreshing}
                onRefresh={() => loadMessages(true, true)}
              />
            }
            ListEmptyComponent={() => (
              <View className="items-center justify-center px-6 py-10" style={{ transform: [{ scaleY: -1 }] }}>
                {isLoading ? (
                  <View className="items-center">
                    <ActivityIndicator size="large" color="#3b82f6" />
                    <Text className="mt-4 text-sm font-medium text-gray-500">
                      Loading messages...
                    </Text>
                  </View>
                ) : (
                  <View className="items-center rounded-3xl border border-gray-200 bg-white px-10 py-12 dark:border-slate-800 dark:bg-slate-900">
                    <Text className="text-6xl mb-4">👋</Text>
                    <Text className="text-xl font-semibold text-gray-900 dark:text-slate-200">
                      Say hello!
                    </Text>
                    <Text className="mt-2 text-center text-sm text-gray-500 dark:text-slate-400 px-2">
                      You haven't started a conversation with{"\n"}
                      <Text className="font-semibold text-gray-700 dark:text-slate-300">{headerDisplayName}</Text> yet
                    </Text>
                    <View className="mt-5">
                      <TouchableOpacity 
                        onPress={sendQuickHello}
                        activeOpacity={0.7}
                        className="px-5 py-2.5 bg-blue-100 dark:bg-blue-900/40 rounded-full"
                      >
                        <Text className="text-base font-medium text-blue-600 dark:text-blue-400">Hi 👋</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}
          />
        )}
        {showScrollToBottom && (
          <Animated.View
            style={{
              position: 'absolute',
              bottom: 16,
              right: 16,
              zIndex: 10,
              opacity: scrollToBottomAnim,
            }}
          >
            <TouchableOpacity
              onPress={() => {
                // Fade out animation
                Animated.timing(scrollToBottomAnim, {
                  toValue: 0,
                  duration: 200,
                  useNativeDriver: true,
                }).start(() => {
                  // Hide button after animation
                  setShowScrollToBottom(false);
                });
                // Scroll to bottom
                flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
              }}
              className="h-10 w-10 bg-white dark:bg-slate-700 rounded-full items-center justify-center shadow-md border border-gray-200 dark:border-slate-600"
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
          </Animated.View>
        )}
      </Pressable>

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
        editingMessage={editingMessage}
        editDraft={editDraft}
        onEditDraftChange={setEditDraft}
        onCancelEdit={handleCancelEdit}
        onSaveEdit={handleSaveEdit}
        isSavingEdit={isSavingEdit}
      />

      <Modal
        visible={Boolean(selectedMessage)}
        transparent
        animationType="none"
        onRequestClose={handleCloseMessageActions}
      >
        <View style={{ flex: 1 }}>
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              { opacity: backdropAnim },
            ]}
          >
            {Platform.OS === "ios" || Platform.OS === "android" ? (
              <BlurView
                intensity={50}
                tint={isDark ? "dark" : "light"}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <View
                style={[
                  StyleSheet.absoluteFillObject,
                  { backgroundColor: isDark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.35)" },
                ]}
              />
            )}
          </Animated.View>

          <TouchableOpacity
            activeOpacity={1}
            style={StyleSheet.absoluteFill}
            onPress={handleCloseMessageActions}
          />

          {selectedMessage && selectedBubbleLayout ? (() => {
            const positions = computeModalPositions(
              selectedBubbleLayout,
              composerBottomInset,
              Boolean(selectedMessage?.IsSender)
            );
            return (
              <>
                {/* Bubble Preview */}
                <Animated.View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    top: positions.bubbleTop,
                    left: selectedBubbleLayout.x,
                    width: selectedBubbleLayout.width,
                    opacity: actionSheetAnim,
                    transform: [
                      {
                        translateY: actionSheetAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [10, 0],
                        }),
                      },
                      {
                        scale: actionSheetAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.97, 1],
                        }),
                      },
                    ],
                  }}
                >
                  <SelectedBubblePreview
                    message={selectedMessage}
                    profiles={profiles}
                    isDark={isDark}
                  />
                </Animated.View>

                {/* Action Sheet */}
                <Animated.View
                  style={{
                    position: "absolute",
                    top: positions.actionTop,
                    left: positions.actionLeft,
                    opacity: actionSheetAnim,
                    transform: [
                      {
                        translateY: actionSheetAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [20, 0],
                        }),
                      },
                      {
                        scale: actionSheetAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.96, 1],
                        }),
                      },
                    ],
                  }}
                >
                  <ActionSheetCard
                    isDark={isDark}
                    onReply={handleActionReply}
                    onEdit={
                      selectedMessage?.IsSender
                        ? () => startEditingMessage(selectedMessage)
                        : undefined
                    }
                    onCopy={handleActionCopy}
                  />
                </Animated.View>
              </>
            );
          })() : null}
        </View>
      </Modal>

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

type MessageBubbleProps = {
  item: DecryptedMessageEntryResponse;
  previousMessage?: DecryptedMessageEntryResponse;
  nextMessage?: DecryptedMessageEntryResponse;
  previousTimestamp?: number;
  profiles: PublicKeyToProfileEntryResponseMap;
  isGroupChat: boolean;
  onReply: (message: DecryptedMessageEntryResponse) => void;
  onLongPress: (
    message: DecryptedMessageEntryResponse,
    layout?: { x: number; y: number; width: number; height: number }
  ) => void;
  onBubbleMeasure?: (
    id: string,
    layout: { x: number; y: number; width: number; height: number }
  ) => void;
  messageIdMap: Map<string, DecryptedMessageEntryResponse>;
  isDark: boolean;
};

const MemoizedMessageBubble = React.memo(MessageBubble);

function MessageBubble({
  item,
  previousMessage,
  nextMessage,
  previousTimestamp,
  profiles,
  isGroupChat,
  onReply,
  onLongPress,
  onBubbleMeasure,
  messageIdMap,
  isDark,
}: MessageBubbleProps) {
  // Removed swipeableRef - now using Reanimated gesture handler
  const bubbleContainerRef = useRef<View>(null);
  const extraData = item.MessageInfo?.ExtraData || {};
  const senderPk = item.SenderInfo?.OwnerPublicKeyBase58Check ?? "";
  const isMine = Boolean(item.IsSender);
  const hasError = (item as any).error;
  const messageId = getMessageId(item);
  const editedMessageText =
    typeof (extraData as any).editedMessage === "string"
      ? (extraData as any).editedMessage
      : undefined;
  const isEditedMessage =
    isEditedValue(extraData?.edited) || Boolean(editedMessageText);
  const baseMessageText =
    item.DecryptedMessage ||
    (hasError ? "Unable to decrypt this message." : "Decrypting…");
  const messageText =
    (isEditedMessage && editedMessageText ? editedMessageText : baseMessageText) ||
    baseMessageText;
  const rawMessageText = messageText?.trim();
  const timestamp = item.MessageInfo?.TimestampNanos;

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
    const replyText = getDisplayedMessageText(repliedToMessage) || fallbackText || "Message not loaded";

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

  // === SWIPE-TO-REPLY WITH SPRING PHYSICS ===
  const SWIPE_THRESHOLD = 50; // px threshold to trigger reply
  const MAX_SWIPE = 80; // max translation
  const translateX = useSharedValue(0);
  const hasTriggeredHaptic = useSharedValue(false);

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const triggerReply = () => {
    onReply(item);
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX(isMine ? -15 : 15) // Start gesture after 15px to avoid conflict with scroll
    .onUpdate((event) => {
      // For sent messages (isMine), swipe left (negative); for received, swipe right (positive)
      const clampedValue = isMine
        ? Math.max(-MAX_SWIPE, Math.min(0, event.translationX))
        : Math.min(MAX_SWIPE, Math.max(0, event.translationX));
      
      translateX.value = clampedValue;

      // Trigger haptic when crossing threshold
      const absValue = Math.abs(clampedValue);
      if (absValue >= SWIPE_THRESHOLD && !hasTriggeredHaptic.value) {
        hasTriggeredHaptic.value = true;
        runOnJS(triggerHaptic)();
      } else if (absValue < SWIPE_THRESHOLD && hasTriggeredHaptic.value) {
        hasTriggeredHaptic.value = false;
      }
    })
    .onEnd(() => {
      const absValue = Math.abs(translateX.value);
      if (absValue >= SWIPE_THRESHOLD) {
        runOnJS(triggerReply)();
      }
      // Spring back with bounce effect
      translateX.value = withSpring(0, {
        damping: 15,
        stiffness: 400,
        mass: 0.5,
        overshootClamping: false,
      });
      hasTriggeredHaptic.value = false;
    });

  const animatedRowStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  const animatedIconStyle = useAnimatedStyle(() => {
    const absValue = Math.abs(translateX.value);
    const scale = interpolate(
      absValue,
      [0, SWIPE_THRESHOLD / 2, SWIPE_THRESHOLD],
      [0.3, 0.8, 1],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      absValue,
      [0, 20, SWIPE_THRESHOLD],
      [0, 0.5, 1],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ scale }],
      opacity,
    };
  });

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
    ? Math.abs(timestamp - nextMessage.MessageInfo.TimestampNanos) < MESSAGE_GROUPING_WINDOW_NS
    : false;
  const isPreviousMessageClose = previousMessage && timestamp && previousMessage.MessageInfo?.TimestampNanos
    ? Math.abs(timestamp - previousMessage.MessageInfo.TimestampNanos) < MESSAGE_GROUPING_WINDOW_NS
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
    <View
      style={{ marginBottom }}
      ref={bubbleContainerRef}
      onLayout={() => {
        if (!messageId) return;
        bubbleContainerRef.current?.measureInWindow((x, y, width, height) => {
          if (width > 0 && height > 0) {
            onBubbleMeasure?.(messageId, { x, y, width, height });
          }
        });
      }}
    >
      {showDayDivider ? (
        <View className="items-center py-1">
          <View className="rounded-full bg-gray-200 px-3 py-1 dark:bg-slate-800">
            <Text className="text-[10px] font-semibold uppercase tracking-wide text-gray-600 dark:text-slate-400">
              {formatDayLabel(timestamp)}
            </Text>
          </View>
        </View>
      ) : null}
      
      {/* Reply Icon - positioned behind the bubble */}
      <Reanimated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
            width: 50,
          },
          isMine ? { right: -50 } : { left: -50 },
          animatedIconStyle,
        ]}
        pointerEvents="none"
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: isDark ? '#334155' : '#e2e8f0',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Feather name="corner-up-left" size={18} color={isDark ? '#cbd5e1' : '#64748b'} />
        </View>
      </Reanimated.View>

      {/* Swipeable message row */}
      <GestureDetector gesture={panGesture}>
        <Reanimated.View style={animatedRowStyle}>
          <TouchableWithoutFeedback
            onPress={() => Keyboard.dismiss()}
            onLongPress={() => onLongPress(item)}
            delayLongPress={200}
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
                className={`max-w-[80%] px-3.5 py-2.5 ${isMine ? "bg-[#0085ff]" : "bg-[#f1f3f5] dark:bg-[#161e27]"
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
                  className={`text-[15px] leading-[21px] ${isMine ? "text-white" : "text-[#0f172a] dark:text-white"
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
                        {isEditedMessage ? (
                          <Text
                            className={`mr-2 text-[11px] font-semibold ${isMine ? "text-blue-100" : "text-slate-500 dark:text-slate-400"
                              }`}
                          >
                            Edited
                          </Text>
                        ) : null}
                        {timestamp ? (
                          <Text
                            className={`text-[10px] opacity-70 ${isMine ? "text-white/70" : "text-slate-500 dark:text-slate-400"
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
          </TouchableWithoutFeedback>
        </Reanimated.View>
      </GestureDetector>
    </View>
  );
}

function getMessageId(message?: DecryptedMessageEntryResponse | null): string {
  if (!message?.MessageInfo) return "";
  return (
    message.MessageInfo.TimestampNanosString ??
    (message.MessageInfo.TimestampNanos != null
      ? String(message.MessageInfo.TimestampNanos)
      : "")
  );
}

function isEditedValue(value: any): boolean {
  return value === true || value === "true" || value === "1";
}

function normalizeEditedMessages(
  messages: DecryptedMessageEntryResponse[]
): DecryptedMessageEntryResponse[] {
  const messageIds = new Set<string>();
  const edits: Record<
    string,
    {
      editedMessage?: string;
      isEdited: boolean;
      timestamp?: number;
    }
  > = {};

  messages.forEach((msg) => {
    const id = getMessageId(msg);
    if (id) {
      messageIds.add(id);
    }

    const extra = msg.MessageInfo?.ExtraData as Record<string, any> | undefined;
    const targetId =
      typeof extra?.editedMessageId === "string"
        ? extra.editedMessageId
        : extra?.editedMessageId != null
          ? String(extra.editedMessageId)
          : undefined;

    if (
      targetId &&
      targetId !== id &&
      typeof extra?.editedMessage === "string"
    ) {
      const ts = msg.MessageInfo?.TimestampNanos ?? 0;
      const existing = edits[targetId];
      const editedFlag =
        isEditedValue(extra?.edited) || Boolean(extra?.editedMessage);

      if (!existing || (existing.timestamp ?? 0) < ts) {
        edits[targetId] = {
          editedMessage: extra.editedMessage,
          isEdited: editedFlag,
          timestamp: ts,
        };
      }
    }
  });

  const updatedMessages = messages.map((msg) => {
    const id = getMessageId(msg);
    const edit = id ? edits[id] : undefined;
    if (!edit) return msg;

    const nextExtra = { ...(msg.MessageInfo?.ExtraData || {}) };
    if (edit.isEdited) {
      nextExtra.edited = "true";
    }
    if (edit.editedMessage) {
      nextExtra.editedMessage = edit.editedMessage;
    }

    return {
      ...msg,
      MessageInfo: {
        ...(msg.MessageInfo || {}),
        ExtraData: nextExtra,
      },
    };
  });

  const filteredMessages = updatedMessages.filter((msg) => {
    const extra = msg.MessageInfo?.ExtraData as Record<string, any> | undefined;
    const id = getMessageId(msg);
    const targetId =
      typeof extra?.editedMessageId === "string"
        ? extra.editedMessageId
        : extra?.editedMessageId != null
          ? String(extra.editedMessageId)
          : undefined;

    if (targetId && targetId !== id && messageIds.has(targetId)) {
      return false;
    }

    return true;
  });

  return filteredMessages;
}

function sortMessagesDescending(
  messages: DecryptedMessageEntryResponse[]
): DecryptedMessageEntryResponse[] {
  return [...messages].sort(
    (a, b) =>
      (b.MessageInfo?.TimestampNanos ?? 0) -
      (a.MessageInfo?.TimestampNanos ?? 0)
  );
}

function normalizeAndSortMessages(
  messages: DecryptedMessageEntryResponse[]
): DecryptedMessageEntryResponse[] {
  return sortMessagesDescending(normalizeEditedMessages(messages));
}

function getDisplayedMessageText(
  message?: DecryptedMessageEntryResponse | null
): string | undefined {
  if (!message) return undefined;

  const extraData = message.MessageInfo?.ExtraData as Record<string, any> | undefined;
  const editedText =
    typeof extraData?.editedMessage === "string" ? extraData.editedMessage : undefined;

  const isEdited = isEditedValue(extraData?.edited) || Boolean(editedText);

  if (isEdited && editedText) {
    return editedText;
  }

  return message.DecryptedMessage || undefined;
}

function SelectedBubblePreview({
  message,
  profiles,
  isDark,
}: {
  message: DecryptedMessageEntryResponse;
  profiles: PublicKeyToProfileEntryResponseMap;
  isDark: boolean;
}) {
  const isMine = Boolean(message.IsSender);
  const senderPk = message.SenderInfo?.OwnerPublicKeyBase58Check || "";
  const senderProfile = profiles[senderPk];
  const displayName = getProfileDisplayName(senderProfile, senderPk);
  const text = getDisplayedMessageText(message) || "Message";
  const extra = message.MessageInfo?.ExtraData as Record<string, any> | undefined;
  const isEdited = isEditedValue(extra?.edited) || Boolean(extra?.editedMessage);
  const timestamp = message.MessageInfo?.TimestampNanos;

  // Get profile image URL for non-sender messages
  const avatarUri = senderPk
    ? getProfileImageUrl(senderPk) || FALLBACK_PROFILE_IMAGE
    : FALLBACK_PROFILE_IMAGE;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: isMine ? 'flex-end' : 'flex-start',
      }}
    >
      {/* Profile image for non-sender messages */}
      {!isMine && (
        <Image
          source={{ uri: avatarUri }}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            marginRight: 8,
            backgroundColor: isDark ? '#334155' : '#e5e7eb',
          }}
        />
      )}
      <View
        className={`max-w-[80%] px-4 py-3 ${isMine ? "bg-[#0085ff]" : "bg-[#f1f3f5] dark:bg-[#161e27]"}`}
        style={{
          borderRadius: 20,
          shadowColor: "#000",
          shadowOpacity: 0.35,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 12 },
          elevation: 14,
        }}
      >
        {!isMine && (
          <Text
            className="mb-1 text-[11px] font-bold text-slate-500 dark:text-slate-400"
            numberOfLines={1}
          >
            {displayName}
          </Text>
        )}
        <Text
          className={`text-[16px] leading-[22px] ${isMine ? "text-white" : "text-[#0f172a] dark:text-white"
            }`}
        >
          {text}
        </Text>
        <View
          className={`mt-1.5 flex-row items-center ${isMine ? "justify-end" : "justify-start"
            }`}
        >
          {isEdited ? (
            <Text
              className={`mr-2 text-[11px] font-semibold ${isMine ? "text-blue-100" : "text-slate-500 dark:text-slate-400"
                }`}
            >
              Edited
            </Text>
          ) : null}
          {timestamp ? (
            <Text
              className={`text-[11px] ${isMine ? "text-blue-100" : "text-slate-400 dark:text-slate-500"
                }`}
            >
              {formatTimestamp(timestamp)}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function ActionSheetCard({
  isDark,
  onReply,
  onEdit,
  onCopy,
}: {
  isDark: boolean;
  onReply: () => void;
  onEdit?: () => void;
  onCopy: () => void;
}) {
  return (
    <View
      className={`${isDark ? "bg-[#0f172a]" : "bg-white"} rounded-2xl shadow-lg border ${isDark ? "border-slate-800" : "border-slate-200"
        }`}
      style={{
        width: ACTION_SHEET_WIDTH,
        overflow: "hidden",
      }}
    >
      <TouchableOpacity
        onPress={onReply}
        className="flex-row items-center px-4 py-3 active:opacity-70"
      >
        <Feather
          name="corner-up-left"
          size={18}
          color={isDark ? "#e2e8f0" : "#0f172a"}
        />
        <Text className={`ml-3 text-base ${isDark ? "text-slate-100" : "text-slate-900"}`}>
          Reply
        </Text>
      </TouchableOpacity>
      {onEdit ? (
        <TouchableOpacity
          onPress={onEdit}
          className="flex-row items-center px-4 py-3 active:opacity-70 border-t border-slate-200 dark:border-slate-800"
        >
          <Feather
            name="edit-2"
            size={18}
            color={isDark ? "#e2e8f0" : "#0f172a"}
          />
          <Text className={`ml-3 text-base ${isDark ? "text-slate-100" : "text-slate-900"}`}>
            Edit message
          </Text>
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity
        onPress={onCopy}
        className="flex-row items-center px-4 py-3 active:opacity-70 border-t border-slate-200 dark:border-slate-800"
      >
        <Feather
          name="copy"
          size={18}
          color={isDark ? "#e2e8f0" : "#0f172a"}
        />
        <Text className={`ml-3 text-base ${isDark ? "text-slate-100" : "text-slate-900"}`}>
          Copy
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const ACTION_SHEET_WIDTH = 240;
const ESTIMATED_ACTION_HEIGHT = 100; // Height of Reply + Copy buttons
const ESTIMATED_BUBBLE_HEIGHT = 80; // Approximate bubble height
const MIN_GAP_BETWEEN_BUBBLE_AND_SHEET = 12; // Minimum gap to prevent overlap
const PROFILE_IMAGE_WIDTH = 40; // 32px image + 8px margin
const WINDOW = Dimensions.get("window");

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Compute positions for both bubble preview and action sheet
 * Returns adjusted positions that ensure:
 * 1. Both bubble and action sheet are visible on screen
 * 2. Action sheet is below the bubble with proper gap
 * 3. When near bottom, bubble moves up to make room
 */
function computeModalPositions(
  layout: { x: number; y: number; width: number; height: number },
  bottomInset: number,
  isSender: boolean
): {
  bubbleTop: number;
  actionTop: number;
  actionLeft: number;
} {
  const headerHeight = 60; // Approximate header height
  const minTop = headerHeight + 8;
  const maxBottom = WINDOW.height - bottomInset - 20;

  // Total space needed: bubble height + gap + action sheet height
  const totalNeededHeight = layout.height + MIN_GAP_BETWEEN_BUBBLE_AND_SHEET + ESTIMATED_ACTION_HEIGHT;

  // Calculate where bubble and action sheet would go if placed at original position
  let bubbleTop = layout.y;
  let actionTop = layout.y + layout.height + MIN_GAP_BETWEEN_BUBBLE_AND_SHEET;

  // Check if action sheet would go below screen bottom
  const actionBottom = actionTop + ESTIMATED_ACTION_HEIGHT;
  if (actionBottom > maxBottom) {
    // Need to move everything up
    // Calculate how much to move up
    const overflow = actionBottom - maxBottom;
    bubbleTop = Math.max(minTop, bubbleTop - overflow);
    actionTop = bubbleTop + layout.height + MIN_GAP_BETWEEN_BUBBLE_AND_SHEET;
  }

  // Ensure bubble doesn't go above header
  if (bubbleTop < minTop) {
    bubbleTop = minTop;
    actionTop = bubbleTop + layout.height + MIN_GAP_BETWEEN_BUBBLE_AND_SHEET;
  }

  // Calculate left position - align with the bubble content (after profile image for received)
  let actionLeft: number;
  if (isSender) {
    // For sent messages: align action sheet's right edge with bubble's right edge
    const desiredLeft = layout.x + layout.width - ACTION_SHEET_WIDTH;
    actionLeft = clamp(desiredLeft, 12, WINDOW.width - ACTION_SHEET_WIDTH - 12);
  } else {
    // For received messages: align with bubble content start (after profile image)
    // The bubble's x position already includes the profile image offset
    const desiredLeft = layout.x;
    actionLeft = clamp(desiredLeft, 12, WINDOW.width - ACTION_SHEET_WIDTH - 12);
  }

  return { bubbleTop, actionTop, actionLeft };
}

function getFallbackBubbleLayout(): { x: number; y: number; width: number; height: number } {
  return {
    x: 16,
    y: WINDOW.height / 2 - 80,
    width: ACTION_SHEET_WIDTH,
    height: 60,
  };
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
  editingMessage?: DecryptedMessageEntryResponse | null;
  editDraft?: string;
  onEditDraftChange?: (text: string) => void;
  onCancelEdit?: () => void;
  onSaveEdit?: () => void;
  isSavingEdit?: boolean;
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
  editingMessage,
  editDraft = "",
  onEditDraftChange,
  onCancelEdit,
  onSaveEdit,
  isSavingEdit = false,
}: ComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [inputHeight, setInputHeight] = useState(32);
  const textInputRef = useRef<TextInput>(null);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  // Use keyboard controller for dynamic keyboard height
  const { height: keyboardHeight } = useReanimatedKeyboardAnimation();
  const animatedComposerStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.max(keyboardHeight.value, bottomInset),
  }));

  const focusInput = useCallback(() => {
    textInputRef.current?.focus();
  }, []);

  // Auto-focus when entering edit mode or reply mode
  useEffect(() => {
    if (editingMessage || replyToMessage) {
      // Use requestAnimationFrame for immediate snappy focus
      requestAnimationFrame(() => {
        focusInput();
      });
    }
  }, [editingMessage, replyToMessage, focusInput]);

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

  // Handle cancel reply with keyboard dismiss and haptic
  const handleCancelReply = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();
    onCancelReply?.();
  }, [onCancelReply]);

  // Reply preview - no animation, just appears
  const replyPreview = useMemo(() => {
    if (!replyToMessage) return null;
    const senderPk = replyToMessage.SenderInfo?.OwnerPublicKeyBase58Check;
    const senderProfile = senderPk ? profiles[senderPk] : null;
    const displayName = senderPk ? getProfileDisplayName(senderProfile, senderPk) : "Unknown";
    const messageText = getDisplayedMessageText(replyToMessage) || "Message not loaded";

    return (
      <View
        className={`flex-row items-center py-3 px-4 ${isDark
          ? "bg-[#0f1419]"
          : "bg-[#f1f5f9]"
          }`}
      >
        {/* Left accent bar */}
        <View 
          style={{
            width: 3,
            height: '100%',
            minHeight: 40,
            backgroundColor: '#1DB7A4',
            borderRadius: 2,
            marginRight: 12,
          }}
        />
        <View className="flex-1">
          <Text 
            className="text-base font-semibold mb-1"
            style={{ color: '#1DB7A4' }}
            numberOfLines={1}
          >
            {displayName}
          </Text>
          <Text 
            className={`text-sm ${isDark ? "text-[#8899a6]" : "text-[#64748b]"}`} 
            numberOfLines={1}
          >
            {messageText}
          </Text>
        </View>
        <TouchableOpacity 
          onPress={handleCancelReply} 
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            borderWidth: 2,
            borderColor: isDark ? '#4a5568' : '#cbd5e1',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 12,
          }}
        >
          <Feather name="x" size={18} color={isDark ? "#9ca3af" : "#6b7280"} />
        </TouchableOpacity>
      </View>
    );
  }, [replyToMessage, handleCancelReply, isDark, profiles]);

  // Handle cancel edit with keyboard dismiss and haptic
  const handleCancelEdit = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();
    onCancelEdit?.();
  }, [onCancelEdit]);

  const editPreview = useMemo(() => {
    if (!editingMessage) return null;
    const messageText = getDisplayedMessageText(editingMessage) || "Message";

    return (
      <Reanimated.View
        entering={FadeInDown.springify().damping(18).stiffness(250)}
        exiting={FadeOutUp.duration(200)}
        layout={LinearTransition.springify().damping(18)}
        className={`flex-row items-center py-3 px-4 ${isDark
          ? "bg-[#1e293b]"
          : "bg-[#f1f5f9]"
          }`}
      >
        {/* Left accent bar - amber for edit mode */}
        <View 
          style={{
            width: 3,
            height: '100%',
            minHeight: 40,
            backgroundColor: '#f59e0b',
            borderRadius: 2,
            marginRight: 12,
          }}
        />
        <View className="flex-1">
          <Text className="text-base font-semibold text-[#f59e0b] mb-1">
            Editing message
          </Text>
          <Text className={`text-sm ${isDark ? "text-[#cbd5e1]" : "text-[#64748b]"}`} numberOfLines={1}>
            {messageText}
          </Text>
        </View>
        <TouchableOpacity 
          onPress={handleCancelEdit}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            borderWidth: 2,
            borderColor: isDark ? '#4a5568' : '#cbd5e1',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 12,
          }}
        >
          <Feather name="x" size={18} color={isDark ? "#9ca3af" : "#6b7280"} />
        </TouchableOpacity>
      </Reanimated.View>
    );
  }, [editingMessage, handleCancelEdit, isDark]);

  const isEditMode = Boolean(editingMessage);
  const currentText = isEditMode ? editDraft : text;
  const currentHasText = currentText.trim().length > 0;

  const handleTextChange = (newText: string) => {
    if (isEditMode) {
      onEditDraftChange?.(newText);
    } else {
      setText(newText);
    }
  };

  const handleSendOrSave = () => {
    if (isEditMode) {
      onSaveEdit?.();
    } else {
      onSend();
    }
  };

  const isDisabled = isEditMode
    ? (!currentText.trim() || isSavingEdit)
    : (sending || !currentText.trim());

  return (
    <Reanimated.View
      className={`border-t border-slate-200 dark:border-slate-800 ${isDark ? "bg-[#000]" : "bg-[#fff]"
        }`}
      style={animatedComposerStyle}
    >
      {editPreview}
      {replyPreview}
      <View className="flex-row items-end mx-3 mt-3 justify-between">
        <View className={`flex-1 rounded-3xl flex-row items-center pl-4 pr-1.5 py-1.5 ${isDark ? "bg-[#1e293b]" : "bg-[#f1f5f9]"
          }`}>
          <TextInput
            ref={textInputRef}
            placeholder={isEditMode ? "Update your message" : (isGroupChat ? "Message the group…" : "Write a message")}
            placeholderTextColor={isDark ? "#94a3b8" : "#64748b"}
            value={currentText}
            onChangeText={handleTextChange}
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
            onPress={handleSendOrSave}
            disabled={isDisabled}
            activeOpacity={0.85}
            className="ml-2"
          >
            <View className={`h-8 w-8 rounded-full items-center justify-center ${!currentHasText ? (isDark ? "bg-[#334155]" : "bg-[#e2e8f0]") : (isEditMode ? "bg-[#f59e0b]" : "bg-[#0085ff]")
              }`}>
              {(sending || isSavingEdit) ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Ionicons
                  name={isEditMode ? "checkmark" : "arrow-up"}
                  size={20}
                  color={!currentHasText ? (isDark ? "#94a3b8" : "#64748b") : "#ffffff"}
                />
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </Reanimated.View>
  );
}
