import React, {
  useContext,
  useMemo,
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  Text,
  Pressable,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
  DeviceEventEmitter,
  Modal,
  Platform,
  TextInput,
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
  FALLBACK_PROFILE_IMAGE,
  getProfileImageUrl,
} from "@/utils/deso";

import { useConversationThreads } from "@/features/messaging/hooks/useConversationThreads";
import { useThreadSettings } from "@/features/messaging/hooks/useThreadSettings";
import {
  SafeAreaView,
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
import UserGroupIcon from "@/assets/navIcons/user-group.svg";

const devLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
};

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

type ConversationRowProps = {
  item: MockConversation;
  isDesktopWeb: boolean;
  onPress: () => void;
  onLongPress: () => void;
};

function ConversationRow({
  item,
  isDesktopWeb,
  onPress,
  onLongPress,
}: ConversationRowProps) {
  return (
    <View className="w-full bg-white dark:bg-[#0a0f1a]">
      <Pressable
        className="w-full flex-row items-center px-4 py-3 transition-colors duration-150 hover:bg-slate-200 dark:hover:bg-slate-800 active:opacity-80 cursor-pointer"
        onPress={onPress}
        onLongPress={onLongPress}
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
              className={`flex-1 text-[14px] ${
                /* @ts-ignore */
                item.isTyping ? "text-green-500 font-medium" : "text-slate-500 dark:text-slate-400"
                }`}
            >
              {item.preview}
            </Text>
            {/* Typing Indicator Dot (Optional, if we want a visual dot too) */}
            {/* @ts-ignore */}
            {item.isTyping && (
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e', marginLeft: 6 }} />
            )}
          </View>
        </View>
      </Pressable>
    </View>
  );
}

type NewChatResultRowProps = {
  item: UserSearchResult;
  isDark: boolean;
  onPress: () => void;
};

function NewChatResultRow({ item, isDark, onPress }: NewChatResultRowProps) {
  return (
    <Pressable
      className="transition-colors duration-150 hover:bg-slate-200 dark:hover:bg-slate-800 active:opacity-80 cursor-pointer"
      onPress={onPress}
    >
      <View className="flex-row items-center px-5 py-3">
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
      </View>
    </Pressable>
  );
}

// UI-only mock data
type MockConversation = {
  id: string;
  name: string;
  preview: string;
  time: string;
  avatarUri?: string | null;
  isGroup: boolean;
  mailbox: "inbox" | "spam";
  chatType: ChatType;
  threadPublicKey: string;
  threadIdentifier?: string;
  threadAccessGroupKeyName?: string;
  userAccessGroupKeyName?: string;
  partyGroupOwnerPublicKeyBase58Check?: string;
  lastTimestampNanos?: number;
  recipientInfo?: {
    OwnerPublicKeyBase58Check: string;
    AccessGroupKeyName?: string | null;
  } | null;
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

function looksLikePublicKeyTitle(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (v.includes("…") || v.includes("...")) {
    return v.startsWith("BC1") || v.startsWith("tBC1");
  }
  return /^t?BC1[1-9A-HJ-NP-Za-km-z]{20,}$/.test(v);
}

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

  const {
    conversations,
    profiles,
    groupMembers,
    groupExtraData,
    threadMeta,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    reload,
    loadMore,
    error,
    typingStatuses,
    latestMessages,
  } = useConversationThreads();

  const { settings: threadSettings, setThreadMailbox: setThreadMailboxOverride } =
    useThreadSettings();

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

  // Update optimistic previews from global socket "new_message" events
  useEffect(() => {
    Object.entries(latestMessages).forEach(([conversationId, message]) => {
      if (message && message.MessageInfo) {
        setOptimisticPreviews(prev => ({
          ...prev,
          [conversationId]: {
            messageText: message.DecryptedMessage || "",
            timestampNanos: message.MessageInfo.TimestampNanos,
            extraData: message.MessageInfo.ExtraData
          }
        }));
      }
    });
  }, [latestMessages]);

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
      profileMap: PublicKeyToProfileEntryResponseMap,
      groupExtraDataMap: Record<string, Record<string, string> | null> = {}
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
        let avatarUri: string | null = null;

        if (isGroup) {
          const accessGroupKeyName = (last?.RecipientInfo as any)
            ?.AccessGroupKeyName;
          const groupKey =
            accessGroupKeyName && typeof accessGroupKeyName === "string"
              ? `${otherPk}-${accessGroupKeyName}`
              : null;

          const groupExtra = groupKey ? groupExtraDataMap[groupKey] : null;

          // Extract group image from access group ExtraData (GraphQL), then fall back to message/recipient extraData
          const recipientExtraData = (last?.RecipientInfo as any)?.ExtraData as
            | Record<string, any>
            | undefined;
          const messageExtraData2 = last?.MessageInfo?.ExtraData as
            | Record<string, any>
            | undefined;

          const groupImageURL =
            groupExtra?.groupImage ||
            groupExtra?.GroupImageURL ||
            groupExtra?.groupImageURL ||
            groupExtra?.groupImageUrl ||
            groupExtra?.GroupImageUrl ||
            groupExtra?.LargeProfilePicURL ||
            groupExtra?.FeaturedImageURL ||
            recipientExtraData?.groupImage ||
            recipientExtraData?.GroupImageURL ||
            recipientExtraData?.groupImageURL ||
            recipientExtraData?.groupImageUrl ||
            recipientExtraData?.GroupImageUrl ||
            messageExtraData2?.groupImage ||
            messageExtraData2?.GroupImageURL ||
            messageExtraData2?.groupImageURL ||
            messageExtraData2?.groupImageUrl ||
            messageExtraData2?.GroupImageUrl;

          if (groupImageURL && typeof groupImageURL === "string") {
            avatarUri = groupImageURL;
          }
        } else {
          avatarUri = buildProfilePictureUrl(otherPk, {
            fallbackImageUrl: FALLBACK_PROFILE_IMAGE,
          });
        }

        // Extract thread identifier from message ExtraData
        const threadIdentifierRaw = (
          last?.MessageInfo?.ExtraData as Record<string, unknown> | undefined
        )?.threadIdentifier;
        const threadIdentifier =
          typeof threadIdentifierRaw === "string" ? threadIdentifierRaw : "";

        const mailboxOverride = threadIdentifier
          ? threadSettings[threadIdentifier]
          : undefined;
        const metaMailbox = threadIdentifier
          ? threadMeta[threadIdentifier]?.isSpam
          : undefined;
        const mailbox: "inbox" | "spam" =
          mailboxOverride ?? (metaMailbox ? "spam" : "inbox");

        return {
          id: conversationKey,
          name,
          preview,
          time,
          avatarUri,
          isGroup,
          mailbox,
          chatType: c.ChatType,
          threadPublicKey: otherPk,
          threadIdentifier,
          lastTimestampNanos: last?.MessageInfo?.TimestampNanos,
          userAccessGroupKeyName: DEFAULT_KEY_MESSAGING_GROUP_NAME,
          threadAccessGroupKeyName: isGroup
            ? last?.RecipientInfo?.AccessGroupKeyName
            : DEFAULT_KEY_MESSAGING_GROUP_NAME,
          partyGroupOwnerPublicKeyBase58Check: otherPk,
          recipientInfo: (last?.RecipientInfo as MockConversation["recipientInfo"]) ?? null,
        };
      });
    },
    [
      currentUser?.PublicKeyBase58Check,
      threadMeta,
      threadSettings,
    ]
  );

  const allItems = useMemo(
    () => buildItemsFromConversations(conversations, profiles, groupExtraData),
    [buildItemsFromConversations, conversations, profiles, groupExtraData]
  );

  const items = useMemo(() => {
    const visible = allItems
      .map((item) => {
        const optimistic = optimisticPreviews[item.id];
        if (!optimistic) {
          return item;
        }

        if (optimistic.timestampNanos <= (item.lastTimestampNanos ?? 0)) {
          return item;
        }

        const optimisticTimestampMs = optimistic.timestampNanos / 1e6;
        const hasImages = Boolean(optimistic.extraData?.decryptedImageURLs);
        const hasVideos = Boolean(optimistic.extraData?.decryptedVideoURLs);
        let previewText = "";
        if (hasVideos) previewText = "You sent a video";
        else if (hasImages) previewText = "You sent an image";
        if (optimistic.messageText.trim()) {
          previewText = previewText
            ? `${previewText}: ${optimistic.messageText.trim()}`
            : `You: ${optimistic.messageText.trim()}`;
        }

        return {
          ...item,
          preview: previewText || item.preview,
          time: formatTimestamp(optimisticTimestampMs),
          lastTimestampNanos: optimistic.timestampNanos,
        };
      })
      .map((item) => {
        // Add typing status
        // For DMs, the typing status is keyed by the other user's public key
        // For Groups, it's keyed by the conversation ID

        const isTyping = item.chatType === ChatType.DM
          ? typingStatuses[item.threadPublicKey]
          : typingStatuses[item.id];

        if (isTyping) {
          return {
            ...item,
            preview: "Typing...",
            isTyping: true
          };
        }
        return item;
      })
      .filter((item) => item.mailbox === activeMailbox);

    return visible.sort(
      (a, b) => (b.lastTimestampNanos ?? 0) - (a.lastTimestampNanos ?? 0)
    );
  }, [activeMailbox, allItems, optimisticPreviews, typingStatuses]);

  const isRefreshingMailbox = isFetching && !isFetchingNextPage && !isLoading;

  const handlePress = useCallback(
    (item: MockConversation) => {
      devLog(
        "[HomeScreen] handlePress called for item:",
        item.id,
        item.name
      );

      if (!currentUser?.PublicKeyBase58Check) {
        devLog("[HomeScreen] No currentUser, aborting navigation");
        return;
      }

      devLog("[HomeScreen] Navigating to conversation:", {
        threadPublicKey: item.threadPublicKey || item.id,
        chatType: item.chatType,
        name: item.name,
      });

      const threadPk = item.threadPublicKey || item.id;
      const safeTitle =
        item.name?.trim() && !looksLikePublicKeyTitle(item.name)
          ? item.name.trim()
          : undefined;
      const profileKey = item.partyGroupOwnerPublicKeyBase58Check ?? threadPk;

      navigation.navigate("Conversation", {
        threadPublicKey: threadPk,
        chatType: item.chatType,
        userPublicKey: currentUser.PublicKeyBase58Check,
        threadAccessGroupKeyName: item.threadAccessGroupKeyName,
        userAccessGroupKeyName: item.userAccessGroupKeyName,
        partyGroupOwnerPublicKeyBase58Check:
          item.partyGroupOwnerPublicKeyBase58Check,
        lastTimestampNanos: item.lastTimestampNanos,
        title: safeTitle,
        recipientInfo: item.recipientInfo,
        initialGroupMembers:
          item.isGroup &&
            item.recipientInfo?.OwnerPublicKeyBase58Check &&
            item.recipientInfo?.AccessGroupKeyName
            ? groupMembers[
            `${item.recipientInfo.OwnerPublicKeyBase58Check}-${item.recipientInfo.AccessGroupKeyName}`
            ]
            : undefined,
        initialProfile: profiles[profileKey], // Pass profile to avoid loading delay
      });
    },
    [currentUser?.PublicKeyBase58Check, navigation, profiles, groupMembers]
  );

  const handleCompose = useCallback(() => {
    navigation.navigate("Composer");
  }, [navigation]);

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
      const previousMailboxOverride = threadSettings[threadId];

      await setThreadMailboxOverride(threadId, targetMailbox);

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
        void reload();
      } catch (error) {
        console.error("Failed to move conversation:", error);
        await setThreadMailboxOverride(threadId, previousMailboxOverride ?? null);
      } finally {
        setLoadingItems((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
      }
    },
    [
      currentUser?.PublicKeyBase58Check,
      reload,
      setThreadMailboxOverride,
      threadSettings,
    ]
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

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-white px-6 py-10 dark:bg-slate-950">
        <View className="flex-1 items-center justify-center rounded-3xl border border-red-200 bg-red-50 px-5 py-8 dark:border-red-900 dark:bg-red-950/30">
          <Feather name="alert-triangle" size={28} color="#ef4444" />
          <Text className="mt-3 text-base font-semibold text-red-900 dark:text-red-200">
            We couldn't load your chats
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
          {!isLoading && isRefreshingMailbox && (
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
            style={scrollBarStyle}
          >
            <FlashList
              data={items}
              keyExtractor={(item) => item.id}
              extraData={{ activeMailbox, optimisticPreviews, threadSettings }}
              className="flex-1"
              showsVerticalScrollIndicator={Platform.OS === "web"}
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
                  onRefresh={reload}
                  tintColor={isDark ? accentColor : accentColor}
                  colors={[accentColor]}
                />
              }
              onEndReached={() => {
                if (hasNextPage && !isFetchingNextPage) {
                  loadMore();
                }
              }}
              onEndReachedThreshold={0.2}
              ListFooterComponent={
                isFetchingNextPage ? (
                  <View className="py-6 items-center justify-center">
                    <ActivityIndicator size="small" color={accentColor} />
                  </View>
                ) : null
              }
              renderItem={({ item }) => (
                <ConversationRow
                  item={item}
                  isDesktopWeb={isDesktopWeb}
                  onPress={() => handlePress(item)}
                  onLongPress={() => {
                    if (Platform.OS !== "web") {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    }
                    setSelectedItem(item);
                    setShowActionModal(true);
                  }}
                />
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
            reload(); // Reload conversations to show the new group
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
                      <NewChatResultRow
                        item={item}
                        isDark={isDark}
                        onPress={() => handleSelectNewChatProfile(item)}
                      />
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
