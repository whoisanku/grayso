import React, {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
  TextInput,
  Alert,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { UserAvatar } from "@/components/UserAvatar";

import Reanimated from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { LiquidGlassView } from "../../../utils/liquidGlass";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { DeSoIdentityContext } from "react-deso-protocol";

import {
  ChatType,
  DecryptedMessageEntryResponse,
  type ProfileEntryResponse,
  type PublicKeyToProfileEntryResponseMap,
} from "deso-protocol";
import {
  DEFAULT_KEY_MESSAGING_GROUP_NAME,
  SCROLL_TO_BOTTOM_THRESHOLD,
  MESSAGE_GROUPING_WINDOW_NS,
} from "@/constants/messaging";
import {
  FALLBACK_PROFILE_IMAGE,
  getProfileImageUrl,
} from "@/utils/deso";
import { getMessageId } from "@/utils/messageUtils";
import type { RootStackParamList } from "@/navigation/types";
import { searchUsers, UserSearchResult } from "../../../lib/userSearch";

import ScreenWrapper from "../../../components/ScreenWrapper";
import { Composer } from "../components/Composer";
import { MessageBubble } from "../components/MessageBubble";
import {
  ActionSheetCard,
  SelectedBubblePreview,
  computeModalPositions,
} from "../components/ActionSheet";
import { BlurBackdrop } from "../components/BlurBackdrop";

// Hooks
import { useConversationMessages } from "@/features/messaging/hooks/useConversationMessages";
import { useMessageActions } from "@/features/messaging/hooks/useMessageActions";
import { useGroupMembers } from "@/features/messaging/hooks/useGroupMembers";
import { usePresence } from "@/features/messaging/hooks/usePresence";

import { TypingIndicator } from "../components/TypingIndicator";
import { useAccentColor } from "@/state/theme/useAccentColor";
import { DesktopShell } from "../components/desktop/DesktopShell";
import { DesktopLeftNav } from "../components/desktop/DesktopLeftNav";
import { DesktopRightNav } from "../components/desktop/DesktopRightNav";
import {
  CENTER_CONTENT_MAX_WIDTH,
  useLayoutBreakpoints,
} from "@/alf/breakpoints";
import UserGroupIcon from "@/assets/navIcons/user-group.svg";
import UserGroupIconFilled from "@/assets/navIcons/user-group-filled.svg";

const devLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
};

const DEFAULT_AVATAR_BLURHASH = "L5H2EC=PM+yV0g-mq.wG9c010J}I";

type Props = NativeStackScreenProps<RootStackParamList, "Conversation">;

function looksLikePublicKeyTitle(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  // Common "formatted public key" variants seen in the UI.
  if (v.includes("…") || v.includes("...")) {
    return v.startsWith("BC1") || v.startsWith("tBC1");
  }
  // Raw DeSo public keys are long and start with BC1 (or testnet tBC1).
  return /^t?BC1[1-9A-HJ-NP-Za-km-z]{20,}$/.test(v);
}

export function ConversationScreen({ navigation, route }: Props) {
  const { currentUser } = useContext(DeSoIdentityContext);

  const enableFlashListChat =
    process.env.EXPO_PUBLIC_ENABLE_FLASHLIST_CHAT === "true";

  const {
    threadPublicKey,
    chatType: paramChatType,
    userPublicKey: paramUserPublicKey,
    threadAccessGroupKeyName = DEFAULT_KEY_MESSAGING_GROUP_NAME,
    userAccessGroupKeyName = DEFAULT_KEY_MESSAGING_GROUP_NAME,
    partyGroupOwnerPublicKeyBase58Check,
    lastTimestampNanos,
    title,
    recipientInfo,
    initialGroupMembers,
    initialProfile,
  } = route.params;

  // Fallback to currentUser's public key if not provided in params
  const userPublicKey =
    paramUserPublicKey || currentUser?.PublicKeyBase58Check || "";

  // Handle chatType string vs enum from params/query params
  const chatType = useMemo(() => {
    if (!paramChatType) return ChatType.DM; // Default to DM
    if (typeof paramChatType === "string") {
      return (paramChatType as string).toUpperCase() === "GROUPCHAT"
        ? ChatType.GROUPCHAT
        : ChatType.DM;
    }
    return paramChatType;
  }, [paramChatType]);

  const isGroupChat = chatType === ChatType.GROUPCHAT;
  const counterPartyPublicKey =
    partyGroupOwnerPublicKeyBase58Check ?? threadPublicKey;
  const recipientOwnerKey = (
    recipientInfo as { OwnerPublicKeyBase58Check?: string }
  )?.OwnerPublicKeyBase58Check;

  // Create a unique conversationId that matches the format used in HomeScreen:
  // For group chats: publicKey-accessGroupKeyName
  // For DMs: sorted public keys + DM suffix for consistent channel
  const conversationId = useMemo(() => {
    if (!userPublicKey) return "";

    if (isGroupChat) {
      // Use accessGroupKeyName for group chats (matches HomeScreen ID format)
      return `${counterPartyPublicKey}-${threadAccessGroupKeyName}`;
    }
    // Sort the two public keys alphabetically to get consistent ID
    const keys = [userPublicKey, counterPartyPublicKey].sort();
    return `${keys[0]}-${keys[1]}-DM`;
  }, [
    counterPartyPublicKey,
    threadAccessGroupKeyName,
    isGroupChat,
    userPublicKey,
  ]);

  const insets = useSafeAreaInsets();
  const { isDark, accentColor, accentSoft, accentStrong } = useAccentColor();
  const { isDesktop } = useLayoutBreakpoints();
  const isWebDesktop = Platform.OS === "web" && isDesktop;

  // Ref to store Composer's focusInput function for synchronous keyboard triggering
  const focusInputRef = useRef<(() => void) | null>(null);

  const modalIconButtonStyle = useMemo(
    () => ({
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: isDark
        ? "rgba(51, 65, 85, 0.6)"
        : "rgba(241, 245, 249, 1)",
      alignItems: "center" as const,
      justifyContent: "center" as const,
    }),
    [isDark]
  );
  const composerBottomInset = Math.max(insets.bottom, 8);

  // --- Custom Hooks ---

  const {
    messages,
    setMessages,
    isLoading,
    isRefreshing,
    hasMore,
    error,
    profiles,
    isSendingMessage,
    setIsSendingMessage,
    loadMessages,
    handleComposerMessageSent,
    messageIdMap,
    profileCacheRef,
  } = useConversationMessages({
    threadPublicKey,
    chatType,
    userPublicKey,
    threadAccessGroupKeyName,
    userAccessGroupKeyName,
    partyGroupOwnerPublicKeyBase58Check,
    lastTimestampNanos,
    recipientInfo,
    conversationId,
    initialProfile, // Pass initialProfile to hook
  });

  const {
    replyToMessage,
    setReplyToMessage,
    selectedMessage,
    setSelectedMessage,
    editingMessage,
    setEditingMessage,
    editDraft,
    setEditDraft,
    isSavingEdit,
    selectedBubbleLayout,
    setSelectedBubbleLayout,
    bubbleLayoutsRef,
    blurAnim, // Add blur animation
    backdropStyle,
    actionSheetStyle,
    bubblePreviewStyle,
    handleReply,
    handleMessageLongPress,
    handleCloseMessageActions,
    handleActionReply,
    handleActionCopy,
    startEditingMessage,
    handleCancelEdit,
    handleSaveEdit,
  } = useMessageActions({
    userPublicKey,
    counterPartyPublicKey,
    threadAccessGroupKeyName,
    userAccessGroupKeyName,
    recipientInfo,
    setMessages,
    focusInput: () => focusInputRef.current?.(),
  });

  const selectedShowTail = useMemo(() => {
    if (!selectedMessage) return true;
    const index = messages.indexOf(selectedMessage);
    if (index < 0) return true;
    const nextMessage = index > 0 ? messages[index - 1] : undefined;
    const timestamp = selectedMessage.MessageInfo?.TimestampNanos;
    const isNextSameSender = nextMessage?.IsSender === selectedMessage.IsSender;
    const isNextClose =
      nextMessage && timestamp && nextMessage.MessageInfo?.TimestampNanos
        ? Math.abs(timestamp - nextMessage.MessageInfo.TimestampNanos) <
        MESSAGE_GROUPING_WINDOW_NS
        : false;
    return !isNextSameSender || !isNextClose;
  }, [messages, selectedMessage]);

  const {
    groupMembers,
    loadingMembers,
    showMembersModal,
    setShowMembersModal,
    addMembers,
    removeMembers,
    addingMemberKey,
    isRemovingMember,
    isOwner,
  } = useGroupMembers({
    isGroupChat,
    threadAccessGroupKeyName,
    recipientOwnerKey,
    counterPartyPublicKey,
    initialGroupMembers,
    userPublicKey,
  });

  // Ensure we always have fast display names (avoid showing public keys)
  // by merging in any usernames we already know (from navigation params and group members).
  const profilesForUi: PublicKeyToProfileEntryResponseMap = useMemo(() => {
    const next: PublicKeyToProfileEntryResponseMap = { ...profiles };

    const setUsername = (
      pk: string | undefined,
      username: string | null | undefined
    ) => {
      const u = username?.trim();
      if (!pk || !u) return;
      const existing = next[pk];
      if (existing?.Username?.trim()) return;
      next[pk] = {
        ...(existing ?? ({} as ProfileEntryResponse)),
        Username: u,
      } as ProfileEntryResponse;
    };

    // Current user (useful for reply previews etc.)
    setUsername(userPublicKey, currentUser?.ProfileEntryResponse?.Username);

    // Direct chat: param-level username is the fastest.
    const paramUsername = (
      recipientInfo as { username?: string | null } | undefined
    )?.username;
    setUsername(counterPartyPublicKey, paramUsername);

    // Prefer a fully-populated initialProfile if it contains a username.
    if (initialProfile?.Username?.trim() && counterPartyPublicKey) {
      const existing = next[counterPartyPublicKey];
      if (!existing?.Username?.trim()) {
        next[counterPartyPublicKey] = initialProfile;
      }
    }

    // Group chats: seed from the group members list (GraphQL) and any initial members.
    if (isGroupChat) {
      for (const m of groupMembers ?? []) {
        setUsername(m.publicKey, m.username);
      }
      for (const m of initialGroupMembers ?? []) {
        setUsername(m.publicKey, m.username);
      }
    }

    return next;
  }, [
    profiles,
    userPublicKey,
    currentUser?.ProfileEntryResponse?.Username,
    recipientInfo,
    counterPartyPublicKey,
    initialProfile,
    isGroupChat,
    groupMembers,
    initialGroupMembers,
  ]);

  // Add Member Modal State
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Search Debounce
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length > 2) {
        setIsSearching(true);
        try {
          const results = await searchUsers(searchQuery);
          // Filter out existing members
          const existingMemberKeys = new Set(
            groupMembers.map((m) => m.publicKey)
          );
          setSearchResults(
            results.filter((r) => !existingMemberKeys.has(r.publicKey))
          );
          setHasSearched(true);
        } catch (e) {
          console.error("Search failed", e);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
        setHasSearched(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, groupMembers]);

  const handleAddMember = async (user: UserSearchResult) => {
    try {
      await addMembers([user.publicKey]);
      Alert.alert("Success", `${user.username} added to the group.`);
      setShowAddMemberModal(false);
      setSearchQuery("");
    } catch (e) {
      Alert.alert("Error", "Failed to add member.");
    }
  };

  // Remove Member Modal State
  const [memberToRemove, setMemberToRemove] = useState<{
    publicKey: string;
    username: string;
  } | null>(null);

  const handleRemoveMember = (memberPublicKey: string, username: string) => {
    setMemberToRemove({ publicKey: memberPublicKey, username });
  };

  const confirmRemoveMember = async () => {
    if (!memberToRemove) return;

    try {
      await removeMembers([memberToRemove.publicKey]);
      setMemberToRemove(null);
    } catch (e) {
      console.error("Failed to remove member:", e);
      Alert.alert("Error", "Failed to remove member.");
    }
  };

  // Presence tracking
  const {
    onlineUsers,
    isOnline,
    connectionState: presenceConnectionState,
    typingUsers,
  } = usePresence({
    conversationId,
    userPublicKey,
    enabled: true, // Enable for both DMs and Groups to support typing indicators
  });

  const recipientOnline = !isGroupChat && isOnline(counterPartyPublicKey);

  // Calculate typing status and label
  const typingMemberPk = useMemo(() => {
    // Find the first person typing who isn't us
    return Object.keys(typingUsers).find(
      (pk) => typingUsers[pk] && pk !== userPublicKey
    );
  }, [typingUsers, userPublicKey]);

  const isTyping = !!typingMemberPk;

  const typingLabel = useMemo(() => {
    if (!isTyping || !typingMemberPk) return undefined;

    if (isGroupChat) {
      const profile = profiles[typingMemberPk];
      const name = profile?.Username || "Someone";
      return `${name} is typing...`;
    }

    return "Typing...";
  }, [isTyping, typingMemberPk, isGroupChat, profiles]);

  // Debug logging
  useEffect(() => {
    devLog("[ConversationScreen] Presence Debug:", {
      isGroupChat,
      conversationId,
      userPublicKey,
      counterPartyPublicKey,
      onlineUsers,
      recipientOnline,
      presenceConnectionState,
      typingUsers,
    });
  }, [
    isGroupChat,
    conversationId,
    userPublicKey,
    counterPartyPublicKey,
    onlineUsers,
    recipientOnline,
    presenceConnectionState,
    typingUsers,
  ]);



  // --- UI State & Refs ---

  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const scrollBarStyle = useMemo(
    () =>
      Platform.OS === "web"
        ? ({
          scrollbarWidth: "thin",
          scrollbarColor: `${isDark ? "#475569" : "#cbd5e1"} ${isDark ? "#0a0f1a" : "#ffffff"
            }`,
        } as any)
        : undefined,
    [isDark]
  );
  const [actualBubbleHeight, setActualBubbleHeight] = useState<
    number | undefined
  >(undefined);
  const scrollToBottomAnim = useRef(new Animated.Value(1)).current;
  const flatListRef = useRef<any>(null);
  const scrollOffsetRef = useRef(0);
  const composerHideAnim = useRef(new Animated.Value(0)).current;

  // --- Effects & Callbacks ---

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // Hide/slide composer while action sheet is open (iMessage-like)
  useEffect(() => {
    Animated.timing(composerHideAnim, {
      toValue: selectedMessage ? 1 : 0,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [composerHideAnim, selectedMessage]);

  // Reset actual bubble height when modal closes
  useEffect(() => {
    if (!selectedMessage) {
      setActualBubbleHeight(undefined);
    }
  }, [selectedMessage]);

  const composerAnimatedStyle = {
    transform: [
      {
        translateY: composerHideAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 80],
          extrapolate: "clamp",
        }),
      },
    ],
    opacity: composerHideAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0],
      extrapolate: "clamp",
    }),
  };

  // No need to scrollToEnd with inverted list - newest messages automatically at bottom

  // --- Render Helpers ---

  const headerProfile = profilesForUi[counterPartyPublicKey];
  const headerDisplayName = useMemo(() => {
    if (title?.trim() && !looksLikePublicKeyTitle(title)) return title.trim();
    if (isGroupChat)
      return (
        recipientInfo?.AccessGroupKeyName || headerProfile?.Username || "Group"
      );
    // Check recipientInfo.username first for new conversations (when headerProfile doesn't exist yet)
    const recipientUsername = (recipientInfo as { username?: string })
      ?.username;
    if (recipientUsername) return recipientUsername;
    // Show "Loading..." instead of truncated public key while profile loads
    if (headerProfile?.Username) return headerProfile.Username;
    return "Loading...";
  }, [counterPartyPublicKey, headerProfile, isGroupChat, recipientInfo, title]);

  const headerAvatarUri = useMemo(() => {
    if (isGroupChat) {
      return (
        getProfileImageUrl(recipientOwnerKey ?? counterPartyPublicKey, {
          groupChat: true,
        }) || FALLBACK_PROFILE_IMAGE
      );
    }
    return getProfileImageUrl(counterPartyPublicKey) || FALLBACK_PROFILE_IMAGE;
  }, [counterPartyPublicKey, isGroupChat, recipientOwnerKey]);

  // Use regular messages directly - ephemeral feature not needed
  // Supabase is only used for broadcast notifications, not message storage
  const displayMessages = messages;

  const handleAvatarPress = useCallback(
    (publicKey: string, username?: string) => {
      navigation.navigate("Main", {
        screen: "Profile",
        params: {
          username: username || undefined,
          publicKey: publicKey,
        },
      });
    },
    [navigation]
  );

  const renderItem = useCallback(
    ({
      item,
      index,
    }: {
      item: DecryptedMessageEntryResponse;
      index: number;
    }) => {
      const previousMessage = messages[index + 1];
      const nextMessage = messages[index - 1];
      const previousTimestamp = previousMessage?.MessageInfo?.TimestampNanos;

      return (
        <MessageBubble
          item={item}
          previousMessage={previousMessage}
          nextMessage={nextMessage}
          previousTimestamp={previousTimestamp}
          profiles={profilesForUi}
          isGroupChat={isGroupChat}
          onReply={handleReply}
          onLongPress={handleMessageLongPress}
          onBubbleMeasure={(id, layout) => {
            bubbleLayoutsRef.current.set(id, layout);
          }}
          messageIdMap={messageIdMap}
          isDark={isDark}
          onAvatarPress={handleAvatarPress}
        />
      );
    },
    [
      handleMessageLongPress,
      handleReply,
      isDark,
      isGroupChat,
      messageIdMap,
      profilesForUi,
      bubbleLayoutsRef,
      messages,
      handleAvatarPress,
    ]
  );

  const keyExtractor = useCallback(
    (item: DecryptedMessageEntryResponse, index: number) => {
      const messageId = getMessageId(item);
      const senderKey =
        item.SenderInfo?.OwnerPublicKeyBase58Check ??
        item.RecipientInfo?.OwnerPublicKeyBase58Check ??
        "unknown-sender";

      if (messageId) {
        return `${messageId}-${senderKey}`;
      }

      return `message-${senderKey}-${index}`;
    },
    []
  );

  const flashListData = useMemo(
    () => (enableFlashListChat ? [...displayMessages].reverse() : displayMessages),
    [displayMessages, enableFlashListChat]
  );

  const handleListScroll = useCallback(
    (e: any) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      const rawOffsetY = contentOffset.y;

      scrollOffsetRef.current = rawOffsetY;

      if (enableFlashListChat) {
        const distanceToBottom =
          contentSize.height - layoutMeasurement.height - rawOffsetY;
        if (distanceToBottom > SCROLL_TO_BOTTOM_THRESHOLD) {
          if (!showScrollToBottom) {
            scrollToBottomAnim.setValue(1);
            setShowScrollToBottom(true);
          }
        } else {
          if (showScrollToBottom) setShowScrollToBottom(false);
        }
        return;
      }

      if (rawOffsetY > SCROLL_TO_BOTTOM_THRESHOLD) {
        if (!showScrollToBottom) {
          scrollToBottomAnim.setValue(1);
          setShowScrollToBottom(true);
        }
      } else {
        if (showScrollToBottom) setShowScrollToBottom(false);
      }
    },
    [
      enableFlashListChat,
      scrollToBottomAnim,
      showScrollToBottom,
      setShowScrollToBottom,
    ]
  );

  const isPaginating = useMemo(() => {
    return isLoading && messages.length > 0 && !isRefreshing;
  }, [isLoading, messages.length, isRefreshing]);

  const topListHeader = useMemo(() => {
    // Only show spinner when there are more messages to load
    if (!hasMore) return null;

    return (
      <View style={{ paddingVertical: 16, alignItems: "center" }}>
        <ActivityIndicator
          size="small"
          color={isDark ? "#94a3b8" : "#64748b"}
        />
      </View>
    );
  }, [hasMore, isDark]);

  // Typing indicator and error footer (appears at visual BOTTOM for inverted list)
  const bottomListFooter = useMemo(() => {
    if (error) {
      return (
        <View className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
          <Text className="text-sm font-medium text-red-900">{error}</Text>
        </View>
      );
    }
    // Show typing indicator as part of message stream
    if (isTyping) {
      return <TypingIndicator label={typingLabel} isDark={isDark} />;
    }
    return null;
  }, [error, isTyping, typingLabel, isDark]);



  return (
    <DesktopShell>
      <ScreenWrapper
        edges={["top", "left", "right", "bottom"]}
        keyboardAvoiding={Platform.OS === "ios"}
        keyboardVerticalOffset={0}
        backgroundColor={isDark ? "#0a0f1a" : "#ffffff"}
        useKeyboardController={true}
      >
        {/* Custom Header */}
        <View
          // @ts-ignore - data attribute for CSS scroll lock
          dataSet={{ scrollLock: "true" }}
          className="flex-row items-center px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0a0f1a]"
        >
          <View className="flex-row items-center flex-1 min-w-0">
            <TouchableOpacity
              onPress={() => {
                if (navigation.canGoBack()) {
                  navigation.goBack();
                } else {
                  navigation.navigate("Main");
                }
              }}
              className="mr-3"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {LiquidGlassView ? (
                <LiquidGlassView
                  effect="regular"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Feather
                    name="chevron-left"
                    size={22}
                    color={isDark ? "#fff" : "#000"}
                  />
                </LiquidGlassView>
              ) : (
                <Feather
                  name="arrow-left"
                  size={24}
                  color={isDark ? "#f8fafc" : "#0f172a"}
                />
              )}
            </TouchableOpacity>
            <View className="flex-1 min-w-0">
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
              } else {
                // Navigate to DM partner's profile
                navigation.navigate("Main", {
                  screen: "Profile",
                  params: {
                    username: headerProfile?.Username || undefined,
                    publicKey: counterPartyPublicKey,
                  },
                });
              }
            }}
            activeOpacity={0.6}
            className="ml-2"
            style={{ flexShrink: 0 }}
          >
            {isGroupChat ? (
              <View className="flex-row items-center">
                <View className="flex-row">
                  {loadingMembers ||
                    (groupMembers.length === 0 && !headerAvatarUri)
                    ? // Loading placeholders
                    [0, 1, 2].map((i) => (
                      <View
                        key={`placeholder-${i}`}
                        className={`h-9 w-9 rounded-full bg-slate-200 border-2 border-white dark:bg-slate-700 dark:border-slate-800 ${i > 0 ? "-ml-[15px]" : ""
                          }`}
                        style={{ zIndex: 3 - i }}
                      />
                    ))
                    : groupMembers.slice(0, 3).map((member, index) => {
                      const uri = getProfileImageUrl(member.publicKey) || FALLBACK_PROFILE_IMAGE;

                      return (
                        <View
                          key={member.publicKey}
                          className={`h-9 w-9 rounded-full bg-slate-200 border-2 border-white dark:bg-slate-700 dark:border-slate-800 ${index > 0 ? "-ml-[15px]" : ""
                            }`}
                          style={{ zIndex: 3 - index }}
                        >
                          <UserAvatar
                            uri={uri}
                            name={member.username || ""}
                            size={36}
                            className="h-full w-full rounded-full"
                          />
                        </View>
                      );
                    })}
                </View>
                {/* Show member count badge if more than 3 members */}
                {!loadingMembers && groupMembers.length > 3 && (
                  <View
                    className="-ml-[10px] h-9 px-2.5 rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-white dark:border-slate-800 items-center justify-center"
                    style={{ zIndex: -1 }}
                  >
                    <Text className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      +{groupMembers.length - 3}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <UserAvatar
                uri={headerAvatarUri}
                name={headerDisplayName || ""}
                size={36}
                className="bg-slate-200 dark:bg-slate-700"
              />
            )}
          </TouchableOpacity>
        </View>

        {/* Main content - limited width on web for better readability */}
        <View
          style={[
            { flex: 1, minHeight: 0 },
            Platform.OS === "web" && {
              maxWidth: 600,
              width: "100%",
              alignSelf: "center",
            },
          ]}
        >
          <View style={{ flex: 1, minHeight: 0 }}>
            {isLoading && messages.length === 0 ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="large" color={accentColor} />
              </View>
            ) : (
              enableFlashListChat ? (
                <FlashList<DecryptedMessageEntryResponse>
                  ref={flatListRef}
                  data={flashListData}
                  keyExtractor={keyExtractor}
                  renderItem={renderItem}
                  ListHeaderComponent={topListHeader}
                  ListFooterComponent={bottomListFooter}
                  showsVerticalScrollIndicator={Platform.OS === "web"}
                  style={scrollBarStyle}
                  contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingTop: 12,
                    flexGrow: 1,
                    justifyContent: "flex-end",
                  }}
                  onStartReached={() => {
                    if (!isLoading && hasMore) {
                      loadMessages(false);
                    }
                  }}
                  onStartReachedThreshold={0.3}
                  maintainVisibleContentPosition={{
                    autoscrollToTopThreshold: 40,
                    autoscrollToBottomThreshold: 80,
                    animateAutoScrollToBottom: true,
                    startRenderingFromBottom: true,
                  }}
                  onScroll={handleListScroll}
                  scrollEventThrottle={16}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="interactive"
                  ListEmptyComponent={() => (
                    <View
                      className="items-center justify-center px-6 py-10"
                      style={{ minHeight: 400 }}
                    >
                      {isLoading ? (
                        <View className="items-center">
                          <ActivityIndicator size="large" color={accentColor} />
                          <Text className="mt-4 text-sm font-medium text-gray-500">
                            Loading messages...
                          </Text>
                        </View>
                      ) : (
                        <View className="items-center rounded-2xl border border-gray-200 bg-white px-6 py-10 dark:border-slate-800 dark:bg-slate-900">
                          <Feather
                            name="message-circle"
                            size={38}
                            color={isDark ? "#64748b" : "#9ca3af"}
                          />
                          <Text className="mt-4 text-lg font-semibold text-gray-900 dark:text-slate-200">
                            No messages yet
                          </Text>
                          <Text className="mt-1 text-center text-sm text-gray-500 dark:text-slate-400">
                            Start the conversation and it will appear here
                            instantly.
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                />
              ) : (
                <FlatList<DecryptedMessageEntryResponse>
                  ref={flatListRef}
                  data={displayMessages}
                  keyExtractor={keyExtractor}
                  renderItem={renderItem}
                  inverted={true}
                  // With inverted list: Footer appears at visual TOP, Header at visual BOTTOM
                  ListFooterComponent={topListHeader}
                  ListHeaderComponent={bottomListFooter}
                  showsVerticalScrollIndicator={Platform.OS === "web"}
                  style={scrollBarStyle}
                  contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingTop: 12,
                  }}
                  // Load older messages when scrolling toward the "end" (visually = top)
                  onEndReached={() => {
                    if (!isLoading && hasMore) {
                      loadMessages(false);
                    }
                  }}
                  onEndReachedThreshold={0.3}
                  onScroll={handleListScroll}
                  scrollEventThrottle={16}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="interactive"
                  // Performance optimizations - especially important for web
                  windowSize={Platform.OS === "web" ? 21 : 11}
                  maxToRenderPerBatch={Platform.OS === "web" ? 5 : 10}
                  initialNumToRender={Platform.OS === "web" ? 15 : 20}
                  removeClippedSubviews={Platform.OS !== "web"}
                  updateCellsBatchingPeriod={Platform.OS === "web" ? 100 : 50}
                  ListEmptyComponent={() => (
                    <View
                      className="items-center justify-center px-6 py-10"
                      style={{ minHeight: 400, transform: [{ scaleY: -1 }] }}
                    >
                      {isLoading ? (
                        <View className="items-center">
                          <ActivityIndicator size="large" color={accentColor} />
                          <Text className="mt-4 text-sm font-medium text-gray-500">
                            Loading messages...
                          </Text>
                        </View>
                      ) : (
                        <View className="items-center rounded-2xl border border-gray-200 bg-white px-6 py-10 dark:border-slate-800 dark:bg-slate-900">
                          <Feather
                            name="message-circle"
                            size={38}
                            color={isDark ? "#64748b" : "#9ca3af"}
                          />
                          <Text className="mt-4 text-lg font-semibold text-gray-900 dark:text-slate-200">
                            No messages yet
                          </Text>
                          <Text className="mt-1 text-center text-sm text-gray-500 dark:text-slate-400">
                            Start the conversation and it will appear here
                            instantly.
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                />
              )
            )}

            {showScrollToBottom && (
              <Animated.View
                style={{
                  position: "absolute",
                  bottom: 16,
                  right: 16,
                  zIndex: 10,
                  opacity: scrollToBottomAnim,
                }}
              >
                <TouchableOpacity
                  onPress={() => {
                    devLog(
                      "[ConversationScreen] Scroll-to-latest pressed",
                      {
                        scrollOffset: scrollOffsetRef.current,
                        messageCount: messages.length,
                      }
                    );
                    Animated.timing(scrollToBottomAnim, {
                      toValue: 0,
                      duration: 200,
                      useNativeDriver: true,
                    }).start(() => setShowScrollToBottom(false));
                    try {
                      if (enableFlashListChat) {
                        flatListRef.current?.scrollToEnd({ animated: true });
                      } else {
                        // With inverted list, offset 0 = visual bottom (newest messages)
                        flatListRef.current?.scrollToOffset({
                          offset: 0,
                          animated: true,
                        });
                      }
                    } catch (err) {
                      console.warn(
                        "[ConversationScreen] scrollToOffset failed",
                        err
                      );
                    }
                  }}
                  activeOpacity={0.8}
                >
                  {LiquidGlassView ? (
                    <LiquidGlassView
                      effect="regular"
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Feather
                        name="chevron-down"
                        size={24}
                        color={isDark ? "#fff" : "#1f2937"}
                      />
                    </LiquidGlassView>
                  ) : (
                    <BlurView
                      intensity={80}
                      tint={isDark ? "dark" : "light"}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                      }}
                    >
                      <Feather
                        name="chevron-down"
                        size={24}
                        color={isDark ? "#fff" : "#4b5563"}
                      />
                    </BlurView>
                  )}
                </TouchableOpacity>
              </Animated.View>
            )}
          </View>
        </View>



        <Animated.View
          style={composerAnimatedStyle}
          pointerEvents={selectedMessage ? "none" : "auto"}
        >
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
            recipientAccessGroupPublicKeyBase58Check={
              recipientInfo?.AccessGroupPublicKeyBase58Check
            }
            replyToMessage={replyToMessage}
            onCancelReply={() => setReplyToMessage(null)}
            profiles={profilesForUi}
            editingMessage={editingMessage}
            editDraft={editDraft}
            onEditDraftChange={setEditDraft}
            onCancelEdit={handleCancelEdit}
            onSaveEdit={handleSaveEdit}
            isSavingEdit={isSavingEdit}
            recipientOnline={recipientOnline}
            onFocusInput={(focusFn) => {
              focusInputRef.current = focusFn;
            }}
          />
        </Animated.View>

        <Modal
          visible={Boolean(selectedMessage)}
          transparent
          statusBarTranslucent
          animationType="none"
          onRequestClose={handleCloseMessageActions}
        >
          <View style={{ flex: 1 }}>
            {/* Full-screen blur backdrop - blurs conversation area only on desktop */}
            <BlurBackdrop isDark={isDark} opacity={blurAnim} />

            <TouchableOpacity
              activeOpacity={1}
              style={StyleSheet.absoluteFill}
              onPress={handleCloseMessageActions}
            />

            {selectedMessage && selectedBubbleLayout
              ? (() => {
                const positions = computeModalPositions(
                  selectedBubbleLayout,
                  composerBottomInset,
                  Boolean(selectedMessage?.IsSender),
                  actualBubbleHeight // Pass actual measured bubble height
                );
                return (
                  <>
                    <Reanimated.View
                      pointerEvents="none"
                      style={[
                        {
                          position: "absolute",
                          top: positions.bubbleTop,
                          left: selectedBubbleLayout.x,
                          width: selectedBubbleLayout.width,
                        },
                        bubblePreviewStyle,
                      ]}
                    >
                      <SelectedBubblePreview
                        message={selectedMessage}
                        profiles={profilesForUi}
                        isDark={isDark}
                        messageIdMap={messageIdMap}
                        layout={{
                          width: selectedBubbleLayout.width,
                          height: selectedBubbleLayout.height,
                        }}
                        onLayout={(event) => {
                          const { height } = event.nativeEvent.layout;
                          setActualBubbleHeight(height);
                        }}
                        isGroupChat={isGroupChat}
                        showTail={selectedShowTail}
                      />
                    </Reanimated.View>

                    <Reanimated.View
                      style={[
                        {
                          position: "absolute",
                          top: positions.actionTop,
                          left: positions.actionLeft,
                        },
                        actionSheetStyle,
                      ]}
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
                    </Reanimated.View>
                  </>
                );
              })()
              : null}
          </View>
        </Modal>

        <Modal
          visible={showMembersModal}
          animationType={isWebDesktop ? "fade" : "slide"}
          presentationStyle={Platform.OS === "web" ? "overFullScreen" : "pageSheet"}
          transparent={Platform.OS === "web"}
          onRequestClose={() => {
            if (showAddMemberModal) {
              setShowAddMemberModal(false);
            } else {
              setShowMembersModal(false);
            }
          }}
        >
          {(() => {
            const membersModalContent = (
              <View style={{ flex: 1, backgroundColor: isDark ? "#0a0f1a" : "#ffffff" }}>
                {/* Conditional header based on which view is active */}
                {showAddMemberModal ? (
                  // Add Member Header
                  <View
                    className="flex-row items-center justify-between px-5 border-b border-gray-200 dark:border-slate-800"
                    style={{
                      paddingTop: Platform.OS === "web" ? 40 : (insets.top + 16),
                      paddingBottom: 16
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => setShowAddMemberModal(false)}
                      activeOpacity={0.85}
                      style={modalIconButtonStyle}
                    >
                      <Feather
                        name="arrow-left"
                        size={20}
                        color={isDark ? "#94a3b8" : "#64748b"}
                      />
                    </TouchableOpacity>
                    <Text className="text-xl font-bold text-[#111] dark:text-white">
                      Add Member
                    </Text>
                    <View style={{ width: 36 }} />
                  </View>
                ) : (
                  // Group Members Header
                  <View
                    className="flex-row items-center justify-between px-5 border-b border-gray-200 dark:border-slate-800"
                    style={{
                      paddingTop: Platform.OS === "web" ? 40 : (insets.top + 16),
                      paddingBottom: 16
                    }}
                  >
                    <Text className="text-xl font-bold text-[#111] dark:text-white">
                      Group Members
                    </Text>
                    <View className="flex-row items-center">
                      {isOwner && (
                        <TouchableOpacity
                          onPress={() => setShowAddMemberModal(true)}
                          activeOpacity={0.8}
                          style={[modalIconButtonStyle, { marginRight: 12 }]}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Feather
                            name="user-plus"
                            size={20}
                            color={isDark ? "#94a3b8" : "#64748b"}
                          />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={() => setShowMembersModal(false)}
                        activeOpacity={0.8}
                        style={modalIconButtonStyle}
                      >
                        <Feather
                          name="x"
                          size={20}
                          color={isDark ? "#94a3b8" : "#64748b"}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Conditional content based on which view is active */}
                {showAddMemberModal ? (
                  // Add Member Content
                  <>
                    <View
                      style={{ paddingHorizontal: 16, paddingVertical: 12 }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          backgroundColor: isDark
                            ? "rgba(51, 65, 85, 0.4)"
                            : "rgba(241, 245, 249, 1)",
                          borderRadius: 14,
                          paddingHorizontal: 16,
                          height: 50,
                          borderWidth: 1,
                          borderColor: isDark
                            ? "rgba(71, 85, 105, 0.3)"
                            : "rgba(203, 213, 225, 0.5)",
                        }}
                      >
                        <Feather
                          name="search"
                          size={18}
                          color={isDark ? "#64748b" : "#94a3b8"}
                        />
                        <TextInput
                          value={searchQuery}
                          onChangeText={setSearchQuery}
                          placeholder="Search by username..."
                          placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                          style={{
                            flex: 1,
                            marginLeft: 12,
                            fontSize: 16,
                            color: isDark ? "#ffffff" : "#0f172a",
                            ...(Platform.OS === "web" && {
                              outlineStyle: "none" as any,
                            }),
                          }}
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                      </View>
                    </View>

                    <FlatList
                      data={searchResults}
                      extraData={addingMemberKey}
                      keyExtractor={(item) => item.publicKey}
                      renderItem={({ item: user }) => {
                        const userImageUrl = getProfileImageUrl(
                          user.publicKey || ""
                        );
                        const isAddingThisUser =
                          addingMemberKey === user.publicKey;

                        return (
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              paddingHorizontal: 20,
                              paddingVertical: 12,
                              borderBottomWidth: 1,
                              borderBottomColor: isDark
                                ? "rgba(51, 65, 85, 0.3)"
                                : "rgba(241, 245, 249, 0.8)",
                            }}
                          >
                            <TouchableOpacity
                              onPress={() => {
                                setShowAddMemberModal(false);
                                navigation.navigate("Main", {
                                  screen: "Profile",
                                  params: {
                                    username: user.username || undefined,
                                    publicKey: user.publicKey,
                                  },
                                });
                              }}
                              activeOpacity={0.7}
                            >
                              <UserAvatar
                                uri={userImageUrl}
                                name={user.username || ""}
                                size={48}
                                className="bg-slate-200 dark:bg-slate-700"
                              />
                            </TouchableOpacity>
                            <View style={{ marginLeft: 14, flex: 1 }}>
                              <Text
                                style={{
                                  fontSize: 16,
                                  fontWeight: "600",
                                  color: isDark ? "#ffffff" : "#0f172a",
                                }}
                              >
                                {user.username || "Anonymous"}
                              </Text>
                            </View>
                            <TouchableOpacity
                              onPress={() => handleAddMember(user)}
                              disabled={!!addingMemberKey}
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                backgroundColor: accentColor,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {isAddingThisUser ? (
                                <ActivityIndicator size="small" color="white" />
                              ) : (
                                <Feather
                                  name="plus"
                                  size={20}
                                  color="#ffffff"
                                />
                              )}
                            </TouchableOpacity>
                          </View>
                        );
                      }}
                      ListEmptyComponent={
                        isSearching ? (
                          <View
                            style={{
                              alignItems: "center",
                              justifyContent: "center",
                              paddingVertical: 60,
                            }}
                          >
                            <ActivityIndicator
                              size="large"
                              color={accentColor}
                            />
                          </View>
                        ) : hasSearched && searchResults.length === 0 ? (
                          <View
                            style={{
                              alignItems: "center",
                              justifyContent: "center",
                              paddingVertical: 40,
                            }}
                          >
                            <View
                              style={{
                                width: 64,
                                height: 64,
                                borderRadius: 32,
                                backgroundColor: isDark
                                  ? "rgba(51, 65, 85, 0.4)"
                                  : "rgba(241, 245, 249, 1)",
                                alignItems: "center",
                                justifyContent: "center",
                                marginBottom: 16,
                              }}
                            >
                              <UserGroupIcon
                                width={28}
                                height={28}
                                stroke={isDark ? "#64748b" : "#94a3b8"}
                                strokeWidth={2}
                              />
                            </View>
                            <Text
                              style={{
                                fontSize: 16,
                                fontWeight: "600",
                                color: isDark ? "#94a3b8" : "#64748b",
                              }}
                            >
                              No users found
                            </Text>
                          </View>
                        ) : (
                          <View
                            style={{
                              alignItems: "center",
                              justifyContent: "center",
                              paddingVertical: 40,
                            }}
                          >
                            <View
                              style={{
                                width: 64,
                                height: 64,
                                borderRadius: 32,
                                backgroundColor: accentSoft,
                                alignItems: "center",
                                justifyContent: "center",
                                marginBottom: 16,
                              }}
                            >
                              <Feather
                                name="search"
                                size={28}
                                color={accentStrong}
                              />
                            </View>
                            <Text
                              style={{
                                fontSize: 16,
                                fontWeight: "600",
                                color: isDark ? "#e2e8f0" : "#334155",
                              }}
                            >
                              Search for users to add
                            </Text>
                          </View>
                        )
                      }
                    />
                  </>
                ) : (
                  // Group Members Content
                  <FlatList
                    data={[...groupMembers].sort((a, b) => {
                      // Put admin (owner) at the top
                      if (a.publicKey === recipientOwnerKey) return -1;
                      if (b.publicKey === recipientOwnerKey) return 1;
                      return 0;
                    })}
                    keyExtractor={(item) => item.publicKey}
                    renderItem={({ item: member }) => {
                      const memberImageUrl = getProfileImageUrl(member.publicKey);
                      const isMe = member.publicKey === userPublicKey;
                      const isMemberOwner =
                        member.publicKey === recipientOwnerKey;

                      return (
                        <View className="flex-row items-center px-5 py-3 border-b border-gray-100 dark:border-slate-800">
                          <TouchableOpacity
                            onPress={() => {
                              setShowMembersModal(false);
                              navigation.navigate("Main", {
                                screen: "Profile",
                                params: {
                                  username: member.username || undefined,
                                  publicKey: member.publicKey,
                                },
                              });
                            }}
                            activeOpacity={0.7}
                          >
                            <UserAvatar
                              uri={memberImageUrl}
                              name={member.username || ""}
                              size={48}
                              className="bg-gray-200 dark:bg-slate-700"
                            />
                          </TouchableOpacity>
                          <View className="ml-3 flex-1">
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              <Text className="text-base font-semibold text-[#111] dark:text-white">
                                {member.username || "Anonymous"}{" "}
                                {isMe && "(You)"}
                              </Text>
                              {isMemberOwner && (
                                <View
                                  style={{
                                    paddingHorizontal: 8,
                                    paddingVertical: 3,
                                    backgroundColor: accentColor,
                                    borderRadius: 6,
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 10,
                                      fontWeight: "700",
                                      color: "#ffffff",
                                      textTransform: "uppercase",
                                      letterSpacing: 0.5,
                                    }}
                                  >
                                    Admin
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>
                          {isOwner && !isMe && (
                            <TouchableOpacity
                              onPress={() =>
                                handleRemoveMember(
                                  member.publicKey,
                                  member.username || ""
                                )
                              }
                              className="rounded-full"
                              activeOpacity={0.8}
                              style={{
                                backgroundColor: accentSoft,
                                width: 36,
                                height: 36,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                              disabled={isRemovingMember}
                            >
                              <Feather
                                name="trash-2"
                                size={18}
                                color={accentStrong}
                              />
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    }}
                    ListEmptyComponent={
                      !loadingMembers ? (
                        <View className="flex-1 items-center justify-center py-14">
                          <UserGroupIcon
                            width={48}
                            height={48}
                            stroke="#9ca3af"
                            strokeWidth={2}
                          />
                          <Text className="mt-4 text-base text-gray-500">
                            No members found
                          </Text>
                        </View>
                      ) : (
                        <View className="flex-1 items-center justify-center py-14">
                          <ActivityIndicator size="large" color={accentColor} />
                        </View>
                      )
                    }
                  />
                )}
              </View>
            );

            if (isWebDesktop) {
              // Desktop: Show with sidebars visible
              return (
                <View
                  style={{
                    flex: 1,
                    backgroundColor: isDark
                      ? "rgba(10, 15, 26, 0.85)"
                      : "rgba(255, 255, 255, 0.85)",
                  }}
                >
                  <DesktopLeftNav />
                  <View style={{ flex: 1, alignItems: "center" }}>
                    <View
                      style={{
                        flex: 1,
                        width: "100%",
                        maxWidth: CENTER_CONTENT_MAX_WIDTH,
                        backgroundColor: isDark ? "#0a0f1a" : "#ffffff",
                        borderLeftWidth: 1,
                        borderRightWidth: 1,
                        borderColor: isDark
                          ? "rgba(148, 163, 184, 0.15)"
                          : "rgba(148, 163, 184, 0.25)",
                      }}
                    >
                      <SafeAreaView style={{ flex: 1 }}>
                        {membersModalContent}
                      </SafeAreaView>
                    </View>
                  </View>
                  <DesktopRightNav />
                </View>
              );
            }

            return (
              <View style={{ flex: 1, backgroundColor: isDark ? "#0a0f1a" : "#ffffff" }}>
                <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? "#0a0f1a" : "#ffffff" }}>
                  {membersModalContent}
                </SafeAreaView>
              </View>
            );
          })()}
        </Modal>

        {/* Remove Member Confirmation Modal */}
        <Modal
          visible={!!memberToRemove}
          transparent
          animationType="fade"
          onRequestClose={() => setMemberToRemove(null)}
        >
          <View className="flex-1 justify-center items-center bg-black/50 px-4">
            <View className="bg-white dark:bg-[#1e293b] rounded-2xl w-full max-w-sm p-6 shadow-xl">
              <View className="items-center mb-4">
                <View className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 items-center justify-center mb-4">
                  <Feather name="user-x" size={24} color="#ef4444" />
                </View>
                <Text className="text-xl font-bold text-slate-900 dark:text-white text-center">
                  Remove Member?
                </Text>
                <Text className="text-slate-500 dark:text-slate-400 text-center mt-2">
                  Are you sure you want to remove{" "}
                  <Text className="font-semibold text-slate-900 dark:text-white">
                    {memberToRemove?.username || "this user"}
                  </Text>{" "}
                  from the group?
                </Text>
              </View>

              <View className="flex-row space-x-3">
                <TouchableOpacity
                  onPress={() => setMemberToRemove(null)}
                  className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800"
                >
                  <Text className="text-slate-900 dark:text-white font-semibold text-center">
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={confirmRemoveMember}
                  disabled={isRemovingMember}
                  className="flex-1 py-3 rounded-xl bg-red-500"
                >
                  {isRemovingMember ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text className="text-white font-semibold text-center">
                      Remove
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScreenWrapper>
    </DesktopShell>
  );
}
