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
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  Animated,
  TextInput,
  Alert,
} from "react-native";

import Reanimated from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { LiquidGlassView } from "../../../utils/liquidGlass";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import {
  ChatType,
  DecryptedMessageEntryResponse,
} from "deso-protocol";
import { DEFAULT_KEY_MESSAGING_GROUP_NAME, SCROLL_TO_BOTTOM_THRESHOLD } from "@/constants/messaging";
import {
  FALLBACK_PROFILE_IMAGE,
  getProfileDisplayName,
  getProfileImageUrl,
} from "@/utils/deso";
import type { RootStackParamList } from "@/navigation/types";
import { searchUsers, UserSearchResult } from "../../../lib/userSearch";

import ScreenWrapper from "../../../components/ScreenWrapper";
import { Composer } from "../components/Composer";
import { MessageBubble } from "../components/MessageBubble";
import { ActionSheetCard, SelectedBubblePreview, computeModalPositions } from "../components/ActionSheet";

// Hooks
import { useConversationMessages } from "@/features/messaging/hooks/useConversationMessages";
import { useMessageActions } from "@/features/messaging/hooks/useMessageActions";
import { useGroupMembers } from "@/features/messaging/hooks/useGroupMembers";
import { usePresence } from "@/features/messaging/hooks/usePresence";
import { useEphemeralMessages } from "@/features/messaging/hooks/useEphemeralMessages";
import { TypingIndicator } from "../components/TypingIndicator";
import { useAccentColor } from "@/state/theme/useAccentColor";
import { DesktopShell } from "../components/desktop/DesktopShell";
import { DesktopLeftNav } from "../components/desktop/DesktopLeftNav";
import { DesktopRightNav } from "../components/desktop/DesktopRightNav";
import { CENTER_CONTENT_MAX_WIDTH, useLayoutBreakpoints } from "@/alf/breakpoints";

type Props = NativeStackScreenProps<RootStackParamList, "Conversation">;



export function ConversationScreen({ navigation, route }: Props) {
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

  const isGroupChat = chatType === ChatType.GROUPCHAT;
  const counterPartyPublicKey = partyGroupOwnerPublicKeyBase58Check ?? threadPublicKey;
  const recipientOwnerKey = (recipientInfo as { OwnerPublicKeyBase58Check?: string })?.OwnerPublicKeyBase58Check;

  // Create a unique conversationId that matches the format used in HomeScreen:
  // For group chats: publicKey-accessGroupKeyName  
  // For DMs: sorted public keys + DM suffix for consistent channel
  const conversationId = useMemo(() => {
    if (isGroupChat) {
      // Use accessGroupKeyName for group chats (matches HomeScreen ID format)
      return `${counterPartyPublicKey}-${threadAccessGroupKeyName}`;
    }
    // Sort the two public keys alphabetically to get consistent ID
    const keys = [userPublicKey, counterPartyPublicKey].sort();
    return `${keys[0]}-${keys[1]}-DM`;
  }, [counterPartyPublicKey, threadAccessGroupKeyName, isGroupChat, userPublicKey]);

  const insets = useSafeAreaInsets();
  const { isDark, accentColor, accentSoft, accentStrong } = useAccentColor();
  const { isDesktop } = useLayoutBreakpoints();
  const isWebDesktop = Platform.OS === 'web' && isDesktop;
  const modalIconButtonStyle = useMemo(() => ({
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: isDark ? 'rgba(51, 65, 85, 0.6)' : 'rgba(241, 245, 249, 1)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  }), [isDark]);
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

  });

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
          const existingMemberKeys = new Set(groupMembers.map(m => m.publicKey));
          setSearchResults(results.filter(r => !existingMemberKeys.has(r.publicKey)));
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
  const [memberToRemove, setMemberToRemove] = useState<{ publicKey: string; username: string } | null>(null);

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
  const { onlineUsers, isOnline, connectionState: presenceConnectionState, typingUsers } = usePresence({
    conversationId,
    userPublicKey,
    enabled: true, // Enable for both DMs and Groups to support typing indicators
  });

  const recipientOnline = !isGroupChat && isOnline(counterPartyPublicKey);

  // Calculate typing status and label
  const typingMemberPk = useMemo(() => {
    // Find the first person typing who isn't us
    return Object.keys(typingUsers).find(pk => typingUsers[pk] && pk !== userPublicKey);
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
    console.log('[ConversationScreen] Presence Debug:', {
      isGroupChat,
      conversationId,
      userPublicKey,
      counterPartyPublicKey,
      onlineUsers,
      recipientOnline,
      presenceConnectionState,
      typingUsers,
    });
  }, [isGroupChat, conversationId, userPublicKey, counterPartyPublicKey, onlineUsers, recipientOnline, presenceConnectionState, typingUsers]);

  // Ephemeral messaging
  const {
    messages: ephemeralMessages,
    sendMessage: sendEphemeralMessage,
    connectionState: ephemeralConnectionState,
    isSending: isSendingEphemeral,
  } = useEphemeralMessages({
    conversationId,
    userPublicKey,
    recipientPublicKey: counterPartyPublicKey,
    enabled: !isGroupChat, // Only for DMs
    onMessageReceived: (message) => {
      console.log('[ConversationScreen] Ephemeral message received:', message.id);
    },
  });

  // --- UI State & Refs ---

  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const scrollToBottomAnim = useRef(new Animated.Value(1)).current;
  const flatListRef = useRef<any>(null);
  const scrollOffsetRef = useRef(0);


  // --- Effects & Callbacks ---

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // No need to scrollToEnd with inverted list - newest messages automatically at bottom


  // --- Render Helpers ---

  const headerProfile = profiles[counterPartyPublicKey];
  const headerDisplayName = useMemo(() => {
    if (title?.trim()) return title.trim();
    if (isGroupChat) return recipientInfo?.AccessGroupKeyName || headerProfile?.Username || "Group";
    // Check recipientInfo.username first for new conversations (when headerProfile doesn't exist yet)
    const recipientUsername = (recipientInfo as { username?: string })?.username;
    if (recipientUsername) return recipientUsername;
    return getProfileDisplayName(headerProfile, counterPartyPublicKey);
  }, [counterPartyPublicKey, headerProfile, isGroupChat, recipientInfo, title]);

  const headerAvatarUri = useMemo(() => {
    if (isGroupChat) {
      return getProfileImageUrl(recipientOwnerKey ?? counterPartyPublicKey, { groupChat: true }) || FALLBACK_PROFILE_IMAGE;
    }
    return getProfileImageUrl(counterPartyPublicKey) || FALLBACK_PROFILE_IMAGE;
  }, [counterPartyPublicKey, isGroupChat, recipientOwnerKey]);

  // Use regular messages directly - ephemeral feature not needed
  // Supabase is only used for broadcast notifications, not message storage
  const displayMessages = messages;

  const renderItem = useCallback(
    ({ item, index }: { item: DecryptedMessageEntryResponse; index: number }) => {
      const previousMessage = messages[index + 1];
      const nextMessage = messages[index - 1];
      const previousTimestamp = previousMessage?.MessageInfo?.TimestampNanos;

      return (
        <MessageBubble
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
    [handleMessageLongPress, handleReply, isDark, isGroupChat, messageIdMap, profiles, bubbleLayoutsRef, messages]
  );

  const keyExtractor = useCallback((item: DecryptedMessageEntryResponse, index: number) => {
    // Use timestamp + index to ensure uniqueness, even for messages with same timestamp
    const timestamp = item.MessageInfo?.TimestampNanosString ?? item.MessageInfo?.TimestampNanos?.toString() ?? '';
    return timestamp ? `${timestamp}-${index}` : `message-${index}-${Date.now()}`;
  }, []);



  const isPaginating = useMemo(() => {
    return isLoading && messages.length > 0 && !isRefreshing;
  }, [isLoading, messages.length, isRefreshing]);


  const topListHeader = useMemo(() => {
    // Only show spinner when there are more messages to load
    if (!hasMore) return null;

    return (
      <View style={{ paddingVertical: 16, alignItems: 'center' }}>
        <ActivityIndicator size="small" color={isDark ? "#94a3b8" : "#64748b"} />
      </View>
    );
  }, [hasMore, isDark]);

  const footer = useMemo(() => {
    if (!error) return null;
    return (
      <View className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
        <Text className="text-sm font-medium text-red-900">{error}</Text>
      </View>
    );
  }, [error]);

  return (
    <DesktopShell>
      <ScreenWrapper
        edges={['top', 'left', 'right', 'bottom']}
        keyboardAvoiding={Platform.OS === "ios"}
        keyboardVerticalOffset={0}
        backgroundColor={isDark ? "#0a0f1a" : "#ffffff"}
        useKeyboardController={true}
      >
      {/* Custom Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0a0f1a]">
        <View className="flex-row items-center flex-1">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
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
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Feather name="chevron-left" size={22} color={isDark ? "#fff" : "#000"} />
              </LiquidGlassView>
            ) : (
              <Feather name="arrow-left" size={24} color={isDark ? "#f8fafc" : "#0f172a"} />
            )}
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
        </View >

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
                    style={{ zIndex: 3 - i }}
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
                      style={{ zIndex: 3 - index }}
                    >
                      <Image source={{ uri }} className="h-full w-full rounded-full" />
                    </View>
                  );
                })
              )
              }
            </View >
          ) : (
            <Image
              source={{ uri: headerAvatarUri }}
              className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-700"
            />
          )}
        </TouchableOpacity >
      </View >

      {/* Main content - limited width on web for better readability */}
      < View style={
        [
          { flex: 1 },
          Platform.OS === 'web' && {
            maxWidth: 600,
            width: '100%',
            alignSelf: 'center',
          }
        ]} >
        <View style={{ flex: 1 }}>
          {isLoading && messages.length === 0 ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color={accentColor} />
            </View>
          ) : (
            <FlatList<DecryptedMessageEntryResponse>
              ref={flatListRef}
              data={displayMessages}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              inverted={true}
              // With inverted list: Footer appears at visual TOP, Header at visual BOTTOM
              ListFooterComponent={topListHeader}
              ListHeaderComponent={footer}
              showsVerticalScrollIndicator={false}
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
              onScroll={(e) => {
                const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
                const rawOffsetY = contentOffset.y;

                // Track current scroll offset
                scrollOffsetRef.current = rawOffsetY;

                // With inverted list: offset 0 = bottom (newest), higher offset = top (older)
                // Show scroll-to-bottom button when user scrolls up (away from newest)
                if (rawOffsetY > SCROLL_TO_BOTTOM_THRESHOLD) {
                  if (!showScrollToBottom) {
                    scrollToBottomAnim.setValue(1);
                    setShowScrollToBottom(true);
                  }
                } else {
                  if (showScrollToBottom) setShowScrollToBottom(false);
                }
              }}
              scrollEventThrottle={16}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              // Performance optimizations - especially important for web
              windowSize={Platform.OS === 'web' ? 21 : 11}
              maxToRenderPerBatch={Platform.OS === 'web' ? 5 : 10}
              initialNumToRender={Platform.OS === 'web' ? 15 : 20}
              removeClippedSubviews={Platform.OS !== 'web'}
              updateCellsBatchingPeriod={Platform.OS === 'web' ? 100 : 50}
              ListEmptyComponent={() => (
                <View className="items-center justify-center px-6 py-10" style={{ minHeight: 400, transform: [{ scaleY: -1 }] }}>
                  {isLoading ? (
                    <View className="items-center">
                      <ActivityIndicator size="large" color={accentColor} />
                      <Text className="mt-4 text-sm font-medium text-gray-500">Loading messages...</Text>
                    </View>
                  ) : (
                    <View className="items-center rounded-2xl border border-gray-200 bg-white px-6 py-10 dark:border-slate-800 dark:bg-slate-900">
                      <Feather name="message-circle" size={38} color={isDark ? "#64748b" : "#9ca3af"} />
                      <Text className="mt-4 text-lg font-semibold text-gray-900 dark:text-slate-200">No messages yet</Text>
                      <Text className="mt-1 text-center text-sm text-gray-500 dark:text-slate-400">Start the conversation and it will appear here instantly.</Text>
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
                  console.log("[ConversationScreen] Scroll-to-latest pressed", {
                    scrollOffset: scrollOffsetRef.current,
                    messageCount: messages.length,
                  });
                  Animated.timing(scrollToBottomAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                  }).start(() => setShowScrollToBottom(false));
                  try {
                    // With inverted list, offset 0 = visual bottom (newest messages)
                    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
                  } catch (err) {
                    console.warn("[ConversationScreen] scrollToOffset failed", err);
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
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Feather name="chevron-down" size={24} color={isDark ? "#fff" : "#1f2937"} />
                  </LiquidGlassView>
                ) : (
                  <BlurView
                    intensity={80}
                    tint={isDark ? "dark" : "light"}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    <Feather name="chevron-down" size={24} color={isDark ? "#fff" : "#4b5563"} />
                  </BlurView>
                )}
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </View >



      {/* Typing indicator - shown above composer when someone is typing */}
      {isTyping && (
        <TypingIndicator label={typingLabel} isDark={isDark} />
      )}

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
        recipientOnline={recipientOnline}
        onSendEphemeral={sendEphemeralMessage}
        isSendingEphemeral={isSendingEphemeral}
      />

      <Modal
        visible={Boolean(selectedMessage)}
        transparent
        statusBarTranslucent
        animationType="none"
        onRequestClose={handleCloseMessageActions}
      >
        <View style={{ flex: 1 }}>
          <Reanimated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFillObject, backdropStyle]}
          >
            {Platform.OS === "ios" || Platform.OS === "android" ? (
              <BlurView intensity={50} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: isDark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.35)" }]} />
            )}
          </Reanimated.View>

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
                    profiles={profiles}
                    isDark={isDark}
                    messageIdMap={messageIdMap}
                    layout={{ width: selectedBubbleLayout.width, height: selectedBubbleLayout.height }}
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
                    onEdit={selectedMessage?.IsSender ? () => startEditingMessage(selectedMessage) : undefined}
                    onCopy={handleActionCopy}
                  />
                </Reanimated.View>
              </>
            );
          })() : null}
        </View>
      </Modal>

      <Modal
        visible={showMembersModal}
        animationType={isWebDesktop ? "fade" : "slide"}
        presentationStyle={isWebDesktop ? "overFullScreen" : "pageSheet"}
        transparent={isWebDesktop}
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
            <>
              {/* Conditional header based on which view is active */}
          {showAddMemberModal ? (
            // Add Member Header
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-800">
              <TouchableOpacity
                onPress={() => setShowAddMemberModal(false)}
                activeOpacity={0.85}
                style={modalIconButtonStyle}
              >
                <Feather name="arrow-left" size={20} color={isDark ? "#94a3b8" : "#64748b"} />
              </TouchableOpacity>
              <Text className="text-xl font-bold text-[#111] dark:text-white">Add Member</Text>
              <View style={{ width: 36 }} />
            </View>
          ) : (
            // Group Members Header
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-800">
              <Text className="text-xl font-bold text-[#111] dark:text-white">Group Members</Text>
              <View className="flex-row items-center">
                {isOwner && (
                  <TouchableOpacity
                    onPress={() => setShowAddMemberModal(true)}
                    activeOpacity={0.8}
                    style={[modalIconButtonStyle, { marginRight: 12 }]}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Feather name="user-plus" size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => setShowMembersModal(false)}
                  activeOpacity={0.8}
                  style={modalIconButtonStyle}
                >
                  <Feather name="x" size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                </TouchableOpacity>
              </View>
            </View>
          )}

              {/* Conditional content based on which view is active */}
              {showAddMemberModal ? (
                // Add Member Content
                <>
                  <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(241, 245, 249, 1)',
                      borderRadius: 14,
                      paddingHorizontal: 16,
                      height: 50,
                      borderWidth: 1,
                      borderColor: isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(203, 213, 225, 0.5)',
                    }}>
                      <Feather name="search" size={18} color={isDark ? "#64748b" : "#94a3b8"} />
                      <TextInput
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Search by username..."
                        placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                        style={{
                          flex: 1,
                          marginLeft: 12,
                          fontSize: 16,
                          color: isDark ? '#ffffff' : '#0f172a',
                          ...(Platform.OS === 'web' && { outlineStyle: 'none' as any }),
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
                      const userImageUrl = getProfileImageUrl(user.publicKey || "");
                      const isAddingThisUser = addingMemberKey === user.publicKey;

                      return (
                        <View style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingHorizontal: 20,
                          paddingVertical: 12,
                          borderBottomWidth: 1,
                          borderBottomColor: isDark ? 'rgba(51, 65, 85, 0.3)' : 'rgba(241, 245, 249, 0.8)',
                        }}>
                          <Image
                            source={{ uri: userImageUrl }}
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: 24,
                              backgroundColor: isDark ? '#334155' : '#e2e8f0',
                            }}
                            resizeMode="cover"
                          />
                          <View style={{ marginLeft: 14, flex: 1 }}>
                            <Text style={{
                              fontSize: 16,
                              fontWeight: '600',
                              color: isDark ? '#ffffff' : '#0f172a',
                            }}>
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
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {isAddingThisUser ? (
                              <ActivityIndicator size="small" color="white" />
                            ) : (
                              <Feather name="plus" size={20} color="#ffffff" />
                            )}
                          </TouchableOpacity>
                        </View>
                      );
                    }}
                    ListEmptyComponent={
                      isSearching ? (
                        <View style={{
                          alignItems: 'center',
                          justifyContent: 'center',
                          paddingVertical: 60,
                        }}>
                          <ActivityIndicator size="large" color={accentColor} />
                        </View>
                      ) : hasSearched && searchResults.length === 0 ? (
                        <View style={{
                          alignItems: 'center',
                          justifyContent: 'center',
                          paddingVertical: 40,
                        }}>
                          <View style={{
                            width: 64,
                            height: 64,
                            borderRadius: 32,
                            backgroundColor: isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(241, 245, 249, 1)',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 16,
                          }}>
                            <Feather name="users" size={28} color={isDark ? "#64748b" : "#94a3b8"} />
                          </View>
                          <Text style={{
                            fontSize: 16,
                            fontWeight: '600',
                            color: isDark ? '#94a3b8' : '#64748b',
                          }}>No users found</Text>
                        </View>
                      ) : (
                        <View style={{
                          alignItems: 'center',
                          justifyContent: 'center',
                          paddingVertical: 40,
                        }}>
                          <View style={{
                            width: 64,
                            height: 64,
                            borderRadius: 32,
                            backgroundColor: accentSoft,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 16,
                          }}>
                            <Feather name="search" size={28} color={accentStrong} />
                          </View>
                          <Text style={{
                            fontSize: 16,
                            fontWeight: '600',
                            color: isDark ? '#e2e8f0' : '#334155',
                          }}>Search for users to add</Text>
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
                    const memberImageUrl = member.profilePic
                      ? `https://node.deso.org/api/v0/get-single-profile-picture/${member.publicKey}?fallback=${member.profilePic}`
                      : getProfileImageUrl(member.publicKey);
                    const isMe = member.publicKey === userPublicKey;
                    const isMemberOwner = member.publicKey === recipientOwnerKey;

                    return (
                      <View className="flex-row items-center px-5 py-3 border-b border-gray-100 dark:border-slate-800">
                        <Image
                          source={{ uri: memberImageUrl }}
                          className="h-12 w-12 rounded-full bg-gray-200 dark:bg-slate-700"
                          resizeMode="cover"
                        />
                        <View className="ml-3 flex-1">
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text className="text-base font-semibold text-[#111] dark:text-white">
                              {member.username || "Anonymous"} {isMe && "(You)"}
                            </Text>
                            {isMemberOwner && (
                              <View style={{
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                                backgroundColor: accentColor,
                                borderRadius: 6,
                              }}>
                                <Text style={{
                                  fontSize: 10,
                                  fontWeight: '700',
                                  color: '#ffffff',
                                  textTransform: 'uppercase',
                                  letterSpacing: 0.5,
                                }}>
                                  Admin
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                        {isOwner && !isMe && (
                          <TouchableOpacity
                            onPress={() => handleRemoveMember(member.publicKey, member.username || "")}
                            className="rounded-full"
                            activeOpacity={0.8}
                            style={{
                              backgroundColor: accentSoft,
                              width: 36,
                              height: 36,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            disabled={isRemovingMember}
                          >
                            <Feather name="trash-2" size={18} color={accentStrong} />
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  }}
                  ListEmptyComponent={
                    !loadingMembers ? (
                      <View className="flex-1 items-center justify-center py-14">
                        <Feather name="users" size={48} color="#9ca3af" />
                        <Text className="mt-4 text-base text-gray-500">No members found</Text>
                      </View>
                    ) : (
                      <View className="flex-1 items-center justify-center py-14">
                        <ActivityIndicator size="large" color={accentColor} />
                      </View>
                    )
                  }
                />
              )}
            </>
          );

          if (isWebDesktop) {
            // Desktop: Show with sidebars visible
            return (
              <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(10, 15, 26, 0.85)' : 'rgba(255, 255, 255, 0.85)' }}>
                <DesktopLeftNav />
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <View style={{
                    flex: 1,
                    width: '100%',
                    maxWidth: CENTER_CONTENT_MAX_WIDTH,
                    backgroundColor: isDark ? '#0a0f1a' : '#ffffff',
                    borderLeftWidth: 1,
                    borderRightWidth: 1,
                    borderColor: isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.25)',
                  }}>
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
            <SafeAreaView className="flex-1 bg-white dark:bg-[#0a0f1a]">
              {membersModalContent}
            </SafeAreaView>
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
                Are you sure you want to remove <Text className="font-semibold text-slate-900 dark:text-white">{memberToRemove?.username || "this user"}</Text> from the group?
              </Text>
            </View>

            <View className="flex-row space-x-3">
              <TouchableOpacity
                onPress={() => setMemberToRemove(null)}
                className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800"
              >
                <Text className="text-slate-900 dark:text-white font-semibold text-center">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={confirmRemoveMember}
                disabled={isRemovingMember}
                className="flex-1 py-3 rounded-xl bg-red-500"
              >
                {isRemovingMember ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="text-white font-semibold text-center">Remove</Text>
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
