import React, { useContext, useMemo, useCallback } from "react";
import {
  FlatList,
  Text,
  TouchableOpacity,
  View,
  Image,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  ChatType,
  buildProfilePictureUrl,
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
} from "../navigation/types";
import { DeSoIdentityContext } from "react-deso-protocol";
import {
  DEFAULT_KEY_MESSAGING_GROUP_NAME,
} from "../services/conversations";
import {
  formatPublicKey,
  FALLBACK_GROUP_IMAGE,
  FALLBACK_PROFILE_IMAGE,
} from "../utils/deso";
import { useConversations } from "../hooks/useConversations";

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
  const { currentUser } = useContext(DeSoIdentityContext);
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { conversations, profiles, isLoading, error, reload } = useConversations();

  const items = useMemo<MockConversation[]>(() => {
    const userPk = currentUser?.PublicKeyBase58Check;
    if (!userPk) return [];

    return Object.values(conversations).map((c) => {
      const last = c.messages[0];
      const info = last?.MessageInfo || {};
      const time = formatTimestamp(info.TimestampNanos ? info.TimestampNanos / 1e6 : 0);
      const senderPk = last?.SenderInfo?.OwnerPublicKeyBase58Check || "";
      const recipientPk = last?.RecipientInfo?.OwnerPublicKeyBase58Check || "";
      const senderName = senderPk === userPk ? "You" : profiles?.[senderPk]?.Username || formatPublicKey(senderPk);
      const isGroup = c.ChatType === ChatType.GROUPCHAT;
      const otherPk = senderPk === userPk ? recipientPk : senderPk;
      const name = isGroup ? last?.RecipientInfo?.AccessGroupKeyName || "Group" : profiles?.[otherPk]?.Username || formatPublicKey(otherPk);
      const preview = `${senderName}: ${last?.DecryptedMessage || '...'}`;
      const avatarUri = isGroup ? FALLBACK_GROUP_IMAGE : buildProfilePictureUrl(otherPk, { fallbackImageUrl: FALLBACK_PROFILE_IMAGE });

      return {
        id: `${c.firstMessagePublicKey}-${c.ChatType}`,
        name,
        preview,
        time,
        avatarUri,
        isGroup,
        chatType: c.ChatType,
        threadPublicKey: otherPk,
        lastTimestampNanos: last?.MessageInfo?.TimestampNanos,
        userAccessGroupKeyName: DEFAULT_KEY_MESSAGING_GROUP_NAME,
        threadAccessGroupKeyName: isGroup ? last?.RecipientInfo?.AccessGroupKeyName : DEFAULT_KEY_MESSAGING_GROUP_NAME,
        partyGroupOwnerPublicKeyBase58Check: otherPk,
        recipientInfo: last?.RecipientInfo,
      };
    });
  }, [conversations, profiles, currentUser?.PublicKeyBase58Check]);

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
      });
    },
    [currentUser?.PublicKeyBase58Check, navigation]
  );

  if (isLoading && items.length === 0) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 p-6">
        <Text className="text-sm text-red-500">{error}</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        className="flex-1 px-4 pb-4"
        ItemSeparatorComponent={() => <View className="h-2" />}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={reload} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            className="flex-row items-center rounded-2xl border border-slate-200 bg-white p-3.5"
            activeOpacity={0.7}
            onPress={() => handlePress(item)}
          >
            <View className="relative mr-3 h-14 w-14 items-center justify-center">
              {item.avatarUri ? (
                <Image
                  source={{ uri: item.avatarUri }}
                  className="h-12 w-12 rounded-full bg-slate-200"
                />
              ) : (
                <View className="h-12 w-12 items-center justify-center rounded-full bg-slate-200">
                  <Text className="text-lg font-bold text-slate-700">
                    {item.name.charAt(0)}
                  </Text>
                </View>
              )}
              {item.isGroup &&
              item.stackedAvatarUris &&
              item.stackedAvatarUris.length > 0 ? (
                <View className="absolute -bottom-0.5 -right-1.5 h-6 w-12">
                  {item.stackedAvatarUris.map((uri, idx) => (
                    <Image
                      key={`${item.id}-stk-${idx}`}
                      source={{ uri }}
                      className="absolute h-5 w-5 rounded-full border-2 border-white bg-slate-200"
                      style={{ left: idx * 14 }}
                    />
                  ))}
                </View>
              ) : null}
            </View>
            <View className="flex-1">
              <View className="mb-1.5 flex-row items-center justify-between">
                <Text
                  numberOfLines={1}
                  className="mr-2 flex-1 text-base font-semibold text-slate-900"
                >
                  {item.name}
                </Text>
                <Text className="text-xs font-medium text-slate-500">
                  {item.time}
                </Text>
              </View>
              <Text numberOfLines={1} className="text-sm text-slate-500">
                {item.preview}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => (
          <View className="items-center py-12">
            <Feather name="message-square" size={36} color="#94a3b8" />
            <Text className="mt-3 text-lg font-semibold text-slate-800">
              No messages yet
            </Text>
            <Text className="mt-1.5 text-sm text-slate-500">
              Start a conversation to see it here.
            </Text>
          </View>
        )}
      />
    </View>
  );
}
