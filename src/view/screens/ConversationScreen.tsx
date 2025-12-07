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
} from "react-native";

import Reanimated from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { LiquidGlassView } from "../../utils/liquidGlass";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import {
  ChatType,
  DecryptedMessageEntryResponse,
} from "deso-protocol";
import { DEFAULT_KEY_MESSAGING_GROUP_NAME, SCROLL_TO_BOTTOM_THRESHOLD } from "../../constants/messaging";
import {
  FALLBACK_PROFILE_IMAGE,
  getProfileDisplayName,
  getProfileImageUrl,
} from "../../utils/deso";
import type { RootStackParamList } from "../../navigation/types";

import ScreenWrapper from "../../components/ScreenWrapper";
import { Composer } from "../components/Composer";
import { MessageBubble } from "../components/MessageBubble";
import { ActionSheetCard, SelectedBubblePreview, computeModalPositions } from "../components/ActionSheet";

// Hooks
import { useConversationMessages } from "../../features/messaging/hooks/useConversationMessages";
import { useMessageActions } from "../hooks/useMessageActions";
import { useGroupMembers } from "../hooks/useGroupMembers";
import { usePresence } from "../../features/messaging/hooks/usePresence";
import { useEphemeralMessages } from "../../features/messaging/hooks/useEphemeralMessages";
import { PresenceIndicator } from "../components/PresenceIndicator";

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
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
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
  } = useGroupMembers({
    isGroupChat,
    threadAccessGroupKeyName,
    recipientOwnerKey,
    counterPartyPublicKey,
    initialGroupMembers,
  });

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
    return getProfileDisplayName(headerProfile, counterPartyPublicKey);
  }, [counterPartyPublicKey, headerProfile, isGroupChat, recipientInfo?.AccessGroupKeyName, title]);

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
            <View className="flex-row items-center gap-2">
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                className="text-[17px] font-bold tracking-[-0.3px] text-[#0f172a] dark:text-[#f8fafc]"
              >
                {headerDisplayName || "Conversation"}
              </Text>
              {(!isGroupChat || isTyping) && (
                <PresenceIndicator
                  isOnline={recipientOnline}
                  size="small"
                  isTyping={isTyping}
                  typingLabel={typingLabel}
                  showLabel={isTyping}
                />
              )}
            </View>
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
              <ActivityIndicator size="large" color="#3b82f6" />
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
              ListEmptyComponent={() => (
                <View className="items-center justify-center px-6 py-10" style={{ minHeight: 400, transform: [{ scaleY: -1 }] }}>
                  {isLoading ? (
                    <View className="items-center">
                      <ActivityIndicator size="large" color="#3b82f6" />
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
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowMembersModal(false)}
      >
        <SafeAreaView className="flex-1 bg-white dark:bg-[#0a0f1a]">
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-800">
            <Text className="text-xl font-bold text-[#111] dark:text-white">Group Members</Text>
            <TouchableOpacity onPress={() => setShowMembersModal(false)} className="p-1">
              <Feather name="x" size={24} color={isDark ? "#fff" : "#111"} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={groupMembers}
            keyExtractor={(item) => item.publicKey}
            renderItem={({ item: member }) => {
              const memberImageUrl = member.profilePic
                ? `https://node.deso.org/api/v0/get-single-profile-picture/${member.publicKey}?fallback=${member.profilePic}`
                : getProfileImageUrl(member.publicKey);
              return (
                <View className="flex-row items-center px-5 py-3 border-b border-gray-100 dark:border-slate-800">
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
            }}
            ListEmptyComponent={
              !loadingMembers ? (
                <View className="flex-1 items-center justify-center py-14">
                  <Feather name="users" size={48} color="#9ca3af" />
                  <Text className="mt-4 text-base text-gray-500">No members found</Text>
                </View>
              ) : (
                <View className="flex-1 items-center justify-center py-14">
                  <ActivityIndicator size="large" color="#3b82f6" />
                </View>
              )
            }
          />
        </SafeAreaView>
      </Modal>
    </ScreenWrapper >
  );
}
