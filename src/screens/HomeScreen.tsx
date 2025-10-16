import React, { useContext, useMemo, useCallback } from "react";
import {
  FlatList,
  Text,
  TouchableOpacity,
  View,
  Image,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
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
} from "../utils/deso";
import { useConversations } from "../hooks/useConversations";
import { SafeAreaView } from "react-native-safe-area-context";

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
  const { conversations, profiles, isLoading, error, reload } =
    useConversations();

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
      const otherPk = senderPk === userPk ? recipientPk : senderPk;
      const name = isGroup
        ? last?.RecipientInfo?.AccessGroupKeyName || "Group"
        : profiles?.[otherPk]?.Username || formatPublicKey(otherPk);
      const preview = `${senderName}: ${last?.DecryptedMessage || "..."}`;
      const avatarUri = isGroup
        ? FALLBACK_GROUP_IMAGE
        : buildProfilePictureUrl(otherPk, {
            fallbackImageUrl: FALLBACK_PROFILE_IMAGE,
          });

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
        threadAccessGroupKeyName: isGroup
          ? last?.RecipientInfo?.AccessGroupKeyName
          : DEFAULT_KEY_MESSAGING_GROUP_NAME,
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

  const handleCompose = useCallback(() => {
    navigation.navigate("Composer");
  }, [navigation]);

  if (isLoading && items.length === 0) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#3b82f6" />
        <Text className="mt-3 text-sm text-gray-600">
          Loading your conversations…
        </Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-white px-6 py-10">
        <View className="flex-1 items-center justify-center rounded-3xl border border-red-200 bg-red-50 px-5 py-8">
          <Feather name="alert-triangle" size={28} color="#ef4444" />
          <Text className="mt-3 text-base font-semibold text-red-900">
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
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-1">
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          className="flex-1"
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View className="h-2" />}
          contentContainerClassName={
            items.length === 0
              ? "flex-grow items-center justify-center px-4 pb-20"
              : "px-4 pb-4 pt-4"
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
              className="flex-row items-center rounded-2xl bg-white px-4 py-3"
              activeOpacity={0.7}
              onPress={() => handlePress(item)}
            >
              <View className="mr-3">
                {item.avatarUri ? (
                  <Image
                    source={{ uri: item.avatarUri }}
                    className="h-14 w-14 rounded-full bg-gray-200"
                  />
                ) : (
                  <View className="h-14 w-14 items-center justify-center rounded-full bg-blue-100">
                    <Text className="text-xl font-semibold text-blue-600">
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
                    className="flex-1 mr-2 text-base font-semibold text-gray-900"
                  >
                    {item.name}
                  </Text>
                  {item.time ? (
                    <Text className="text-xs font-medium text-gray-400 flex-shrink-0">
                      {item.time}
                    </Text>
                  ) : null}
                </View>
                <View className="mt-0.5 flex-row items-center">
                  {item.isGroup ? (
                    <View className="mr-2 rounded-full bg-blue-50 px-2 py-0.5">
                      <Text className="text-[10px] font-semibold uppercase text-blue-600">
                        Group
                      </Text>
                    </View>
                  ) : null}
                  <Text
                    numberOfLines={1}
                    className="flex-1 text-sm text-gray-500"
                  >
                    {item.preview}
                  </Text>
                </View>
              </View>
              <View className="ml-2 flex-shrink-0">
                <Feather name="chevron-right" size={18} color="#d1d5db" />
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={() => (
            <View className="items-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12">
              <Feather name="inbox" size={40} color="#9ca3af" />
              <Text className="mt-4 text-lg font-semibold text-gray-900">
                Your inbox is quiet
              </Text>
              <Text className="mt-2 text-center text-sm text-gray-500">
                Start a new conversation and it will show up here right away.
              </Text>
              <TouchableOpacity
                className="mt-6 rounded-full bg-blue-500 px-5 py-2.5"
                activeOpacity={0.85}
                onPress={handleCompose}
              >
                <Text className="text-sm font-semibold text-white">
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
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  searchShadow: {
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
});
