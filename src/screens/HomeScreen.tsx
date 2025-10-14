import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ListRenderItem,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  ChatType,
  buildProfilePictureUrl,
  getAllMessageThreads,
  identity,
  type DecryptedMessageEntryResponse,
  type NewMessageEntryResponse,
} from "deso-protocol";
import {
  CompositeNavigationProp,
  useNavigation,
} from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMessagingAccessGroups } from "../hooks/useMessagingAccessGroups";
import {
  type HomeTabParamList,
  type RootStackParamList,
} from "../navigation/types";
import {
  FALLBACK_GROUP_IMAGE,
  FALLBACK_PROFILE_IMAGE,
  formatPublicKey,
  getProfileDisplayName,
} from "../utils/deso";
import { DeSoIdentityContext } from "react-deso-protocol";

type ThreadListItem = {
  id: string;
  chatType: NewMessageEntryResponse["ChatType"];
  displayName: string;
  preview: string;
  timestamp: number | null;
  isSender: boolean;
  error?: string;
  avatarUri?: string | null;
  avatarFallback: string;
  thread: NewMessageEntryResponse;
  counterpartPublicKey: string;
  userAccessGroupKeyName?: string | null;
  counterpartAccessGroupKeyName?: string | null;
  groupAccessGroupKeyName?: string | null;
  hasUnread?: boolean;
  isGroupChat?: boolean;
};

const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

type MessagesTabNavigationProp = BottomTabNavigationProp<
  HomeTabParamList,
  "Messages"
>;

type MessageDetailNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "MessageThread"
>;

type HomeScreenNavigationProp = CompositeNavigationProp<
  MessagesTabNavigationProp,
  MessageDetailNavigationProp
>;

const formatTimestamp = (timestampMs: number) => {
  const date = new Date(timestampMs);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

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
  const {
    groups: accessGroups,
    isLoading: isLoadingAccessGroups,
    isLoaded: isAccessGroupsLoaded,
  } = useMessagingAccessGroups();
  const [messageThreads, setMessageThreads] = useState<ThreadListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchThreads = useCallback(
    async (options?: { refreshing?: boolean; shouldAbort?: () => boolean }) => {
      if (isLoadingAccessGroups && !isAccessGroupsLoaded) {
        return;
      }

      const finalizeLoading = () => {
        if (options?.refreshing) {
          setIsRefreshing(false);
        } else {
          setIsLoading(false);
        }
      };

      if (!currentUser?.PublicKeyBase58Check) {
        setMessageThreads([]);
        setError(null);
        finalizeLoading();
        return;
      }

      if (options?.shouldAbort?.()) {
        finalizeLoading();
        return;
      }

      if (options?.refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const response = await getAllMessageThreads({
          UserPublicKeyBase58Check: currentUser.PublicKeyBase58Check,
        });

        if (options?.shouldAbort?.()) {
          finalizeLoading();
          return;
        }

        const threads = response.MessageThreads ?? [];
        const profileMap = response.PublicKeyToProfileEntryResponse ?? {};

        const decryptedThreads = await Promise.all(
          threads.map(async (thread, index) => {
            try {
              if (!currentUser?.PublicKeyBase58Check) {
                throw new Error("Cannot decrypt messages without a logged in user");
              }
              const decrypted = await identity.decryptMessage(
                thread,
                accessGroups
              );
              return { thread, decrypted, index };
            } catch (decryptError) {
              console.warn("Failed to decrypt message thread", decryptError);
              const fallbackIsSender =
                thread.SenderInfo.OwnerPublicKeyBase58Check ===
                currentUser.PublicKeyBase58Check;
              const fallback: DecryptedMessageEntryResponse = {
                ...thread,
                DecryptedMessage: "",
                IsSender: fallbackIsSender,
                error: "Unable to decrypt message",
              };
              return { thread, decrypted: fallback, index };
            }
          })
        );

        if (options?.shouldAbort?.()) {
          finalizeLoading();
          return;
        }

        const items = decryptedThreads.map(({ thread, decrypted, index }) => {
          const isGroupChat = thread.ChatType === ChatType.GROUPCHAT;
          const isSender = !!decrypted.IsSender;
          const groupTitle =
            thread.MessageInfo.ExtraData?.groupChatTitle ??
            thread.MessageInfo.ExtraData?.GroupChatTitle ??
            thread.MessageInfo.ExtraData?.chatTitle ??
            thread.MessageInfo.ExtraData?.ChatTitle ??
            thread.MessageInfo.ExtraData?.groupName ??
            thread.MessageInfo.ExtraData?.GroupName ??
            thread.RecipientInfo.AccessGroupKeyName ??
            "Group chat";
          const groupImageUrl =
            thread.MessageInfo.ExtraData?.groupChatImageUrl ??
            thread.MessageInfo.ExtraData?.GroupChatImageUrl ??
            thread.MessageInfo.ExtraData?.groupChatImageURL ??
            thread.MessageInfo.ExtraData?.GroupChatImageURL ??
            thread.MessageInfo.ExtraData?.chatImageUrl ??
            thread.MessageInfo.ExtraData?.ChatImageUrl ??
            thread.MessageInfo.ExtraData?.chatImageURL ??
            thread.MessageInfo.ExtraData?.ChatImageURL ??
            thread.MessageInfo.ExtraData?.groupImageUrl ??
            thread.MessageInfo.ExtraData?.GroupImageUrl ??
            null;

          const userAccessGroupInfo = isSender
            ? thread.SenderInfo
            : thread.RecipientInfo;
          const counterpartAccessGroupInfo = isSender
            ? thread.RecipientInfo
            : thread.SenderInfo;

          const counterpartPublicKey = isGroupChat
            ? thread.RecipientInfo.OwnerPublicKeyBase58Check
            : counterpartAccessGroupInfo.OwnerPublicKeyBase58Check;

          const counterpartProfile = profileMap?.[counterpartPublicKey] ?? null;

          const counterpartName = isGroupChat
            ? groupTitle
            : counterpartPublicKey === currentUser.PublicKeyBase58Check
            ? "You"
            : getProfileDisplayName(counterpartProfile, counterpartPublicKey);

          const senderPublicKey = thread.SenderInfo.OwnerPublicKeyBase58Check;
          const senderProfile = profileMap?.[senderPublicKey] ?? null;
          const senderName =
            senderPublicKey === currentUser.PublicKeyBase58Check
              ? "You"
              : getProfileDisplayName(senderProfile, senderPublicKey);

          const rawDecrypted = decrypted.DecryptedMessage?.trim() ?? "";
          const previewBody =
            rawDecrypted.length > 0
              ? rawDecrypted
              : decrypted.error?.trim() ?? "No preview available";

          const preview = `${senderName}: ${previewBody}`;

          const timestampValue =
            thread.MessageInfo.TimestampNanosString ??
            (typeof thread.MessageInfo.TimestampNanos === "number"
              ? thread.MessageInfo.TimestampNanos.toString()
              : undefined);

          const timestampMs = timestampValue
            ? Number(timestampValue) / 1_000_000
            : Number.NaN;

          const safeTimestamp = Number.isFinite(timestampMs)
            ? timestampMs
            : null;

          let avatarUri: string | null = null;
          if (isGroupChat) {
            avatarUri = groupImageUrl ?? FALLBACK_GROUP_IMAGE;
          } else {
            const profileImage =
              counterpartProfile?.ExtraData?.LargeProfilePicURL ??
              counterpartProfile?.ExtraData?.LargeProfilePicUrl ??
              counterpartProfile?.ExtraData?.ProfilePic ??
              counterpartProfile?.ExtraData?.profilePic;
            if (profileImage) {
              avatarUri = profileImage;
            } else {
              try {
                avatarUri = buildProfilePictureUrl(counterpartPublicKey, {
                  fallbackImageUrl: FALLBACK_PROFILE_IMAGE,
                });
              } catch (avatarError) {
                console.warn(
                  "Failed to build profile picture URL",
                  avatarError
                );
                avatarUri = FALLBACK_PROFILE_IMAGE;
              }
            }
          }

          const avatarFallback = counterpartName
            ? counterpartName.charAt(0).toUpperCase()
            : "#";

          return {
            id: `${timestampValue ?? index}-${counterpartPublicKey}-${
              thread.ChatType
            }`,
            chatType: thread.ChatType,
            displayName: isGroupChat ? groupTitle : counterpartName,
            preview,
            timestamp: safeTimestamp,
            isSender,
            error:
              rawDecrypted.length > 0
                ? undefined
                : decrypted.error?.trim() || undefined,
            avatarUri,
            avatarFallback,
            thread,
            counterpartPublicKey,
            userAccessGroupKeyName: userAccessGroupInfo.AccessGroupKeyName,
            counterpartAccessGroupKeyName:
              counterpartAccessGroupInfo.AccessGroupKeyName,
            groupAccessGroupKeyName: isGroupChat
              ? thread.RecipientInfo.AccessGroupKeyName
              : null,
            hasUnread: !isSender && rawDecrypted.length > 0,
            isGroupChat,
          } satisfies ThreadListItem;
        });

        items.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));

        setMessageThreads(items);
        setError(null);
      } catch (fetchError) {
        if (options?.shouldAbort?.()) {
          finalizeLoading();
          return;
        }

        console.warn("Failed to load message threads", fetchError);
        setError(
          "Unable to load your latest messages. Pull to refresh to try again."
        );
        setMessageThreads([]);
      } finally {
        if (options?.shouldAbort?.()) {
          finalizeLoading();
          return;
        }

        finalizeLoading();
      }
    },
    [
      accessGroups,
      currentUser?.PublicKeyBase58Check,
      isAccessGroupsLoaded,
      isLoadingAccessGroups,
    ]
  );

  useEffect(() => {
    let isActive = true;

    if (isLoadingAccessGroups && !isAccessGroupsLoaded) {
      return () => {
        isActive = false;
      };
    }

    void fetchThreads({ shouldAbort: () => !isActive });

    return () => {
      isActive = false;
    };
  }, [fetchThreads, isAccessGroupsLoaded, isLoadingAccessGroups]);

  const handleRefresh = useCallback(() => {
    void fetchThreads({ refreshing: true });
  }, [fetchThreads]);

  const handleThreadPress = useCallback(
    (item: ThreadListItem) => {
      navigation.navigate("MessageThread", {
        thread: item.thread,
        displayName: item.displayName,
        avatarUri: item.avatarUri,
        counterpartPublicKey: item.counterpartPublicKey,
        isGroupChat: item.chatType === ChatType.GROUPCHAT,
        userAccessGroupKeyName: item.userAccessGroupKeyName ?? null,
        counterpartAccessGroupKeyName:
          item.counterpartAccessGroupKeyName ?? null,
        groupAccessGroupKeyName: item.groupAccessGroupKeyName ?? null,
      });
    },
    [navigation]
  );

  const renderThread: ListRenderItem<ThreadListItem> = useCallback(
    ({ item }) => (
      <TouchableOpacity
        style={[styles.threadCard, item.hasUnread && styles.threadCardUnread]}
        activeOpacity={0.85}
        onPress={() => handleThreadPress(item)}
      >
        <View style={styles.threadRow}>
          <View style={styles.avatarContainer}>
            {item.avatarUri ? (
              <Image
                source={{ uri: item.avatarUri }}
                style={styles.avatarImage}
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>
                  {item.avatarFallback}
                </Text>
              </View>
            )}
            {item.isGroupChat && (
              <View style={styles.groupChatIndicator}>
                <Feather name="users" size={12} color="#fff" />
              </View>
            )}
          </View>
          <View style={styles.threadBody}>
            <View style={styles.threadHeader}>
              <View style={styles.threadTitleContainer}>
                <Text
                  style={[
                    styles.threadTitle,
                    item.hasUnread && styles.threadTitleUnread,
                  ]}
                  numberOfLines={1}
                >
                  {item.displayName}
                </Text>
                {item.hasUnread && <View style={styles.unreadIndicator} />}
              </View>
              {item.timestamp ? (
                <Text style={styles.threadTimestamp}>
                  {formatTimestamp(item.timestamp)}
                </Text>
              ) : null}
            </View>
            <Text
              style={[
                styles.threadPreview,
                item.hasUnread && styles.threadPreviewUnread,
              ]}
              numberOfLines={2}
            >
              {item.preview}
            </Text>
            {item.error ? (
              <View style={styles.errorContainer}>
                <Feather name="alert-circle" size={12} color="#dc2626" />
                <Text style={styles.threadError} numberOfLines={2}>
                  {item.error}
                </Text>
              </View>
            ) : (
              <Text style={styles.threadMeta}>
                {item.chatType === ChatType.GROUPCHAT
                  ? "Group chat"
                  : item.isSender
                  ? "Direct message • Sent"
                  : "Direct message • Received"}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    ),
    [handleThreadPress]
  );

  const listEmptyComponent = useMemo(() => {
    if (isLoading && !isRefreshing) {
      return () => (
        <View style={styles.emptyState}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingText}>Loading conversations...</Text>
          </View>
        </View>
      );
    }

    return () => (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconContainer}>
          <Feather name="message-circle" size={48} color="#cbd5e1" />
        </View>
        <Text style={styles.emptyTitle}>No conversations yet</Text>
        <Text style={styles.emptySubtitle}>
          Start a conversation or send a message to see it here.
        </Text>
        <TouchableOpacity
          style={styles.startConversationButton}
          onPress={() => navigation.navigate("Composer")}
        >
          <Feather name="plus" size={16} color="#fff" />
          <Text style={styles.startConversationText}>Start Conversation</Text>
        </TouchableOpacity>
      </View>
    );
  }, [isLoading, isRefreshing, navigation]);

  const errorBanner = useMemo(() => {
    if (!error) {
      return null;
    }

    return (
      <View style={styles.errorBanner}>
        <View style={styles.errorBannerContent}>
          <Feather name="alert-triangle" size={16} color="#b91c1c" />
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
          <Feather name="refresh-cw" size={14} color="#b91c1c" />
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }, [error, handleRefresh]);

  return (
    <FlatList
      data={messageThreads}
      keyExtractor={(item) => item.id}
      renderItem={renderThread}
      contentContainerStyle={[
        styles.listContent,
        messageThreads.length === 0 ? styles.listContentEmpty : undefined,
      ]}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListEmptyComponent={listEmptyComponent}
      ListHeaderComponent={errorBanner}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor="#000"
          colors={["#000"]}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    flexGrow: 1,
    padding: 16,
    backgroundColor: "#f8fafc",
  },
  listContentEmpty: {
    justifyContent: "center",
  },
  threadCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  threadCardUnread: {
    backgroundColor: "#fef7ff",
    borderColor: "#e879f9",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  threadRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  avatarContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: "hidden",
    marginRight: 12,
    backgroundColor: "#e2e8f0",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarFallback: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  groupChatIndicator: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#2563eb",
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  threadHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  threadTitleContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
  },
  threadTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
    flex: 1,
  },
  threadTitleUnread: {
    fontWeight: "700",
    color: "#1e293b",
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2563eb",
    marginLeft: 6,
  },
  threadTimestamp: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
  threadPreview: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 6,
    lineHeight: 20,
  },
  threadPreviewUnread: {
    color: "#475569",
    fontWeight: "500",
  },
  threadMeta: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "500",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  threadError: {
    fontSize: 12,
    color: "#dc2626",
    marginLeft: 4,
    flex: 1,
  },
  separator: {
    height: 0,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    marginBottom: 24,
    opacity: 0.6,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32,
  },
  startConversationButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563eb",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: "#2563eb",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  startConversationText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  loadingContainer: {
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#64748b",
    fontWeight: "500",
  },
  errorBanner: {
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#fecaca",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  errorBannerContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  errorBannerText: {
    color: "#b91c1c",
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
    fontWeight: "500",
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fee2e2",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
  },
  retryButtonText: {
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  avatarFallbackText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#475569",
  },
  threadBody: {
    flex: 1,
  },
});
