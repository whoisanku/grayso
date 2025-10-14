import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  ChatType,
  buildProfilePictureUrl,
  getAllAccessGroups,
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
import { getConversationsNewMap } from "../services/conversations";
import {
  formatPublicKey,
  FALLBACK_GROUP_IMAGE,
  FALLBACK_PROFILE_IMAGE,
} from "../utils/deso";

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
};

export default function HomeScreen() {
  const { currentUser } = useContext(DeSoIdentityContext);
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const [items, setItems] = useState<MockConversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Background logging only: list AccessGroup public keys and Message IDs
  useEffect(() => {
    if (!currentUser?.PublicKeyBase58Check) return;

    async function load() {
      setIsLoading(true);
      try {
        const userPkSafe = currentUser!.PublicKeyBase58Check;
        const { AccessGroupsOwned, AccessGroupsMember } =
          await getAllAccessGroups({
            PublicKeyBase58Check: userPkSafe,
          });
        const allGroups = (AccessGroupsOwned || []).concat(
          AccessGroupsMember || []
        );

        const userPk = userPkSafe;
        const { conversations, publicKeyToProfileEntryResponseMap } =
          await getConversationsNewMap(userPk, allGroups);

        const list: MockConversation[] = Object.values(conversations).map(
          (c) => {
            const last = c.messages[0];
            const info = last?.MessageInfo || {};
            const timestampNanosStr =
              info.TimestampNanosString || String(info.TimestampNanos || "");

            const tsMs = timestampNanosStr
              ? Number(timestampNanosStr) / 1_000_000
              : 0;
            const time = formatTimestamp(tsMs);

            const senderPk = last?.SenderInfo?.OwnerPublicKeyBase58Check || "";
            const recipientPk =
              last?.RecipientInfo?.OwnerPublicKeyBase58Check || "";
            const senderName =
              senderPk === userPk
                ? "You"
                : publicKeyToProfileEntryResponseMap?.[senderPk]?.Username ||
                  formatPublicKey(senderPk);

            let name = "";
            const isGroup = (c.ChatType as any) === ChatType.GROUPCHAT;
            if (isGroup) {
              const ex = (last as any)?.MessageInfo?.ExtraData || {};
              name =
                ex.groupChatTitle ||
                ex.GroupChatTitle ||
                ex.groupName ||
                ex.GroupName ||
                last?.RecipientInfo?.AccessGroupKeyName ||
                "Group chat";
            } else {
              const other = senderPk === userPk ? recipientPk : senderPk;
              name =
                publicKeyToProfileEntryResponseMap?.[other]?.Username ||
                formatPublicKey(other);
            }

            const bodyRaw = (last as any)?.DecryptedMessage || "";
            const preview = bodyRaw
              ? `${senderName}: ${bodyRaw}`
              : `${senderName}: ...`;

            // Avatar resolution similar to web
            let avatarUri: string | null = null;
            if (isGroup) {
              const ex = (last as any)?.MessageInfo?.ExtraData || {};
              const groupImageUrl =
                ex.groupChatImageUrl ||
                ex.GroupChatImageUrl ||
                ex.groupChatImageURL ||
                ex.GroupChatImageURL ||
                ex.chatImageUrl ||
                ex.ChatImageUrl ||
                ex.chatImageURL ||
                ex.ChatImageURL ||
                ex.groupImageUrl ||
                ex.GroupImageUrl ||
                null;
              avatarUri = groupImageUrl ?? FALLBACK_GROUP_IMAGE;
            } else {
              const other = senderPk === userPk ? recipientPk : senderPk;
              try {
                avatarUri = buildProfilePictureUrl(other, {
                  fallbackImageUrl: FALLBACK_PROFILE_IMAGE,
                });
              } catch {
                avatarUri = FALLBACK_PROFILE_IMAGE;
              }
            }

            // Small stack for groups
            let stackedAvatarUris: string[] | undefined;
            if (isGroup) {
              const candidates = Array.from(
                new Set(
                  [
                    last?.SenderInfo?.OwnerPublicKeyBase58Check,
                    last?.RecipientInfo?.OwnerPublicKeyBase58Check,
                  ].filter(Boolean) as string[]
                )
              );
              stackedAvatarUris = candidates.slice(0, 3).map((pk) => {
                try {
                  return buildProfilePictureUrl(pk, {
                    fallbackImageUrl: FALLBACK_PROFILE_IMAGE,
                  });
                } catch {
                  return FALLBACK_PROFILE_IMAGE;
                }
              });
            }

            return {
              id: `${c.firstMessagePublicKey}-${c.ChatType}-${
                last?.RecipientInfo?.AccessGroupKeyName || ""
              }`,
              name,
              preview,
              time,
              avatarUri,
              isGroup,
              stackedAvatarUris,
            };
          }
        );

        // Log identifiers for debugging
        try {
          // eslint-disable-next-line no-console
          console.log(
            "[Messages] Displaying (derived from web approach):",
            Object.values(conversations).map((c) => {
              const last = c.messages[0] as any;
              const info = last?.MessageInfo || {};
              const messageId =
                info?.MessageIdBase58Check ||
                info?.EncryptedMessageHashHex ||
                info?.MessageHashHex ||
                info?.TimestampNanosString ||
                String(info?.TimestampNanos || "");
              return {
                messageId,
                senderAccessGroupPublicKey:
                  last?.SenderInfo?.AccessGroupPublicKeyBase58Check ||
                  last?.SenderInfo?.AccessGroupPublicKey ||
                  null,
                recipientAccessGroupPublicKey:
                  last?.RecipientInfo?.AccessGroupPublicKeyBase58Check ||
                  last?.RecipientInfo?.AccessGroupPublicKey ||
                  null,
              };
            })
          );
        } catch {}

        setItems(list);
      } catch (e) {
        console.warn("Failed to load conversations", e);
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [currentUser?.PublicKeyBase58Check]);

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

  return (
    <View style={styles.container}>
      {/* Header removed per spec to match web styling */}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
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
          </View>
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
