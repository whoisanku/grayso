import React, { useContext, useMemo, useCallback, useEffect, useState, useRef } from "react";
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
  Dimensions,
  Pressable,
  Platform,
  TextInput,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
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
import { searchProfiles, ProfileSearchResult } from "../../services/desoGraphql";
import { useConversations } from "../hooks/useConversations";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { OUTGOING_MESSAGE_EVENT } from "../../constants/events";
import { useColorScheme } from "nativewind";
import { LiquidGlassView } from "../../utils/liquidGlass";
import Animated, { FadeIn, FadeOut, SlideInLeft, SlideOutLeft } from "react-native-reanimated";
import { BlurView } from "expo-blur";
import type { ConversationMap } from "../../services/conversations";

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
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const { currentUser } = useContext(DeSoIdentityContext);
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { conversations, spamConversations, profiles, groupMembers, isLoading, error, reload } =
    useConversations();
  
  // Reload conversations when screen gains focus (e.g., returning from a conversation)
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showGroupComposerModal, setShowGroupComposerModal] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [groupSearchQuery, setGroupSearchQuery] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupImageUri, setGroupImageUri] = useState<string | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<{publicKey: string; username: string; profilePic?: string | null}[]>([]);
  
  // New chat modal state
  const [newChatSearchQuery, setNewChatSearchQuery] = useState("");
  const [newChatResults, setNewChatResults] = useState<ProfileSearchResult[]>([]);
  const [isSearchingNewChat, setIsSearchingNewChat] = useState(false);
  const [hasSearchedNewChat, setHasSearchedNewChat] = useState(false);
  const drawerRef = useRef<View | null>(null);
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

  useEffect(() => {
    if (Platform.OS !== "web" || !isDrawerOpen) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      const node = drawerRef.current as unknown as HTMLElement | null;

      if (node && event.target instanceof Node && !node.contains(event.target)) {
        setIsDrawerOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);

    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [isDrawerOpen]);

  // Debounced search for new chat modal
  useEffect(() => {
    if (!newChatSearchQuery.trim()) {
      setNewChatResults([]);
      setHasSearchedNewChat(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearchingNewChat(true);
      setHasSearchedNewChat(true);
      try {
        const profiles = await searchProfiles({ query: newChatSearchQuery, limit: 10 });
        const filtered = profiles.filter(
          (p) => p.publicKey !== currentUser?.PublicKeyBase58Check
        );
        setNewChatResults(filtered);
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
  const handleSelectNewChatProfile = useCallback((profile: ProfileSearchResult) => {
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
        const avatarUri = isGroup
          ? FALLBACK_GROUP_IMAGE
          : buildProfilePictureUrl(otherPk, {
            fallbackImageUrl: FALLBACK_PROFILE_IMAGE,
          });

        let stackedAvatarUris: string[] = [];
        let isLoadingMembers = false;
        if (isGroup) {
          const groupKey = `${last?.RecipientInfo?.OwnerPublicKeyBase58Check}-${last?.RecipientInfo?.AccessGroupKeyName}`;
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
        };
      });
    },
    [currentUser?.PublicKeyBase58Check, profiles, groupMembers]
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
    const mapped = items.map((item) => {
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
    });
    
    // Sort by most recent message first
    return mapped.sort((a, b) => {
      const aTime = a.lastTimestampNanos ?? 0;
      const bTime = b.lastTimestampNanos ?? 0;
      return bTime - aTime;
    });
  }, [activeMailbox, items, optimisticPreviews]);


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

  if (isLoading && items.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-[#0a0f1a]">
        <View className="flex-row items-center justify-between px-4 pt-4 pb-3">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => setIsDrawerOpen(true)}
              activeOpacity={0.7}
              className="mr-3"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <Feather name="menu" size={20} color={isDark ? "#f8fafc" : "#0f172a"} />
              </View>
            </TouchableOpacity>
            <Text className="text-[32px] font-extrabold text-slate-900 dark:text-white">
              Chats
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => rootNavigation.navigate("NewChat")}
            activeOpacity={0.7}
          >
            <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
<Feather name="edit-2" size={20} color={isDark ? "#f8fafc" : "#0f172a"} />
            </View>
          </TouchableOpacity>
        </View>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#0085ff" />
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

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-[#0a0f1a]">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-4 pb-3">
        <View className="flex-row items-center">
          {/* Hamburger Menu Button */}
          <TouchableOpacity
            onPress={() => setIsDrawerOpen(true)}
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
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: isActive 
                  ? '#0085ff'
                  : (isDark ? 'rgba(30, 41, 59, 0.6)' : 'rgba(241, 245, 249, 0.9)'),
                borderWidth: 1,
                borderColor: isActive 
                  ? '#0085ff' 
                  : (isDark ? 'rgba(71, 85, 105, 0.4)' : 'rgba(203, 213, 225, 0.6)'),
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
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

      {/* Drawer Modal */}
      <Modal
        visible={isDrawerOpen}
        transparent
        animationType="none"
        onRequestClose={() => setIsDrawerOpen(false)}
      >
        <View className="flex-1 flex-row">
          {/* Backdrop */}
          <Animated.View
            entering={FadeIn.duration(150)}
            exiting={FadeOut.duration(100)}
            className="absolute inset-0"
          >
            <Pressable
              className="flex-1"
              onPress={() => setIsDrawerOpen(false)}
            >
              <BlurView
                intensity={40}
                tint={isDark ? "dark" : "light"}
                className="flex-1"
                pointerEvents="none"
              />
            </Pressable>
          </Animated.View>

          {/* Drawer Content */}
          <Animated.View
            entering={SlideInLeft.duration(280)}
            exiting={SlideOutLeft.duration(280)}
            style={{ 
              width: Dimensions.get('window').width * 0.65,
              paddingTop: insets.top,
              backgroundColor: isDark ? '#0a0f1a' : '#ffffff',
            }}
            ref={drawerRef as any}
          >
            {/* User Profile Header */}
            <View className="px-5 py-6 border-b border-slate-100 dark:border-slate-800">
              <View className="flex-row items-center">
                <Image
                  source={{ 
                    uri: currentUser?.ProfileEntryResponse?.ExtraData?.ProfilePic 
                      ? `https://node.deso.org/api/v0/get-single-profile-picture/${currentUser.PublicKeyBase58Check}?fallback=${encodeURIComponent(currentUser.ProfileEntryResponse.ExtraData.ProfilePic)}`
                      : buildProfilePictureUrl(currentUser?.PublicKeyBase58Check || '', { fallbackImageUrl: FALLBACK_PROFILE_IMAGE })
                  }}
                  className="h-14 w-14 rounded-full bg-slate-200 dark:bg-slate-700"
                />
                <View className="ml-3 flex-1">
                  <Text className="text-lg font-bold text-slate-900 dark:text-white" numberOfLines={1}>
                    @{currentUser?.ProfileEntryResponse?.Username || 'User'}
                  </Text>
                  <Text className="text-sm text-slate-500 dark:text-slate-400" numberOfLines={1}>
                    {currentUser?.PublicKeyBase58Check?.slice(0, 12)}...
                  </Text>
                </View>
              </View>
            </View>

            {/* Menu Items */}
            <View className="flex-1 py-4">
              <TouchableOpacity
                className="flex-row items-center px-5 py-4"
                activeOpacity={0.7}
                onPress={() => {
                  setIsDrawerOpen(false);
                  rootNavigation.navigate("Settings");
                }}
              >
                <View className="w-11 h-11 rounded-xl items-center justify-center bg-slate-100 dark:bg-slate-800">
                  <Feather name="settings" size={22} color={isDark ? "#94a3b8" : "#64748b"} />
                </View>
                <Text className="ml-4 text-base font-medium text-slate-900 dark:text-white">
                  Settings
                </Text>
                <View className="flex-1" />
                <Feather name="chevron-right" size={20} color={isDark ? "#64748b" : "#94a3b8"} />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

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
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={reload}
              tintColor="#0085ff"
              colors={["#0085ff"]}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              className="flex-row items-center bg-white px-4 py-3 dark:bg-[#0a0f1a]"
              activeOpacity={0.7}
              onPress={() => handlePress(item)}
            >
              <View className="mr-3">
                {item.isGroup && item.stackedAvatarUris && item.stackedAvatarUris.length > 0 ? (
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
                  <View className="h-14 w-14 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/50">
                    <Text className="text-xl font-bold text-indigo-600 dark:text-indigo-300">
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
                    <View className="mr-2 rounded-full bg-blue-50 px-2 py-0.5 dark:bg-blue-900/30">
                      <Text className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-300">
                        Group
                      </Text>
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
          )}
          ListEmptyComponent={() => (
            <View className="items-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 dark:border-slate-700 dark:bg-slate-900">
              <Feather name="inbox" size={40} color={colorScheme === "dark" ? "#64748b" : "#9ca3af"} />
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
                  className="mt-6 rounded-full bg-[#0085ff] px-6 py-3 shadow-lg shadow-blue-200 dark:shadow-none"
                  activeOpacity={0.85}
                  onPress={handleCompose}
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

      {/* Group Composer Modal */}
      <Modal
        visible={showGroupComposerModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowGroupComposerModal(false)}
      >
        <SafeAreaView className="flex-1 bg-white dark:bg-[#0a0f1a]">
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-800">
            <Text className="text-xl font-bold text-[#111] dark:text-white">New Group Chat</Text>
            <TouchableOpacity onPress={() => setShowGroupComposerModal(false)} className="p-1">
              <Feather name="x" size={24} color={isDark ? "#fff" : "#111"} />
            </TouchableOpacity>
          </View>

          {/* Group Image & Name Section */}
          <View className="px-5 py-4 flex-row items-center border-b border-gray-100 dark:border-slate-800">
            {/* Group Image Upload Placeholder */}
            <TouchableOpacity
              onPress={() => {
                // TODO: Image picker
                console.log("Pick group image");
              }}
              activeOpacity={0.7}
              className="mr-4"
            >
              {groupImageUri ? (
                <Image
                  source={{ uri: groupImageUri }}
                  className="h-16 w-16 rounded-full bg-slate-200 dark:bg-slate-700"
                />
              ) : (
                <View className="h-16 w-16 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center">
                  <Feather name="camera" size={24} color={isDark ? "#64748b" : "#94a3b8"} />
                </View>
              )}
            </TouchableOpacity>
            
            {/* Group Name Input */}
            <View className="flex-1">
              <TextInput
                className="text-lg font-semibold text-slate-900 dark:text-white"
                placeholder="Group name"
                placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                value={groupName}
                onChangeText={setGroupName}
                autoCapitalize="words"
                autoCorrect={false}
                style={{ paddingVertical: 8 }}
              />
              <Text className="text-xs text-slate-500 dark:text-slate-400">
                Tap the camera to add a group photo
              </Text>
            </View>
          </View>

          {/* Search Input */}
          <View className="px-4 py-3">
            <View className="h-12 flex-row items-center rounded-xl bg-slate-100 px-4 dark:bg-slate-800">
              <Feather name="search" size={18} color={isDark ? "#64748b" : "#94a3b8"} />
              <TextInput
                className="ml-3 flex-1 text-base text-slate-900 dark:text-white"
                placeholder="Search username..."
                placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                value={groupSearchQuery}
                onChangeText={setGroupSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Selected Members Chips */}
          {selectedMembers.length > 0 && (
            <View className="px-4 pb-3">
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  {selectedMembers.map((member) => (
                    <TouchableOpacity
                      key={member.publicKey}
                      onPress={() => setSelectedMembers(prev => prev.filter(m => m.publicKey !== member.publicKey))}
                      className="flex-row items-center rounded-full bg-blue-100 px-3 py-1.5 dark:bg-blue-900/30"
                    >
                      <Text className="text-sm font-medium text-blue-700 dark:text-blue-300">
                        {member.username}
                      </Text>
                      <Feather name="x" size={14} color={isDark ? "#93c5fd" : "#1d4ed8"} className="ml-1" />
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Search Results / Empty State */}
          <View className="flex-1 items-center justify-center px-8">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
              <Feather name="users" size={28} color={isDark ? "#64748b" : "#94a3b8"} />
            </View>
            <Text className="mt-4 text-center text-base font-medium text-slate-900 dark:text-white">
              Add people to your group
            </Text>
            <Text className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400">
              Search by username to add members
            </Text>
          </View>

          {/* Create Group Button */}
          <View className="px-4 pb-6" style={{ paddingBottom: Math.max(insets.bottom, 24) }}>
            <TouchableOpacity
              className={`h-14 items-center justify-center rounded-xl ${
                selectedMembers.length < 2 
                  ? 'bg-slate-200 dark:bg-slate-800' 
                  : 'bg-[#0085ff]'
              }`}
              activeOpacity={0.85}
              disabled={selectedMembers.length < 2}
              onPress={() => {
                // TODO: Create group chat
                console.log("Create group with members:", selectedMembers);
                setShowGroupComposerModal(false);
              }}
            >
              <Text className={`text-base font-bold ${
                selectedMembers.length < 2 
                  ? 'text-slate-400 dark:text-slate-600' 
                  : 'text-white'
              }`}>
                Create Group {selectedMembers.length > 0 ? `(${selectedMembers.length})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* New Chat Modal */}
      <Modal
        visible={showNewChatModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowNewChatModal(false)}
      >
        <SafeAreaView className="flex-1 bg-white dark:bg-[#0a0f1a]">
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-800">
            <Text className="text-xl font-bold text-[#111] dark:text-white">New Message</Text>
            <TouchableOpacity onPress={() => setShowNewChatModal(false)} className="p-1">
              <Feather name="x" size={24} color={isDark ? "#fff" : "#111"} />
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          <View className="px-4 py-3">
            <View className="h-12 flex-row items-center rounded-xl bg-slate-100 px-4 dark:bg-slate-800">
              <Feather name="search" size={18} color={isDark ? "#64748b" : "#94a3b8"} />
              <TextInput
                className="ml-3 flex-1 text-base text-slate-900 dark:text-white"
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
              <ActivityIndicator color="#0085ff" />
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
              <View className="h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <Feather name="search" size={28} color={isDark ? "#64748b" : "#94a3b8"} />
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
                  className="flex-row items-center px-4 py-3"
                  onPress={() => handleSelectNewChatProfile(item)}
                  activeOpacity={0.7}
                >
                  <Image
                    source={{ 
                      uri: buildProfilePictureUrl(item.publicKey, { fallbackImageUrl: FALLBACK_PROFILE_IMAGE }) 
                    }}
                    className="h-12 w-12 rounded-full bg-slate-200 dark:bg-slate-700"
                  />
                  <View className="ml-3 flex-1">
                    <Text className="text-base font-semibold text-slate-900 dark:text-white" numberOfLines={1}>
                      {item.username || formatPublicKey(item.publicKey)}
                    </Text>
                    {item.username && (
                      <Text className="text-sm text-slate-500 dark:text-slate-400" numberOfLines={1}>
                        {formatPublicKey(item.publicKey)}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
