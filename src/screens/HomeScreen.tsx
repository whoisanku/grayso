import React, { useContext, useMemo, useCallback } from "react";
import {
  FlatList,
  StyleSheet,
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
      });
    },
    [currentUser?.PublicKeyBase58Check, navigation]
  );

  if (isLoading && items.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={reload} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.7}
            onPress={() => handlePress(item)}
          >
            <View style={styles.avatarContainer}>
              {item.avatarUri ? (
                <Image
                  source={{ uri: item.avatarUri }}
                  style={styles.avatarImage}
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
                </View>
              )}
              {item.isGroup &&
              item.stackedAvatarUris &&
              item.stackedAvatarUris.length > 0 ? (
                <View style={styles.stackedOverlay}>
                  {item.stackedAvatarUris.map((uri, idx) => (
                    <Image
                      key={`${item.id}-stk-${idx}`}
                      source={{ uri }}
                      style={[styles.smallAvatar, { left: idx * 14 }]}
                    />
                  ))}
                </View>
              ) : null}
            </View>
            <View style={styles.cardBody}>
              <View style={styles.cardHeader}>
                <Text numberOfLines={1} style={styles.name}>
                  {item.name}
                </Text>
                <Text style={styles.time}>{item.time}</Text>
              </View>
              <Text numberOfLines={1} style={styles.preview}>
                {item.preview}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Feather name="message-square" size={36} color="#94a3b8" />
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptySubtitle}>
              Start a conversation to see it here.
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  avatarContainer: {
    width: 56,
    height: 56,
    marginRight: 12,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#e2e8f0",
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  stackedOverlay: {
    position: "absolute",
    bottom: -2,
    right: -6,
    height: 24,
    width: 48,
  },
  smallAvatar: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#fff",
    backgroundColor: "#e2e8f0",
  },
  avatarText: {
    fontWeight: "700",
    color: "#334155",
    fontSize: 18,
  },
  cardBody: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
    flex: 1,
    marginRight: 8,
  },
  time: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
  preview: {
    fontSize: 14,
    color: "#64748b",
  },
  separator: {
    height: 8,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: "#64748b",
  },
});
