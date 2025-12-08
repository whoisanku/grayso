import React, { useContext, useMemo, useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Text,
  TouchableOpacity,
  View,
  Image,
  ActivityIndicator,
  RefreshControl,
  DeviceEventEmitter,
  Modal,
  Platform,
  TextInput,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  MenuProvider,
} from "react-native-popup-menu";
import { ChatType, buildProfilePictureUrl } from "deso-protocol";
import {
  CompositeNavigationProp,
  useNavigation,
  useFocusEffect,
} from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  type HomeTabParamList,
  type RootStackParamList,
} from "../../navigation/types";
import { DeSoIdentityContext } from "react-deso-protocol";
import { DEFAULT_KEY_MESSAGING_GROUP_NAME } from "../../constants/messaging";
import {
  formatPublicKey,
  FALLBACK_GROUP_IMAGE,
  FALLBACK_PROFILE_IMAGE,
  getProfileImageUrl,
} from "../../utils/deso";

import { useConversations } from "../hooks/useConversations";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { OUTGOING_MESSAGE_EVENT, DRAWER_STATE_EVENT } from "../../constants/events";
import { getBorderColor } from "../../theme/borders";
import { LiquidGlassView } from "../../utils/liquidGlass";
import type { ConversationMap } from "../../services/conversations";
import { NewGroupChatModal } from "../components/NewGroupChatModal";
import { searchUsers, UserSearchResult } from "../../services/userSearch";
import { useAccentColor } from "../../state/theme/useAccentColor";
import { DesktopLeftNav } from "../components/desktop/DesktopLeftNav";
import { DesktopRightNav } from "../components/desktop/DesktopRightNav";
import { CENTER_CONTENT_MAX_WIDTH, useLayoutBreakpoints } from "../../alf/breakpoints";
import { ChatMenu } from "../components/ChatMenu";
import { moveSpamInbox } from "../../services/spam";

// Navigation types
type MessagesTabNavigationProp = BottomTabNavigationProp<
  HomeTabParamList,
  "Messages"
>;

type ComposerNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Composer"
>;

type HomeScreenNavigationProp = CompositeNavigationProp<
  MessagesTabNavigationProp,
  ComposerNavigationProp
>;

// UI-only mock data
type MockConversation = {
  id: string;
  name: string;
  preview: string;
  time: string;
  avatarUri?: string | null;
  isGroup: boolean;
  stackedAvatarUris?: string[];
  chatType: ChatType;
  threadPublicKey: string;
  threadAccessGroupKeyName?: string;
  userAccessGroupKeyName?: string;
  partyGroupOwnerPublicKeyBase58Check?: string;
  lastTimestampNanos?: number;
  recipientInfo?: any; // Using any for now to match the data structure
  isLoadingMembers?: boolean;
  hasGroupImage?: boolean;
};

const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;
const formatTimestamp = (timestampMs: number) => {
  if (!timestampMs) return "";
  const date = new Date(timestampMs);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  if (diff < ONE_DAY_IN_MS) {
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

export default function HomeScreen() {
  const { isDark, accentColor, accentStrong, accentSoft } = useAccentColor();
  const insets = useSafeAreaInsets();
  const { currentUser } = useContext(DeSoIdentityContext);
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { conversations, spamConversations, profiles, groupMembers, groupExtraData, isLoading, error, reload } =
    useConversations();

  // Reload conversations when screen gains focus (e.g., returning from a conversation)
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const [showGroupComposerModal, setShowGroupComposerModal] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  // New chat modal state
  const [newChatSearchQuery, setNewChatSearchQuery] = useState("");
  const [newChatResults, setNewChatResults] = useState<UserSearchResult[]>([]);
  const [isSearchingNewChat, setIsSearchingNewChat] = useState(false);
  const [hasSearchedNewChat, setHasSearchedNewChat] = useState(false);
  const [activeMailbox, setActiveMailbox] = useState<"inbox" | "spam">("inbox");
  const [optimisticPreviews, setOptimisticPreviews] = useState<
    Record<
      string,
      {
        messageText: string;
        timestampNanos: number;
      }
    >
  >({});

  // Track optimistic mailbox overrides: ID -> 'inbox' | 'spam'
  const [optimisticOverrides, setOptimisticOverrides] = useState<Record<string, "inbox" | "spam">>({});
  // Track loading state for specific items
  const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set());

  // Helper to open drawer (controlled by HomeTabs)
  const openDrawer = useCallback(() => {
    DeviceEventEmitter.emit(DRAWER_STATE_EVENT, { requestOpen: true });
  }, []);

  const { isDesktop } = useLayoutBreakpoints();
  const isDesktopWeb = Platform.OS === "web" && isDesktop;

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      OUTGOING_MESSAGE_EVENT,
      (
        payload: {
          conversationId: string;
          messageText: string;
          timestampNanos: number;
        }
      ) => {
        setOptimisticPreviews((prev) => ({
          ...prev,
          [payload.conversationId]: {
            messageText: payload.messageText,
            timestampNanos: payload.timestampNanos,
          },
        }));
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);

  // Debounced search for new chat modal
  useEffect(() => {
    if (!newChatSearchQuery.trim()) {
      setNewChatResults([]);
      setHasSearchedNewChat(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearchingNewChat(true);
      try {
        const results = await searchUsers(newChatSearchQuery);
        const filtered = results.filter(
          (p) => p.publicKey !== currentUser?.PublicKeyBase58Check
        );
        setNewChatResults(filtered);
        setHasSearchedNewChat(true);
      } catch (error) {
        console.error("[HomeScreen] new chat search error:", error);
        setNewChatResults([]);
      } finally {
        setIsSearchingNewChat(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [newChatSearchQuery, currentUser?.PublicKeyBase58Check]);



  // Handle selecting a profile for new DM
  const handleSelectNewChatProfile = useCallback((profile: UserSearchResult) => {
    const userPublicKey = currentUser?.PublicKeyBase58Check;
    if (!userPublicKey) return;

    setShowNewChatModal(false);
    setNewChatSearchQuery("");
    setNewChatResults([]);
    setHasSearchedNewChat(false);

    rootNavigation.navigate("Conversation", {
      threadPublicKey: profile.publicKey,
      chatType: "DM" as ChatType,
      userPublicKey,
      userAccessGroupKeyName: DEFAULT_KEY_MESSAGING_GROUP_NAME,
      recipientInfo: {
        username: profile.username,
        publicKey: profile.publicKey,
      },
    });
  }, [currentUser?.PublicKeyBase58Check, rootNavigation]);

  const buildItemsFromConversations = useCallback(
    (source: ConversationMap) => {
      const userPk = currentUser?.PublicKeyBase58Check;
      if (!userPk) return [];

      return Object.values(source).map((c) => {
        const last =
          c.messages.find((msg) => {
            const extraData = msg.MessageInfo?.ExtraData as
              | Record<string, any>
              | undefined;
            return extraData?.edited !== "true";
          }) || c.messages[0];

        const info = last?.MessageInfo || {};
        const time = formatTimestamp(
          info.TimestampNanos ? info.TimestampNanos / 1e6 : 0
        );
        const senderPk = last?.SenderInfo?.OwnerPublicKeyBase58Check || "";
        const recipientPk = last?.RecipientInfo?.OwnerPublicKeyBase58Check || "";
        const senderName =
          senderPk === userPk
            ? "You"
            : profiles?.[senderPk]?.Username || formatPublicKey(senderPk);
        const isGroup = c.ChatType === ChatType.GROUPCHAT;
        const otherPk = isGroup
          ? recipientPk
          : senderPk === userPk
            ? recipientPk
            : senderPk;
        const name = isGroup
          ? last?.RecipientInfo?.AccessGroupKeyName || "Group"
          : profiles?.[otherPk]?.Username || formatPublicKey(otherPk);
        const preview = `${senderName}: ${last?.DecryptedMessage || "..."}`;

        // For group chats, check if there's a custom group image in extraData
        let avatarUri: string;
        if (isGroup) {
          const groupKey = `${otherPk}-${last?.RecipientInfo?.AccessGroupKeyName}`;
          const extraData = groupExtraData?.[groupKey];
          avatarUri = extraData?.groupImage || FALLBACK_GROUP_IMAGE;
        } else {
          avatarUri = buildProfilePictureUrl(otherPk, {
            fallbackImageUrl: FALLBACK_PROFILE_IMAGE,
          });
        }

        let stackedAvatarUris: string[] = [];
        let isLoadingMembers = false;
        let hasGroupImage = false;

        if (isGroup) {
          const groupKey = `${last?.RecipientInfo?.OwnerPublicKeyBase58Check}-${last?.RecipientInfo?.AccessGroupKeyName}`;
          const extraData = groupExtraData?.[groupKey];

          // If there's a custom group image, use it instead of stacked avatars
          if (extraData?.groupImage) {
            hasGroupImage = true;
          } else {
            // Only fetch/show stacked avatars if there's no custom group image
            const members = groupMembers[groupKey] || [];

            if (members.length === 0) {
              isLoadingMembers = true;
            }

            stackedAvatarUris = members
              .slice(0, 3)
              .map((m) =>
                m.profilePic
                  ? `https://node.deso.org/api/v0/get-single-profile-picture/${m.publicKey}?fallback=${m.profilePic}`
                  : getProfileImageUrl(m.publicKey) || FALLBACK_PROFILE_IMAGE
              );
          }
        }

        let uniqueId: string;
        if (isGroup) {
          uniqueId = `${otherPk}-${last?.RecipientInfo?.AccessGroupKeyName || DEFAULT_KEY_MESSAGING_GROUP_NAME}`;
        } else {
          const sortedKeys = [userPk, otherPk].sort();
          uniqueId = `${sortedKeys[0]}-${sortedKeys[1]}-DM`;
        }

        return {
          id: uniqueId,
          name,
          preview,
          time,
          avatarUri,
          stackedAvatarUris,
          isGroup,
          chatType: c.ChatType,
          threadPublicKey: otherPk,
          lastTimestampNanos: last?.MessageInfo?.TimestampNanos,
          userAccessGroupKeyName: DEFAULT_KEY_MESSAGING_GROUP_NAME,
          threadAccessGroupKeyName: isGroup
            ? last?.RecipientInfo?.AccessGroupKeyName
            : DEFAULT_KEY_MESSAGING_GROUP_NAME,
          partyGroupOwnerPublicKeyBase58Check: otherPk,
          recipientInfo: last?.RecipientInfo,
          isLoadingMembers,
          hasGroupImage,
        };
      });
    },
    [currentUser?.PublicKeyBase58Check, profiles, groupMembers, groupExtraData]
  );

  const inboxItems = useMemo(
    () => buildItemsFromConversations(conversations),
    [buildItemsFromConversations, conversations]
  );
  const spamItems = useMemo(
    () => buildItemsFromConversations(spamConversations),
    [buildItemsFromConversations, spamConversations]
  );
  const items = useMemo(
    () => (activeMailbox === "spam" ? spamItems : inboxItems),
    [activeMailbox, inboxItems, spamItems]
  );

  const enhancedItems = useMemo(() => {
    // Combine all items to handle moves between lists
    // Use a Map to deduplicate by ID in case an item appears in both lists (shouldn't happen but good safety)
    const allItemsMap = new Map<string, MockConversation>();
    inboxItems.forEach(item => allItemsMap.set(item.id, item));
    spamItems.forEach(item => allItemsMap.set(item.id, item));

    const allItems = Array.from(allItemsMap.values());

    const mapped = allItems
      .map((item) => {
        // Use the item's unique ID for optimistic preview lookup
        const optimistic = optimisticPreviews[item.id];

        if (optimistic) {
          const optimisticTimestampMs = optimistic.timestampNanos / 1e6;
          const existingTimestamp = item.lastTimestampNanos ?? 0;

          if (optimistic.timestampNanos > existingTimestamp) {
            return {
              ...item,
              preview: `You: ${optimistic.messageText.trim() === "🚀"
                ? "🚀"
                : optimistic.messageText
                }`,
              time: formatTimestamp(optimisticTimestampMs),
              lastTimestampNanos: optimistic.timestampNanos,
            };
          }
        }

        return item;
      })
      // Filter based on active mailbox and optimistic overrides
      .filter((item) => {
        // Determine the effective mailbox for this item
        // 1. Check optimistic override first
        const override = optimisticOverrides[item.id];
        if (override) {
          return override === activeMailbox;
        }

        // 2. Fallback to original location
        // Check if it was originally in the current active list
        // We need to know if the item *originally* belonged to inbox or spam
        // Since we combined them, we can check if it exists in the original source arrays
        const isOriginallyInInbox = inboxItems.some(i => i.id === item.id);
        const isOriginallyInSpam = spamItems.some(i => i.id === item.id);

        if (activeMailbox === "inbox") {
          return isOriginallyInInbox;
        } else {
          return isOriginallyInSpam;
        }
      });

    // Sort by most recent message first
    return mapped.sort((a, b) => {
      const aTime = a.lastTimestampNanos ?? 0;
      const bTime = b.lastTimestampNanos ?? 0;
      return bTime - aTime;
    });
  }, [activeMailbox, inboxItems, spamItems, optimisticPreviews, optimisticOverrides]);


  const handlePress = useCallback(
    (item: MockConversation) => {
      if (!currentUser?.PublicKeyBase58Check) {
        return;
      }

      navigation.navigate("Conversation", {
        threadPublicKey: item.threadPublicKey || item.id,
        chatType: item.chatType,
        userPublicKey: currentUser.PublicKeyBase58Check,
        threadAccessGroupKeyName: item.threadAccessGroupKeyName,
        userAccessGroupKeyName: item.userAccessGroupKeyName,
        partyGroupOwnerPublicKeyBase58Check:
          item.partyGroupOwnerPublicKeyBase58Check,
        lastTimestampNanos: item.lastTimestampNanos,
        title: item.name,
        recipientInfo: item.recipientInfo,
        initialGroupMembers:
          item.isGroup && item.recipientInfo
            ? groupMembers[
            `${item.recipientInfo.OwnerPublicKeyBase58Check}-${item.recipientInfo.AccessGroupKeyName}`
            ]
            : undefined,
      });
    },
    [currentUser?.PublicKeyBase58Check, navigation]
  );

  const handleCompose = useCallback(() => {
    navigation.navigate("Composer");
  }, [navigation]);

  const handleMoveSpam = useCallback(
    async (item: MockConversation, moveToSpam: boolean) => {
      if (!currentUser?.PublicKeyBase58Check) return;

      const targetMailbox = moveToSpam ? "spam" : "inbox";

      // Optimistically update UI immediately
      setOptimisticOverrides((prev) => ({
        ...prev,
        [item.id]: targetMailbox,
      }));

      setLoadingItems((prev) => {
        const next = new Set(prev);
        next.add(item.id);
        return next;
      });

      try {
        await moveSpamInbox(
          currentUser.PublicKeyBase58Check,
          item.threadPublicKey,
          moveToSpam
        );
        // Success - reload to get fresh data from server
        await reload();

        // Clear optimistic state after reload
        setOptimisticOverrides((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
      } catch (error) {
        console.error("Failed to move conversation:", error);
        // Revert optimistic update on error
        setOptimisticOverrides((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
      } finally {
        setLoadingItems((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
      }
    },
    [currentUser?.PublicKeyBase58Check, reload]
  );



  if (isLoading && items.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-[#0a0f1a]">
        <View className="flex-row items-center justify-between px-4 pt-4 pb-3">
          <View className="flex-row items-center">
            {!isDesktopWeb && (
              <TouchableOpacity
                onPress={openDrawer}
                activeOpacity={0.7}
                className="mr-3"
              >
                <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                  <Feather name="menu" size={20} color={isDark ? "#f8fafc" : "#0f172a"} />
                </View>
              </TouchableOpacity>
            )}
            <Text className="text-[32px] font-extrabold text-slate-900 dark:text-white">
              Chats
            </Text>
          </View>

          {/* Header Right Icons */}
          <View className="flex-row items-center">
            {/* New Group Chat Button */}
            <TouchableOpacity
              onPress={() => setShowGroupComposerModal(true)}
              activeOpacity={0.7}
              className="mr-1"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <Feather name="users" size={20} color={isDark ? "#f8fafc" : "#0f172a"} />
              </View>
            </TouchableOpacity>

            {/* New Chat Button */}
            <TouchableOpacity
              onPress={() => setShowNewChatModal(true)}
              activeOpacity={0.7}
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <Feather name="plus" size={20} color={isDark ? "#f8fafc" : "#0f172a"} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* WhatsApp-style filter chips */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 12, gap: 8, alignItems: 'center' }}>
          {([
            { key: "inbox", label: "Inbox" },
            { key: "spam", label: "Spam" },
          ] as const).map((filter) => {
            const isActive = activeMailbox === filter.key;

            return (
              <TouchableOpacity
                key={filter.key}
                onPress={() => setActiveMailbox(filter.key)}
                activeOpacity={0.8}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderRadius: 16,
                  backgroundColor: isActive
                    ? accentColor
                    : (isDark ? 'rgba(30, 41, 59, 0.6)' : 'rgba(241, 245, 249, 0.9)'),
                  borderWidth: 1,
                  borderColor: isActive
                    ? accentStrong
                    : getBorderColor(isDark, 'subtle'),
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '500',
                    color: isActive
                      ? '#ffffff'
                      : (isDark ? '#94a3b8' : '#64748b'),
                  }}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={accentColor} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-white px-6 py-10 dark:bg-slate-950">
        <View className="flex-1 items-center justify-center rounded-3xl border border-red-200 bg-red-50 px-5 py-8 dark:border-red-900 dark:bg-red-950/30">
          <Feather name="alert-triangle" size={28} color="#ef4444" />
          <Text className="mt-3 text-base font-semibold text-red-900 dark:text-red-200">
            We couldn't load your inbox
          </Text>
          <Text className="mt-2 text-center text-sm text-red-700">
            {error}
          </Text>
          <TouchableOpacity
            className="mt-6 rounded-full bg-red-500 px-6 py-2"
            activeOpacity={0.8}
            onPress={() => reload()}
          >
            <Text className="text-sm font-semibold text-white">Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const mainContent = (
    <MenuProvider>
      <SafeAreaView className="flex-1 bg-white dark:bg-[#0a0f1a]">
        <View
          style={{
            width: "100%",
            flex: 1,
            paddingHorizontal: 0,
          }}
        >
          {/* Header */}
          <View
            className="flex-row items-center justify-between pt-4 pb-3 px-4"
          >
            <View className="flex-row items-center">
              {/* Hamburger Menu Button - hidden on desktop */}
              {!isDesktopWeb && (
                <TouchableOpacity
                  onPress={openDrawer}
                  activeOpacity={0.7}
                  className="mr-3"
                >
                  {LiquidGlassView ? (
                    <LiquidGlassView
                      effect="regular"
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Feather name="menu" size={20} color={isDark ? "#f8fafc" : "#0f172a"} />
                    </LiquidGlassView>
                  ) : (
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                      <Feather name="menu" size={20} color={isDark ? "#f8fafc" : "#0f172a"} />
                    </View>
                  )}
                </TouchableOpacity>
              )}
              <Text className="text-[32px] font-extrabold text-slate-900 dark:text-white">
                Chats
              </Text>
            </View>

            {/* Header Right Icons */}
            <View className="flex-row items-center">
              {/* New Group Chat Button */}
              <TouchableOpacity
                onPress={() => setShowGroupComposerModal(true)}
                activeOpacity={0.7}
                className="mr-1"
              >
                {LiquidGlassView ? (
                  <LiquidGlassView
                    effect="regular"
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Feather name="users" size={20} color={isDark ? "#f8fafc" : "#0f172a"} />
                  </LiquidGlassView>
                ) : (
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                    <Feather name="users" size={20} color={isDark ? "#f8fafc" : "#0f172a"} />
                  </View>
                )}
              </TouchableOpacity>

              {/* New Chat Button - opens new chat modal */}
              <TouchableOpacity
                onPress={() => setShowNewChatModal(true)}
                activeOpacity={0.7}
              >
                {LiquidGlassView ? (
                  <LiquidGlassView
                    effect="regular"
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Feather name="plus" size={20} color={isDark ? "#f8fafc" : "#0f172a"} />
                  </LiquidGlassView>
                ) : (
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                    <Feather name="plus" size={20} color={isDark ? "#f8fafc" : "#0f172a"} />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* WhatsApp-style filter chips */}
          <View
            style={{
              flexDirection: 'row',
              paddingHorizontal: 16,
              paddingBottom: 12,
              gap: 8,
              alignItems: 'center',
            }}
          >
            {([
              { key: "inbox", label: "Inbox" },
              { key: "spam", label: "Spam" },
            ] as const).map((filter) => {
              const isActive = activeMailbox === filter.key;

              return (
                <TouchableOpacity
                  key={filter.key}
                  onPress={() => setActiveMailbox(filter.key)}
                  activeOpacity={0.8}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                    borderRadius: 16,
                    backgroundColor: isActive
                      ? accentColor
                      : (isDark ? 'rgba(30, 41, 59, 0.6)' : 'rgba(241, 245, 249, 0.9)'),
                    borderWidth: 1,
                    borderColor: isActive
                      ? accentStrong
                      : getBorderColor(isDark, 'subtle'),
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '500',
                      color: isActive
                        ? '#ffffff'
                        : (isDark ? '#94a3b8' : '#64748b'),
                    }}
                  >
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View className="flex-1">
            <FlatList
              data={enhancedItems}
              keyExtractor={(item) => item.id}
              className="flex-1"
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => null}
              contentContainerClassName={
                items.length === 0
                  ? "flex-grow items-center justify-center px-4 pb-20"
                  : "px-0 pb-4"
              }
              contentContainerStyle={isDesktopWeb ? { paddingHorizontal: 0 } : undefined}
              refreshControl={
                <RefreshControl
                  refreshing={isLoading}
                  onRefresh={reload}
                  tintColor={accentColor}
                  colors={[accentColor]}
                />
              }
              renderItem={({ item }) => (
                <View className="flex-row items-center bg-white px-4 py-3 dark:bg-[#0a0f1a]">
                  <TouchableOpacity
                    className="flex-1 flex-row items-center"
                    activeOpacity={0.7}
                    onPress={() => handlePress(item)}
                    style={isDesktopWeb ? { borderRadius: 14 } : undefined}
                  >
                    <View className="mr-3">
                      {item.isGroup && item.hasGroupImage ? (
                        <Image
                          source={{ uri: item.avatarUri }}
                          className="h-14 w-14 rounded-full bg-gray-200 dark:bg-slate-700"
                        />
                      ) : item.isGroup && item.stackedAvatarUris && item.stackedAvatarUris.length > 0 ? (
                        <View className="h-14 w-14 relative">
                          {item.stackedAvatarUris.map((uri, index) => (
                            <Image
                              key={index}
                              source={{ uri }}
                              className="absolute h-10 w-10 rounded-full border-2 border-white bg-gray-200 dark:border-slate-800 dark:bg-slate-700"
                              style={{
                                top: index === 0 ? 0 : index === 1 ? 14 : 4,
                                left: index === 0 ? 0 : index === 1 ? 14 : 24,
                                zIndex: 3 - index,
                              }}
                            />
                          ))}
                        </View>
                      ) : item.isGroup && item.isLoadingMembers ? (
                        <View className="h-14 w-14 relative">
                          {[0, 1, 2].map((i) => (
                            <View
                              key={`placeholder-${i}`}
                              className="absolute h-10 w-10 rounded-full border-2 border-white bg-gray-200 dark:border-slate-800 dark:bg-slate-700"
                              style={{
                                top: i === 0 ? 0 : i === 1 ? 14 : 4,
                                left: i === 0 ? 0 : i === 1 ? 14 : 24,
                                zIndex: 3 - i,
                              }}
                            />
                          ))}
                        </View>
                      ) : item.avatarUri ? (
                        <Image
                          source={{ uri: item.avatarUri }}
                          className="h-14 w-14 rounded-full bg-gray-200 dark:bg-slate-700"
                        />
                      ) : (
                        <View
                          className="h-14 w-14 items-center justify-center rounded-full"
                          style={{ backgroundColor: accentSoft }}
                        >
                          <Text
                            className="text-xl font-bold"
                            style={{ color: accentStrong }}
                          >
                            {item.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View className="flex-1 min-w-0">
                      <View className="flex-row items-center justify-between mb-1">
                        <Text
                          numberOfLines={1}
                          ellipsizeMode="tail"
                          className="flex-1 mr-2 text-[15px] font-bold text-[#0f172a] dark:text-white"
                        >
                          {item.name}
                        </Text>
                        {item.time ? (
                          <Text className="text-[13px] text-slate-500 flex-shrink-0 dark:text-slate-400">
                            {item.time}
                          </Text>
                        ) : null}
                      </View>
                      <View className="flex-row items-center">
                        {item.isGroup ? (
                          <View
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 11,
                              backgroundColor: accentSoft,
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginRight: 8,
                            }}
                          >
                            <Feather name="users" size={12} color={accentStrong} />
                          </View>
                        ) : null}
                        <Text
                          numberOfLines={1}
                          className="flex-1 text-[14px] text-slate-500 dark:text-slate-400"
                        >
                          {item.preview}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Three dots menu */}
                  <ChatMenu
                    isDark={isDark}
                    accentColor={accentColor}
                    activeMailbox={activeMailbox}
                    isLoading={loadingItems.has(item.id)}
                    onMoveToSpam={() => handleMoveSpam(item, true)}
                    onMoveToInbox={() => handleMoveSpam(item, false)}
                  />
                </View>
              )}
              ListEmptyComponent={() => (
                <View className="items-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 dark:border-slate-700 dark:bg-slate-900">
                  <Feather name="inbox" size={40} color={isDark ? "#64748b" : "#9ca3af"} />
                  <Text className="mt-4 text-lg font-semibold text-gray-900 dark:text-slate-200">
                    {activeMailbox === "spam" ? "No spam here" : "Your inbox is quiet"}
                  </Text>
                  <Text className="mt-2 text-center text-sm text-gray-500 dark:text-slate-400">
                    {activeMailbox === "spam"
                      ? "Messages marked as spam will land here. Move them back to Inbox if they’re safe."
                      : "Start a new conversation and it will show up here right away."}
                  </Text>
                  {activeMailbox === "spam" ? (
                    <TouchableOpacity
                      className="mt-6 rounded-full bg-slate-200 px-6 py-3 dark:bg-slate-800"
                      activeOpacity={0.85}
                      onPress={() => setActiveMailbox("inbox")}
                    >
                      <Text className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        Go to Inbox
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      className="mt-6 rounded-full px-6 py-3"
                      activeOpacity={0.85}
                      onPress={handleCompose}
                      style={{
                        backgroundColor: accentColor,
                        shadowColor: accentColor,
                        shadowOpacity: isDark ? 0.15 : 0.25,
                        shadowRadius: 12,
                        shadowOffset: { width: 0, height: 6 },
                        elevation: 4,
                      }}
                    >
                      <Text className="text-sm font-bold text-white">
                        Start a message
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            />
          </View>
        </View>

        {/* Group Composer Modal */}
        <NewGroupChatModal
          visible={showGroupComposerModal}
          onClose={() => setShowGroupComposerModal(false)}
          onGroupCreated={() => {
            setShowGroupComposerModal(false);
            reload(); // Reload conversations to show the new group
          }}
          onNavigateToGroup={(groupName, ownerPublicKey, initialMessage) => {
            setShowGroupComposerModal(false);
            rootNavigation.navigate("Conversation", {
              threadPublicKey: ownerPublicKey,
              chatType: "GROUPCHAT" as any,
              userPublicKey: currentUser?.PublicKeyBase58Check || '',
              threadAccessGroupKeyName: groupName,
              userAccessGroupKeyName: DEFAULT_KEY_MESSAGING_GROUP_NAME,
              partyGroupOwnerPublicKeyBase58Check: ownerPublicKey,
              title: groupName,
              initialMessage: initialMessage, // Pass the initial message
            });
          }}
        />

        {/* New Chat Modal */}
        <Modal
          visible={showNewChatModal}
          animationType={isDesktopWeb ? "fade" : "slide"}
          presentationStyle={isDesktopWeb ? "overFullScreen" : "pageSheet"}
          transparent={isDesktopWeb}
          onRequestClose={() => setShowNewChatModal(false)}
        >
          {(() => {
            const closeButtonStyle = {
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: isDark ? 'rgba(51, 65, 85, 0.6)' : 'rgba(241, 245, 249, 1)',
              alignItems: 'center',
              justifyContent: 'center',
            } as const;

            const modalContent = (
              <>
                {/* Header */}
                <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-800">
                  <Text className="text-xl font-bold text-[#111] dark:text-white">New Message</Text>
                  <TouchableOpacity
                    onPress={() => setShowNewChatModal(false)}
                    activeOpacity={0.8}
                    style={closeButtonStyle}
                  >
                    <Feather name="x" size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                  </TouchableOpacity>
                </View>

                {/* Search Input */}
                <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(241, 245, 249, 1)',
                    borderRadius: 14,
                    paddingHorizontal: 16,
                    height: 50,
                    borderWidth: 1,
                    borderColor: getBorderColor(isDark, 'subtle'),
                  }}>
                    <Feather name="search" size={18} color={isDark ? "#64748b" : "#94a3b8"} />
                    <TextInput
                      style={{
                        flex: 1,
                        marginLeft: 12,
                        fontSize: 16,
                        color: isDark ? '#ffffff' : '#0f172a',
                        ...(Platform.OS === 'web' && { outlineStyle: 'none' as any }),
                      }}
                      placeholder="Search username..."
                      placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                      value={newChatSearchQuery}
                      onChangeText={setNewChatSearchQuery}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoFocus={Platform.OS !== "web"}
                    />
                  </View>
                </View>

                {/* Search Results */}
                {isSearchingNewChat ? (
                  <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color={accentColor} />
                  </View>
                ) : hasSearchedNewChat && newChatResults.length === 0 ? (
                  <View className="flex-1 items-center justify-center px-8">
                    <Feather name="user-x" size={48} color={isDark ? "#334155" : "#cbd5e1"} />
                    <Text className="mt-4 text-center text-base text-slate-500 dark:text-slate-400">
                      No users found
                    </Text>
                  </View>
                ) : !hasSearchedNewChat ? (
                  <View className="flex-1 items-center justify-center px-8">
                    <View style={{
                      width: 64,
                      height: 64,
                      borderRadius: 32,
                      backgroundColor: accentSoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Feather name="search" size={28} color={accentStrong} />
                    </View>
                    <Text className="mt-4 text-center text-base font-medium text-slate-900 dark:text-white">
                      Find someone to chat with
                    </Text>
                    <Text className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400">
                      Search by username to start a conversation
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={newChatResults}
                    keyExtractor={(item) => item.publicKey}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingHorizontal: 20,
                          paddingVertical: 12,
                        }}
                        onPress={() => handleSelectNewChatProfile(item)}
                        activeOpacity={0.7}
                      >
                        <Image
                          source={{
                            uri: getProfileImageUrl(item.publicKey) || FALLBACK_PROFILE_IMAGE
                          }}
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 24,
                            backgroundColor: isDark ? '#334155' : '#e2e8f0',
                          }}
                        />
                        <View style={{ marginLeft: 14, flex: 1 }}>
                          <Text style={{
                            fontSize: 16,
                            fontWeight: '600',
                            color: isDark ? '#ffffff' : '#0f172a',
                          }} numberOfLines={1}>
                            {item.username || "Anonymous"}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  />
                )}
              </>
            );

            if (isDesktopWeb) {
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
                      borderColor: getBorderColor(isDark, 'contrast_low'),
                    }}>
                      <SafeAreaView style={{ flex: 1 }}>
                        {modalContent}
                      </SafeAreaView>
                    </View>
                  </View>
                  <DesktopRightNav />
                </View>
              );
            }

            return (
              <SafeAreaView className="flex-1 bg-white dark:bg-[#0a0f1a]">
                {modalContent}
              </SafeAreaView>
            );
          })()}
        </Modal>

      </SafeAreaView>
    </MenuProvider>
  );
  return mainContent;
}
