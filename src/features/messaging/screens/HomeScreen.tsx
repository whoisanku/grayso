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
  Dimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ChatType, buildProfilePictureUrl } from "deso-protocol";
import {
  CompositeNavigationProp,
  useNavigation,
} from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  type HomeTabParamList,
  type RootStackParamList,
} from "../../../navigation/types";
import { DeSoIdentityContext } from "react-deso-protocol";
import { DEFAULT_KEY_MESSAGING_GROUP_NAME } from "../constants/messaging";
import {
  formatPublicKey,
  FALLBACK_GROUP_IMAGE,
  FALLBACK_PROFILE_IMAGE,
  getProfileImageUrl,
} from "../../../utils/deso";
import { useConversations } from "../hooks/useConversations";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { OUTGOING_MESSAGE_EVENT } from "../constants/events";
import { useColorScheme } from "nativewind";
import EditIcon from "../../../assets/navIcons/edit.svg";
import { LiquidGlassView } from "../../../utils/liquidGlass";
import Animated, { FadeIn, FadeOut, SlideInLeft, SlideOutLeft } from "react-native-reanimated";
import { BlurView } from "expo-blur";

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
  const { conversations, profiles, groupMembers, isLoading, error, reload } =
    useConversations();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
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

  const items = useMemo<MockConversation[]>(() => {
    const userPk = currentUser?.PublicKeyBase58Check;
    if (!userPk) return [];

    return Object.values(conversations).map((c) => {
      const last = c.messages[0];
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

      return {
        id: `${c.firstMessagePublicKey}-${c.ChatType}`,
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
  }, [conversations, profiles, groupMembers, currentUser?.PublicKeyBase58Check]);

  const enhancedItems = useMemo(() => {
    return items.map((item) => {
      const conversationId = `${item.threadPublicKey}-${item.chatType}`;
      const optimistic = optimisticPreviews[conversationId];

      if (optimistic) {
        const optimisticTimestampMs = optimistic.timestampNanos / 1e6;
        const existingTimestamp = item.lastTimestampNanos ?? 0;

        if (optimistic.timestampNanos > existingTimestamp) {
          return {
            ...item,
            preview: `You: ${
              optimistic.messageText.trim() === "🚀"
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
  }, [items, optimisticPreviews]);

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
              <EditIcon
                width={20}
                height={20}
                stroke={isDark ? "#f8fafc" : "#0f172a"}
                strokeWidth={2}
              />
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
            onPress={reload}
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
        
        {/* New Chat Button */}
        <TouchableOpacity
          onPress={() => rootNavigation.navigate("NewChat")}
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
              <EditIcon
                width={20}
                height={20}
                stroke={isDark ? "#f8fafc" : "#0f172a"}
                strokeWidth={2}
              />
            </LiquidGlassView>
          ) : (
            <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
              <EditIcon
                width={20}
                height={20}
                stroke={isDark ? "#f8fafc" : "#0f172a"}
                strokeWidth={2}
              />
            </View>
          )}
        </TouchableOpacity>
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
            <TouchableOpacity
              className="flex-1"
              activeOpacity={1}
              onPress={() => setIsDrawerOpen(false)}
            >
              <BlurView
                intensity={40}
                tint={isDark ? "dark" : "light"}
                className="flex-1"
              />
            </TouchableOpacity>
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
                Your inbox is quiet
              </Text>
              <Text className="mt-2 text-center text-sm text-gray-500 dark:text-slate-400">
                Start a new conversation and it will show up here right away.
              </Text>
              <TouchableOpacity
                className="mt-6 rounded-full bg-[#0085ff] px-6 py-3 shadow-lg shadow-blue-200 dark:shadow-none"
                activeOpacity={0.85}
                onPress={handleCompose}
              >
                <Text className="text-sm font-bold text-white">
                  Start a message
                </Text>
              </TouchableOpacity>
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}
