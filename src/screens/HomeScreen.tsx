import React, { useContext, useMemo, useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Text,
  TouchableOpacity,
  View,
  Image,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  DeviceEventEmitter,
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
} from "../navigation/types";
import { DeSoIdentityContext } from "react-deso-protocol";
import { DEFAULT_KEY_MESSAGING_GROUP_NAME } from "../services/conversations";
import {
  formatPublicKey,
  FALLBACK_GROUP_IMAGE,
  FALLBACK_PROFILE_IMAGE,
  getProfileImageUrl,
} from "../utils/deso";
import { useConversations } from "../hooks/useConversations";
import { SafeAreaView } from "react-native-safe-area-context";
import { OUTGOING_MESSAGE_EVENT } from "../constants/events";
import { useColorScheme } from "nativewind";

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
  const { currentUser } = useContext(DeSoIdentityContext);
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { conversations, profiles, groupMembers, isLoading, error, reload } =
    useConversations();
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
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-slate-950">
        <ActivityIndicator color="#3b82f6" />
        <Text className="mt-3 text-sm text-gray-600 dark:text-slate-400">
          Loading your conversations…
        </Text>
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
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-950">
      <View className="flex-1">
        <FlatList
          data={enhancedItems}
          keyExtractor={(item) => item.id}
          className="flex-1"
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View className="h-2" />}
          contentContainerClassName={
            items.length === 0
              ? "flex-grow items-center justify-center px-4 pb-20"
              : "px-4 pb-4 pt-2"
          }
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={reload}
              tintColor="#3b82f6"
              colors={["#3b82f6"]}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.cardShadow}
              className="flex-row items-center rounded-2xl bg-white px-5 py-4 mb-1 dark:bg-slate-900"
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
                <View className="flex-row items-center justify-between">
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    className="flex-1 mr-2 text-[16px] font-bold text-slate-900 dark:text-slate-100"
                  >
                    {item.name}
                  </Text>
                  {item.time ? (
                    <Text className="text-[12px] font-semibold text-slate-400 flex-shrink-0 dark:text-slate-500">
                      {item.time}
                    </Text>
                  ) : null}
                </View>
                <View className="mt-0.5 flex-row items-center">
                  {item.isGroup ? (
                    <View className="mr-2 rounded-full bg-indigo-50 px-2 py-0.5 border border-indigo-100 dark:bg-indigo-900/30 dark:border-indigo-800">
                      <Text className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-300">
                        Group
                      </Text>
                    </View>
                  ) : null}
                  <Text
                    numberOfLines={1}
                    className="flex-1 text-[14px] font-medium text-slate-500 dark:text-slate-400"
                  >
                    {item.preview}
                  </Text>
                </View>
              </View>
              <View className="ml-2 flex-shrink-0">
                <Feather name="chevron-right" size={18} color={colorScheme === "dark" ? "#475569" : "#d1d5db"} />
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
                className="mt-6 rounded-full bg-indigo-600 px-6 py-3 shadow-lg shadow-indigo-200"
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

const styles = StyleSheet.create({
  cardShadow: {
    shadowColor: "#64748b",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  searchShadow: {
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
});
