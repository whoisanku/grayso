import React, {
  useContext,
  useMemo,
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
  DeviceEventEmitter,
  Modal,
  Platform,
  TextInput,
  ScrollView,
} from "react-native";
import { UserAvatar } from "@/components/UserAvatar";
import { FlashList } from "@shopify/flash-list";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { MenuProvider } from "react-native-popup-menu";
import {
  ChatType,
  buildProfilePictureUrl,
  PublicKeyToProfileEntryResponseMap,
} from "deso-protocol";
import {
  CompositeNavigationProp,
  useNavigation,
} from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  type HomeTabParamList,
  type RootStackParamList,
} from "@/navigation/types";
import { DeSoIdentityContext } from "react-deso-protocol";
import { DEFAULT_KEY_MESSAGING_GROUP_NAME } from "@/constants/messaging";
import {
  formatPublicKey,
  FALLBACK_GROUP_IMAGE,
  FALLBACK_PROFILE_IMAGE,
  getProfileImageUrl,
} from "@/utils/deso";

import { useConversations } from "@/features/messaging/hooks/useConversations";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { OUTGOING_MESSAGE_EVENT, DRAWER_STATE_EVENT } from "@/constants/events";
import { getBorderColor } from "@/theme/borders";
import { LiquidGlassView } from "../../../utils/liquidGlass";
import type { ConversationMap } from "@/features/messaging/api/conversations";
import { NewGroupChatModal } from "../components/NewGroupChatModal";
import { searchUsers, UserSearchResult } from "../../../lib/userSearch";
import { useAccentColor } from "@/state/theme/useAccentColor";
import { DesktopLeftNav } from "../components/desktop/DesktopLeftNav";
import { DesktopRightNav } from "../components/desktop/DesktopRightNav";
import {
  CENTER_CONTENT_MAX_WIDTH,
  useLayoutBreakpoints,
} from "@/alf/breakpoints";
import { ChatActionModal } from "../components/ChatActionModal";
import { moveSpamInbox } from "@/features/messaging/api/spam";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import {
  getConversationsQueryKey,
  fetchConversations,
} from "@/state/queries/messages/list";
import type { GroupMember } from "@/services/desoGraphql";
import UserGroupIcon from "@/assets/navIcons/user-group.svg";
import UserGroupIconFilled from "@/assets/navIcons/user-group-filled.svg";

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

const DEFAULT_AVATAR_BLURHASH = "L5H2EC=PM+yV0g-mq.wG9c010J}I";

// UI-only mock data
type MockConversation = {
  id: string;
  name: string;
  preview: string;
  time: string;
  avatarUri?: string | null;
  isGroup: boolean;
  chatType: ChatType;
  threadPublicKey: string;
  threadIdentifier?: string;
  threadAccessGroupKeyName?: string;
  userAccessGroupKeyName?: string;
  partyGroupOwnerPublicKeyBase58Check?: string;
  lastTimestampNanos?: number;
  recipientInfo?: any; // Using any for now to match the data structure
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

// Helper function to generate preview text for media messages
const getMediaPreviewText = (
  extraData: Record<string, any> | undefined,
  senderName: string
): string | null => {
  if (!extraData) return null;

  const isYou = senderName === "You";
  const prefix = isYou ? "you" : senderName.toLowerCase();

  // Check for video
  if (extraData.encryptedVideoURLs || extraData["video.0.clientId"]) {
    return `${prefix} sent a video`;
  }

  // Check for image
  if (extraData.encryptedImageURLs || extraData["image.0.clientId"]) {
    return `${prefix} sent an image`;
  }

  return null;
};

export function HomeScreen() {
  const { isDark, accentColor, accentStrong, accentSoft } = useAccentColor();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { currentUser } = useContext(DeSoIdentityContext);
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const rootNavigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

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
        extraData?: Record<string, any>;
      }
    >
  >({});

  // Track optimistic mailbox overrides: ID -> 'inbox' | 'spam'
  const [optimisticOverrides, setOptimisticOverrides] = useState<
    Record<string, "inbox" | "spam">
  >({});
  // Track loading state for specific items
  const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set());

  // Long-press modal state
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MockConversation | null>(
    null
  );

  // Helper to open drawer (controlled by HomeTabs)
  const openDrawer = useCallback(() => {
    DeviceEventEmitter.emit(DRAWER_STATE_EVENT, { requestOpen: true });
  }, []);

  const { isDesktop } = useLayoutBreakpoints();
  const isDesktopWeb = Platform.OS === "web" && isDesktop;

  const {
    conversations,
    profiles,
    groupMembers,
    groupExtraData,
    isLoading: isLoadingInbox,
    isFetching: isFetchingInbox,
    isFetchingNextPage: isFetchingNextInbox,
    hasNextPage: hasMoreInbox,
    reload: reloadInbox,
    loadMore: loadMoreInbox,
    error: errorInbox,
  } = useConversations("inbox");

  const {
    conversations: spamConversations,
    profiles: spamProfiles,
    isLoading: isLoadingSpam,
    isFetching: isFetchingSpam,
    isFetchingNextPage: isFetchingNextSpam,
    hasNextPage: hasMoreSpam,
    reload: reloadSpam,
    loadMore: loadMoreSpam,
    error: errorSpam,
  } = useConversations("spam", { enabled: activeMailbox === "spam" });

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      OUTGOING_MESSAGE_EVENT,
      (payload: {
        conversationId: string;
        messageText: string;
        timestampNanos: number;
        extraData?: Record<string, any>;
      }) => {
        setOptimisticPreviews((prev) => ({
          ...prev,
          [payload.conversationId]: {
            messageText: payload.messageText,
            timestampNanos: payload.timestampNanos,
            extraData: payload.extraData,
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
  const handleSelectNewChatProfile = useCallback(
    (profile: UserSearchResult) => {
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
    },
    [currentUser?.PublicKeyBase58Check, rootNavigation]
  );

  const buildItemsFromConversations = useCallback(
    (
      source: ConversationMap,
      profileMap: PublicKeyToProfileEntryResponseMap
    ) => {
      const userPk = currentUser?.PublicKeyBase58Check;
      if (!userPk) return [];

      return Object.entries(source).map(([conversationKey, c]) => {
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
        const recipientPk =
          last?.RecipientInfo?.OwnerPublicKeyBase58Check || "";
        const senderName =
          senderPk === userPk
            ? "You"
            : profileMap?.[senderPk]?.Username || formatPublicKey(senderPk);
        const isGroup = c.ChatType === ChatType.GROUPCHAT;
        const otherPk = isGroup
          ? recipientPk
          : senderPk === userPk
          ? recipientPk
          : senderPk;
        const name = isGroup
          ? last?.RecipientInfo?.AccessGroupKeyName || "Group"
          : profileMap?.[otherPk]?.Username || formatPublicKey(otherPk);

        // Check for media in extraData
        const messageExtraData = last?.MessageInfo?.ExtraData as
          | Record<string, any>
          | undefined;
        const mediaPreview = getMediaPreviewText(messageExtraData, senderName);

        // Generate preview text
        const preview = mediaPreview
          ? mediaPreview
          : `${senderName}: ${last?.DecryptedMessage || "..."}`;

        // For group chats, check if there's a custom group image in RecipientInfo ExtraData
        let avatarUri: string;
        let hasGroupImage = false;

        if (isGroup) {
          // Extract group image from message ExtraData or RecipientInfo
          const recipientExtraData = (last?.RecipientInfo as any)?.ExtraData as
            | Record<string, any>
            | undefined;
          const messageExtraData2 = last?.MessageInfo?.ExtraData as
            | Record<string, any>
            | undefined;
          const groupImageURL =
            recipientExtraData?.GroupImageURL ||
            messageExtraData2?.GroupImageURL;

          // If there's a custom group image, use it
          if (groupImageURL && typeof groupImageURL === "string") {
            avatarUri = groupImageURL;
            hasGroupImage = true;
          } else {
            // No group image, will show placeholder icon instead
            avatarUri = FALLBACK_GROUP_IMAGE;
          }
        } else {
          avatarUri = buildProfilePictureUrl(otherPk, {
            fallbackImageUrl: FALLBACK_PROFILE_IMAGE,
          });
        }

        // Extract thread identifier from message ExtraData
        const threadIdentifier =
          (last?.MessageInfo?.ExtraData as Record<string, any> | undefined)
            ?.threadIdentifier || "";

        return {
          id: conversationKey,
          name,
          preview,
          time,
          avatarUri,
          isGroup,
          chatType: c.ChatType,
          threadPublicKey: otherPk,
          threadIdentifier,
          lastTimestampNanos: last?.MessageInfo?.TimestampNanos,
          userAccessGroupKeyName: DEFAULT_KEY_MESSAGING_GROUP_NAME,
          threadAccessGroupKeyName: isGroup
            ? last?.RecipientInfo?.AccessGroupKeyName
            : DEFAULT_KEY_MESSAGING_GROUP_NAME,
          partyGroupOwnerPublicKeyBase58Check: otherPk,
          recipientInfo: last?.RecipientInfo,
          hasGroupImage,
        };
      });
    },
    [currentUser?.PublicKeyBase58Check, profiles, groupMembers]
  );

  const inboxItems = useMemo(
    () => buildItemsFromConversations(conversations, profiles),
    [buildItemsFromConversations, conversations, profiles]
  );
  const spamItems = useMemo(
    () => buildItemsFromConversations(spamConversations, spamProfiles ?? {}),
    [buildItemsFromConversations, spamConversations, spamProfiles]
  );
  const enhancedItems = useMemo(() => {
    const baseItems = activeMailbox === "spam" ? spamItems : inboxItems;
    const otherItems = activeMailbox === "spam" ? inboxItems : spamItems;

    const visible: MockConversation[] = [];

    // 1) Start with items belonging to the active mailbox
    baseItems.forEach((item) => {
      const optimisticMailbox = optimisticOverrides[item.id];
      if (optimisticMailbox && optimisticMailbox !== activeMailbox) {
        // Optimistically moved out; skip showing here
        return;
      }

      let updatedItem = { ...item };
      const optimistic = optimisticPreviews[item.id];
      if (
        optimistic &&
        optimistic.timestampNanos > (item.lastTimestampNanos ?? 0)
      ) {
        const optimisticTimestampMs = optimistic.timestampNanos / 1e6;
        const hasImages = optimistic.extraData?.decryptedImageURLs;
        const hasVideos = optimistic.extraData?.decryptedVideoURLs;
        let previewText = "";
        if (hasVideos) previewText = "You sent a video";
        else if (hasImages) previewText = "You sent an image";
        if (optimistic.messageText.trim()) {
          previewText = previewText
            ? `${previewText}: ${optimistic.messageText.trim()}`
            : `You: ${
                optimistic.messageText.trim() === "🚀"
                  ? "🚀"
                  : optimistic.messageText
              }`;
        }
        updatedItem = {
          ...updatedItem,
          preview: previewText || updatedItem.preview,
          time: formatTimestamp(optimisticTimestampMs),
          lastTimestampNanos: optimistic.timestampNanos,
        };
      }
      visible.push(updatedItem);
    });

    // 2) Add items from the other mailbox that were optimistically moved into this one
    otherItems.forEach((item) => {
      const optimisticMailbox = optimisticOverrides[item.id];
      if (optimisticMailbox === activeMailbox) {
        visible.push({ ...item });
      }
    });

    return visible.sort(
      (a, b) => (b.lastTimestampNanos ?? 0) - (a.lastTimestampNanos ?? 0)
    );
  }, [
    activeMailbox,
    inboxItems,
    spamItems,
    optimisticPreviews,
    optimisticOverrides,
  ]);

  const isLoadingMailbox =
    activeMailbox === "spam" ? isLoadingSpam : isLoadingInbox;
  const isFetchingMailbox =
    activeMailbox === "spam" ? isFetchingSpam : isFetchingInbox;
  const isFetchingNextMailbox =
    activeMailbox === "spam" ? isFetchingNextSpam : isFetchingNextInbox;
  const isRefreshingMailbox = isFetchingMailbox && !isFetchingNextMailbox;
  const hasMoreMailbox = activeMailbox === "spam" ? hasMoreSpam : hasMoreInbox;
  const loadMoreMailbox =
    activeMailbox === "spam" ? loadMoreSpam : loadMoreInbox;
  const reloadMailbox = activeMailbox === "spam" ? reloadSpam : reloadInbox;
  const errorMailbox = activeMailbox === "spam" ? errorSpam : errorInbox;

  const handlePress = useCallback(
    (item: MockConversation) => {
      console.log(
        "[HomeScreen] handlePress called for item:",
        item.id,
        item.name
      );

      if (!currentUser?.PublicKeyBase58Check) {
        console.log("[HomeScreen] No currentUser, aborting navigation");
        return;
      }

      console.log("[HomeScreen] Navigating to conversation:", {
        threadPublicKey: item.threadPublicKey || item.id,
        chatType: item.chatType,
        name: item.name,
      });

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
        initialProfile: profiles[item.threadPublicKey], // Pass profile to avoid loading delay
      });
    },
    [currentUser?.PublicKeyBase58Check, navigation, profiles, groupMembers]
  );

  const handleCompose = useCallback(() => {
    navigation.navigate("Composer");
  }, [navigation]);

  const moveConversationInCache = useCallback(
    (
      conversationId: string,
      fromMailbox: "inbox" | "spam",
      toMailbox: "inbox" | "spam"
    ) => {
      if (!currentUser?.PublicKeyBase58Check) return;

      type ConversationsPage = Awaited<ReturnType<typeof fetchConversations>>;
      const fromKey = getConversationsQueryKey(
        currentUser.PublicKeyBase58Check,
        fromMailbox
      );
      const toKey = getConversationsQueryKey(
        currentUser.PublicKeyBase58Check,
        toMailbox
      );

      const fromData =
        queryClient.getQueryData<InfiniteData<ConversationsPage>>(fromKey);
      if (!fromData) return;

      let movedConversation: ConversationMap[string] | undefined;
      let movedProfiles: PublicKeyToProfileEntryResponseMap = {};
      let movedGroupMembers: Record<string, GroupMember[]> = {};
      let movedGroupExtraData: Record<string, Record<string, string> | null> =
        {};

      const updatedFromPages = fromData.pages.map((page) => {
        if (page.conversations[conversationId]) {
          movedConversation = page.conversations[conversationId];
          movedProfiles = { ...movedProfiles, ...page.profiles };
          movedGroupMembers = { ...movedGroupMembers, ...page.groupMembers };
          movedGroupExtraData = {
            ...movedGroupExtraData,
            ...page.groupExtraData,
          };
          const nextPage = {
            ...page,
            conversations: { ...page.conversations },
          } as ConversationsPage;
          delete nextPage.conversations[conversationId];
          return nextPage;
        }
        return page;
      });

      if (movedConversation) {
        queryClient.setQueryData<InfiniteData<ConversationsPage>>(fromKey, {
          ...fromData,
          pages: updatedFromPages,
        });

        const toData =
          queryClient.getQueryData<InfiniteData<ConversationsPage>>(toKey);
        if (toData) {
          const updatedToPages = toData.pages.length
            ? toData.pages.map((page, index) => {
                if (index === 0) {
                  return {
                    ...page,
                    conversations: {
                      ...page.conversations,
                      [conversationId]: movedConversation!,
                    },
                    profiles: {
                      ...page.profiles,
                      ...movedProfiles,
                    },
                    groupMembers: {
                      ...page.groupMembers,
                      ...movedGroupMembers,
                    },
                    groupExtraData: {
                      ...page.groupExtraData,
                      ...movedGroupExtraData,
                    },
                  } as ConversationsPage;
                }
                return page;
              })
            : [
                {
                  conversations: { [conversationId]: movedConversation },
                  profiles: movedProfiles,
                  groupMembers: movedGroupMembers,
                  groupExtraData: movedGroupExtraData,
                  hasMore: false,
                  nextOffset: null,
                } as ConversationsPage,
              ];

          queryClient.setQueryData<InfiniteData<ConversationsPage>>(toKey, {
            ...toData,
            pages: updatedToPages,
          });
        } else {
          // If target cache missing, seed it
          queryClient.setQueryData<InfiniteData<ConversationsPage>>(toKey, {
            pageParams: [0],
            pages: [
              {
                conversations: { [conversationId]: movedConversation },
                profiles: movedProfiles,
                groupMembers: movedGroupMembers,
                groupExtraData: movedGroupExtraData,
                hasMore: false,
                nextOffset: null,
              } as ConversationsPage,
            ],
          });
        }
      }
    },
    [currentUser?.PublicKeyBase58Check, queryClient]
  );

  const handleMoveSpam = useCallback(
    async (item: MockConversation, moveToSpam: boolean) => {
      if (!currentUser?.PublicKeyBase58Check) return;
      const threadId = item.threadIdentifier;
      if (!threadId) {
        console.error(
          "Cannot move spam/inbox without threadIdentifier",
          item.id
        );
        return;
      }

      const targetMailbox = moveToSpam ? "spam" : "inbox";
      const sourceMailbox = moveToSpam ? "inbox" : "spam";

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
          threadId,
          moveToSpam
        );

        // Update caches locally to avoid global refresh
        moveConversationInCache(item.id, sourceMailbox, targetMailbox);

        // Clear optimistic override since cache now reflects truth
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
    [currentUser?.PublicKeyBase58Check, moveConversationInCache]
  );

  const items = enhancedItems; // for empty state usage

  if (isLoadingMailbox && items.length === 0) {
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
                  <Feather
                    name="menu"
                    size={20}
                    color={isDark ? "#f8fafc" : "#0f172a"}
                  />
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
                <UserGroupIcon
                  width={20}
                  height={20}
                  stroke={isDark ? "#f8fafc" : "#0f172a"}
                  strokeWidth={2}
                />
              </View>
            </TouchableOpacity>

            {/* New Chat Button */}
            <TouchableOpacity
              onPress={() => setShowNewChatModal(true)}
              activeOpacity={0.7}
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <Feather
                  name="plus"
                  size={20}
                  color={isDark ? "#f8fafc" : "#0f172a"}
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* WhatsApp-style filter chips */}
        <View
          style={{
            flexDirection: "row",
            paddingHorizontal: 16,
            paddingBottom: 12,
            gap: 8,
            alignItems: "center",
          }}
        >
          {(
            [
              { key: "inbox", label: "Inbox" },
              { key: "spam", label: "Spam" },
            ] as const
          ).map((filter) => {
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
                    : isDark
                    ? "rgba(30, 41, 59, 0.6)"
                    : "rgba(241, 245, 249, 0.9)",
                  borderWidth: 1,
                  borderColor: isActive
                    ? accentStrong
                    : getBorderColor(isDark, "subtle"),
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "500",
                    color: isActive
                      ? "#ffffff"
                      : isDark
                      ? "#94a3b8"
                      : "#64748b",
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

  if (errorMailbox) {
    return (
      <SafeAreaView className="flex-1 bg-white px-6 py-10 dark:bg-slate-950">
        <View className="flex-1 items-center justify-center rounded-3xl border border-red-200 bg-red-50 px-5 py-8 dark:border-red-900 dark:bg-red-950/30">
          <Feather name="alert-triangle" size={28} color="#ef4444" />
          <Text className="mt-3 text-base font-semibold text-red-900 dark:text-red-200">
            We couldn't load your inbox
          </Text>
          <Text className="mt-2 text-center text-sm text-red-700">
            {errorMailbox}
          </Text>
          <TouchableOpacity
            className="mt-6 rounded-full bg-red-500 px-6 py-2"
            activeOpacity={0.8}
            onPress={() => reloadMailbox()}
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
          {!isLoadingMailbox && isRefreshingMailbox && (
            <View
              style={{
                width: "100%",
                backgroundColor: isDark
                  ? "rgba(51, 65, 85, 0.55)"
                  : "rgba(226, 232, 240, 0.98)",
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}
            >
              <View className="flex-row items-center justify-center">
                <ActivityIndicator size="small" color={accentColor} />
                <Text
                  style={{
                    marginLeft: 12,
                    fontSize: 14,
                    color: isDark ? "#e2e8f0" : "#0f172a",
                    fontWeight: "700",
                  }}
                >
                  Refreshing…
                </Text>
              </View>
            </View>
          )}

          {/* Header */}
          <View
            // @ts-ignore - data attribute for CSS scroll lock
            dataSet={{ scrollLock: "true" }}
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
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Feather
                        name="menu"
                        size={20}
                        color={isDark ? "#f8fafc" : "#0f172a"}
                      />
                    </LiquidGlassView>
                  ) : (
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                      <Feather
                        name="menu"
                        size={20}
                        color={isDark ? "#f8fafc" : "#0f172a"}
                      />
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
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <UserGroupIcon
                      width={20}
                      height={20}
                      stroke={isDark ? "#f8fafc" : "#0f172a"}
                      strokeWidth={2}
                    />
                  </LiquidGlassView>
                ) : (
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                    <UserGroupIcon
                      width={20}
                      height={20}
                      stroke={isDark ? "#f8fafc" : "#0f172a"}
                      strokeWidth={2}
                    />
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
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Feather
                      name="plus"
                      size={20}
                      color={isDark ? "#f8fafc" : "#0f172a"}
                    />
                  </LiquidGlassView>
                ) : (
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                    <Feather
                      name="plus"
                      size={20}
                      color={isDark ? "#f8fafc" : "#0f172a"}
                    />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* WhatsApp-style filter chips */}
          <View
            // @ts-ignore - data attribute for CSS scroll lock
            dataSet={{ scrollLock: "true" }}
            style={{
              flexDirection: "row",
              paddingHorizontal: 16,
              paddingBottom: 12,
              gap: 8,
              alignItems: "center",
            }}
          >
            {(
              [
                { key: "inbox", label: "Inbox" },
                { key: "spam", label: "Spam" },
              ] as const
            ).map((filter) => {
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
                      : isDark
                      ? "rgba(30, 41, 59, 0.6)"
                      : "rgba(241, 245, 249, 0.9)",
                    borderWidth: 1,
                    borderColor: isActive
                      ? accentStrong
                      : getBorderColor(isDark, "subtle"),
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "500",
                      color: isActive
                        ? "#ffffff"
                        : isDark
                        ? "#94a3b8"
                        : "#64748b",
                    }}
                  >
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View
            // @ts-ignore - data attribute for CSS virtualized list
            dataSet={{ virtualizedList: "true" }}
            className="flex-1"
          >
            <FlashList
              data={enhancedItems}
              keyExtractor={(item) => item.id}
              extraData={optimisticOverrides} // Force re-render when items move between mailboxes
              className="flex-1"
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => null}
              contentContainerClassName={
                items.length === 0
                  ? "flex-grow items-center justify-center px-4"
                  : "px-0"
              }
              contentContainerStyle={
                isDesktopWeb
                  ? { paddingHorizontal: 0 }
                  : items.length === 0
                  ? { paddingBottom: 80 }
                  : { paddingBottom: 70 }
              }
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshingMailbox}
                  onRefresh={reloadMailbox}
                  tintColor={isDark ? accentColor : accentColor}
                  colors={[accentColor]}
                />
              }
              onEndReached={() => {
                if (hasMoreMailbox && !isFetchingNextMailbox) {
                  loadMoreMailbox();
                }
              }}
              onEndReachedThreshold={0.2}
              ListFooterComponent={
                isFetchingNextMailbox ? (
                  <View className="py-6 items-center justify-center">
                    <ActivityIndicator size="small" color={accentColor} />
                  </View>
                ) : null
              }
              renderItem={({ item }) => (
                <View className="flex-row items-center bg-white px-4 py-3 dark:bg-[#0a0f1a]">
                  <TouchableOpacity
                    className="flex-1 flex-row items-center"
                    activeOpacity={0.7}
                    onPress={() => handlePress(item)}
                    onLongPress={() => {
                      if (Platform.OS !== "web") {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      }
                      setSelectedItem(item);
                      setShowActionModal(true);
                    }}
                    style={isDesktopWeb ? { borderRadius: 14 } : undefined}
                  >
                    <View className="mr-3">
                      <UserAvatar
                        uri={item.avatarUri}
                        name={item.name}
                        size={56} // 14 * 4 = 56px
                        isGroup={item.isGroup}
                        recyclingKey={item.id}
                      />
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
                        <Text
                          numberOfLines={1}
                          className="flex-1 text-[14px] text-slate-500 dark:text-slate-400"
                        >
                          {item.preview}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={() => (
                <View className="flex-1 items-center justify-center px-6 py-20">
                  <Feather
                    name="inbox"
                    size={48}
                    color={isDark ? "#64748b" : "#94a3af"}
                  />
                  <Text className="mt-6 text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {activeMailbox === "spam"
                      ? "No spam here"
                      : "Your inbox is quiet"}
                  </Text>
                  <Text className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
                    {activeMailbox === "spam"
                      ? "Messages marked as spam will land here."
                      : "Start a new conversation and it will show up here right away."}
                  </Text>
                  {activeMailbox === "spam" ? (
                    <TouchableOpacity
                      className="mt-8 rounded-full bg-slate-100 dark:bg-slate-800 px-6 py-3"
                      activeOpacity={0.85}
                      onPress={() => setActiveMailbox("inbox")}
                    >
                      <Text className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        Go to Inbox
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      className="mt-8 rounded-full bg-slate-100 dark:bg-slate-800 px-6 py-3"
                      activeOpacity={0.85}
                      onPress={handleCompose}
                    >
                      <Text className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        Start a new chat
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
            reloadMailbox(); // Reload conversations to show the new group
          }}
          onNavigateToGroup={(groupName, ownerPublicKey, initialMessage) => {
            setShowGroupComposerModal(false);
            rootNavigation.navigate("Conversation", {
              threadPublicKey: ownerPublicKey,
              chatType: "GROUPCHAT" as any,
              userPublicKey: currentUser?.PublicKeyBase58Check || "",
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
              backgroundColor: isDark
                ? "rgba(51, 65, 85, 0.6)"
                : "rgba(241, 245, 249, 1)",
              alignItems: "center",
              justifyContent: "center",
            } as const;

            const modalContent = (
              <>
                {/* Header */}
                <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-800">
                  <Text className="text-xl font-bold text-[#111] dark:text-white">
                    New Message
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowNewChatModal(false)}
                    activeOpacity={0.8}
                    style={closeButtonStyle}
                  >
                    <Feather
                      name="x"
                      size={20}
                      color={isDark ? "#94a3b8" : "#64748b"}
                    />
                  </TouchableOpacity>
                </View>

                {/* Search Input */}
                <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
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
                      borderColor: getBorderColor(isDark, "subtle"),
                    }}
                  >
                    <Feather
                      name="search"
                      size={18}
                      color={isDark ? "#64748b" : "#94a3b8"}
                    />
                    <TextInput
                      style={{
                        flex: 1,
                        marginLeft: 12,
                        fontSize: 16,
                        color: isDark ? "#ffffff" : "#0f172a",
                        ...(Platform.OS === "web" && {
                          outlineStyle: "none" as any,
                        }),
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
                    <Feather
                      name="user-x"
                      size={48}
                      color={isDark ? "#334155" : "#cbd5e1"}
                    />
                    <Text className="mt-4 text-center text-base text-slate-500 dark:text-slate-400">
                      No users found
                    </Text>
                  </View>
                ) : !hasSearchedNewChat ? (
                  <View className="flex-1 items-center justify-center px-8">
                    <View
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 32,
                        backgroundColor: accentSoft,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
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
                  <FlashList
                    data={newChatResults}
                    keyExtractor={(item) => item.publicKey}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          paddingHorizontal: 20,
                          paddingVertical: 12,
                        }}
                        onPress={() => handleSelectNewChatProfile(item)}
                        activeOpacity={0.7}
                      >
                        <UserAvatar
                          uri={getProfileImageUrl(item.publicKey)}
                          name={item.username || "?"}
                          size={48}
                          className="bg-slate-200 dark:bg-slate-700"
                        />
                        <View style={{ marginLeft: 14, flex: 1 }}>
                          <Text
                            style={{
                              fontSize: 16,
                              fontWeight: "600",
                              color: isDark ? "#ffffff" : "#0f172a",
                            }}
                            numberOfLines={1}
                          >
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
                        borderColor: getBorderColor(isDark, "contrast_low"),
                      }}
                    >
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

        {/* Chat Action Modal */}
        <ChatActionModal
          visible={showActionModal}
          onClose={() => {
            setShowActionModal(false);
            setSelectedItem(null);
          }}
          onAction={() => {
            if (selectedItem) {
              handleMoveSpam(selectedItem, activeMailbox === "inbox");
            }
          }}
          actionType={activeMailbox === "inbox" ? "spam" : "inbox"}
          isDark={isDark}
          accentColor={accentColor}
          isLoading={selectedItem ? loadingItems.has(selectedItem.id) : false}
          chatName={selectedItem?.name || ""}
          chatAvatar={selectedItem?.avatarUri || undefined}
        />
      </SafeAreaView>
    </MenuProvider>
  );
  return mainContent;
}
