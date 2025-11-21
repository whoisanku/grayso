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
      headerShadowVisible: true,
      headerStyle: {
        backgroundColor: isDark ? "#000000" : "#ffffff",
      },
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ marginLeft: -8, padding: 4 }}
        >
          <Feather name="arrow-left" size={24} color={isDark ? "#f8fafc" : "#0f172a"} />
        </TouchableOpacity>
      ),
      headerTitle: () => (
        <View>
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[styles.headerTitleText, isDark && { color: "#f8fafc" }]}
          >
            {headerDisplayName || "Conversation"}
          </Text>
        </View>
      ),
      headerRight: () => (
        <TouchableOpacity
          onPress={() => {
            if (isGroupChat) {
              setShowMembersModal(true);
            }
          }}
          disabled={!isGroupChat}
          activeOpacity={0.6}
          style={{ flexDirection: 'row', alignItems: 'center' }}
        >
          {isGroupChat ? (
            <View style={{ flexDirection: 'row', marginRight: 8 }}>
              {loadingMembers || (groupMembers.length === 0 && !headerAvatarUri) ? (
                // Loading placeholders
                [0, 1, 2].map((i) => (
                  <View
                    key={`placeholder-${i}`}
                    style={[
                      styles.headerTitleAvatar,
                      {
                        backgroundColor: isDark ? "#334155" : "#e2e8f0",
                        marginLeft: i > 0 ? -15 : 0,
                        zIndex: 3 - i,
                        borderWidth: 2,
                        borderColor: isDark ? "#0f172a" : "#ffffff",
                        borderRadius: 18,
                      },
                    ]}
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
                      style={[
                        styles.headerTitleAvatar, 
                        isDark && { backgroundColor: "#334155" },
                        { 
                          marginLeft: index > 0 ? -15 : 0,
                          zIndex: 3 - index,
                          borderWidth: 2,
                          borderColor: isDark ? "#0f172a" : "#ffffff"
                        }
                      ]}
                    >
                      <Image
                        source={{ uri }}
                        style={{ width: '100%', height: '100%', borderRadius: 18 }}
                      />
                    </View>
                  );
                })
              )}
            </View>
          ) : (
            <Image
              source={{ uri: headerAvatarUri }}
              style={[styles.headerTitleAvatar, isDark && { backgroundColor: "#334155" }]}
            />
          )}
        </TouchableOpacity>
      ),
    });
  }, [headerAvatarUri, headerDisplayName, navigation, isGroupChat, groupMembers, isDark]);

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
        const uniqueKey = `${timestamp}-${senderKey}`;

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

      // If we found the message locally, use it. Otherwise show placeholder or nothing.
      const replyText = repliedToMessage?.DecryptedMessage || "Message not loaded";
      const replySenderPk = repliedToMessage?.SenderInfo?.OwnerPublicKeyBase58Check;
      const replySenderProfile = replySenderPk ? profiles[replySenderPk] : null;
      const replyDisplayName = replySenderPk
        ? getProfileDisplayName(replySenderProfile, replySenderPk)
        : "Unknown";

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
        inputRange: [-50, 0],
        outputRange: [1, 0],
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
            <View className="items-center py-3">
              <View className="rounded-full bg-gray-200 px-3 py-1 dark:bg-slate-800">
                <Text className="text-[10px] font-semibold uppercase tracking-wide text-gray-600 dark:text-slate-400">
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
                  <View className="h-8 w-8 items-center justify-center rounded-full bg-gray-200 dark:bg-slate-700">
                    <Feather name="user" size={16} color={isDark ? "#94a3b8" : "#6b7280"} />
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
          <View className="items-center py-3">
            <View className="rounded-full bg-gray-200 px-3 py-1 dark:bg-slate-800">
              <Text className="text-[10px] font-semibold uppercase tracking-wide text-gray-600 dark:text-slate-400">
                {formatDayLabel(timestamp)}
              </Text>
            </View>
          </View>
        ) : null}
        <Swipeable
          ref={swipeableRef}
          renderRightActions={isMine ? undefined : renderSwipeAction}
          renderLeftActions={isMine ? renderSwipeAction : undefined}
          onSwipeableWillOpen={() => {
            onReply(item);
            swipeableRef.current?.close();
          }}
          overshootRight={false}
          overshootLeft={false}
        >
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
                  <View className="h-8 w-8 items-center justify-center rounded-full bg-gray-200 dark:bg-slate-700">
                    <Feather name="user" size={16} color={isDark ? "#94a3b8" : "#6b7280"} />
                  </View>
                ) : null}
              </View>
            ) : null}
            <View
              className={`max-w-[75%] px-4 py-3 ${
                isMine ? "bg-[#0085ff]" : "bg-[#f1f3f5] dark:bg-[#161e27]"
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
                className={`text-[16px] leading-[22px] ${
                  isMine ? "text-white" : "text-[#0f172a] dark:text-white"
                }`}
              >
                {messageText}
              </Text>
              {isLastInGroup && (
                <View
                  className={`mt-1.5 flex-row items-center ${
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
                          className={`text-[11px] ${
                            isMine ? "text-blue-100" : "text-slate-400 dark:text-slate-500"
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
      <View className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3" style={{ transform: [{ scaleY: -1 }] }}>
        <Text className="text-sm font-medium text-red-900">{error}</Text>
      </View>
    );
  }, [error]);

  const footer = useMemo(() => {
    if (messages.length === 0) return null;

    return (
      <View className="py-4 items-center" style={{ transform: [{ scaleY: -1 }] }}>
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
    <SafeAreaView className="flex-1 bg-white dark:bg-black" edges={["bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        <View className="flex-1">
          {isLoading && messages.length === 0 ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#3b82f6" />
            </View>
          ) : (
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
              <View className="items-center justify-center px-6 py-10" style={{ transform: [{ scaleY: -1 }] }}>
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
          recipientAccessGroupPublicKeyBase58Check={recipientInfo?.AccessGroupPublicKeyBase58Check}
          replyToMessage={replyToMessage}
          onCancelReply={() => setReplyToMessage(null)}
          profiles={profiles}
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
    color: "#0f172a",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  headerRightContainer: {
    paddingRight: 12,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#e2e8f0",
    borderWidth: 1,
    borderColor: "#f1f5f9",
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
  outgoingBubbleShadow: {},
  incomingBubbleShadow: {},
  composerContainer: {
    borderTopWidth: 1,
    borderTopColor: "#334155",
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginHorizontal: 12,
    marginTop: 12,
    justifyContent: "space-between",
  },
  inputShell: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    borderWidth: 0,
  },
  composerTextInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    color: "#1e293b",
    padding: 0,
    marginLeft: 0,
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
    height: 32,
    width: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonDisabled: {
    backgroundColor: "#e2e8f0", // Light mode disabled
  },
  iconButtonSend: {
    backgroundColor: "#0085ff",
  },
  sendButtonShadow: {},
  rocketIcon: {
    fontSize: 24,
    marginLeft: 6,
  },
  rocketTouchable: {
    paddingHorizontal: 6,
  },
  rocketInlineEmoji: {
    fontSize: 28,
    color: "#4f46e5",
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#e2e8f0",
  },
  headerTitleText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#0f172a",
  },
  headerSubtitleText: {
    fontSize: 12,
    color: "#64748b",
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
    backgroundColor: "rgba(79, 70, 229, 0.08)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(79, 70, 229, 0.2)",
  },
  sendingBannerText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: "600",
    color: "#4f46e5",
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
  androidKeyboardOffset = 0,
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

  const containerPaddingBottom = bottomInset + androidKeyboardOffset;

  const sendButtonInnerStyle = [
    styles.iconButtonBase,
    !hasText ? styles.iconButtonDisabled : styles.iconButtonSend,
    !sendDisabled ? styles.sendButtonShadow : null,
  ];

  const replyPreview = useMemo(() => {
    if (!replyToMessage) return null;
    const senderPk = replyToMessage.SenderInfo?.OwnerPublicKeyBase58Check;
    const senderProfile = senderPk ? profiles[senderPk] : null;
    const displayName = senderPk ? getProfileDisplayName(senderProfile, senderPk) : "Unknown";
    const messageText = replyToMessage.DecryptedMessage || "Message not loaded";

    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderTopWidth: 1,
          borderTopColor: isDark ? '#334155' : '#e2e8f0',
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#3b82f6', marginBottom: 2 }}>
            Replying to {displayName}
          </Text>
          <Text style={{ fontSize: 12, color: isDark ? '#cbd5e1' : '#64748b' }} numberOfLines={1}>
            {messageText}
          </Text>
        </View>
        <TouchableOpacity onPress={onCancelReply} style={{ padding: 4 }}>
          <Feather name="x" size={20} color={isDark ? '#94a3b8' : '#64748b'} />
        </TouchableOpacity>
      </View>
    );
  }, [replyToMessage, onCancelReply, isDark, profiles]);

  return (
    <View
      style={[
        styles.composerContainer,
        {
          paddingBottom: containerPaddingBottom,
          borderTopColor: isDark ? "#334155" : "#e2e8f0",
        },
      ]}
    >
      {replyPreview}
      <View style={styles.composerRow}>
        <View style={[styles.inputShell, isDark && { backgroundColor: "#1e293b" }]}>
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
            style={[
              styles.composerTextInput,
              isDark && { color: "#f8fafc" },
              {
                minHeight: 24,
                maxHeight: 80,
                paddingVertical: 4,
              },
            ]}
          />
          <TouchableOpacity
            onPress={() => onSend()}
            disabled={sendDisabled}
            activeOpacity={0.85}
            style={{ marginLeft: 8 }}
          >
            <View style={[
              sendButtonInnerStyle as any,
              !hasText && isDark && { backgroundColor: "#334155" } // Dark mode disabled override
            ]}>
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
