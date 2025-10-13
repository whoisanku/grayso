import React, {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type ListRenderItem,
} from "react-native";
import {
  ChatType,
  buildProfilePictureUrl,
  getPaginatedDMThread,
  getPaginatedGroupChatThread,
  identity,
  sendMessage,
  type DecryptedMessageEntryResponse,
  type NewMessageEntryResponse,
  type ProfileEntryResponse,
} from "deso-protocol";
import { DeSoIdentityContext } from "react-deso-protocol";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMessagingAccessGroups } from "../hooks/useMessagingAccessGroups";
import {
  FALLBACK_GROUP_IMAGE,
  FALLBACK_PROFILE_IMAGE,
  getProfileDisplayName,
} from "../utils/deso";
import { type RootStackParamList } from "../navigation/types";

const MAX_MESSAGES_TO_FETCH = 75;

const formatMessageTimestamp = (timestampMs: number | null) => {
  if (!timestampMs) {
    return "";
  }

  const date = new Date(timestampMs);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const sameDay = date.toDateString() === new Date().toDateString();
  const datePart = sameDay
    ? ""
    : date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
  const timePart = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  return datePart ? `${datePart} • ${timePart}` : timePart;
};

const nanosToMs = (value?: string | number | null) => {
  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value) / 1_000_000;
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value / 1_000_000;
  }

  return null;
};

type MessageThreadRouteProp = RouteProp<RootStackParamList, "MessageThread">;

type MessageListItem = {
  id: string;
  text: string;
  timestamp: number | null;
  isOwn: boolean;
  senderName: string;
  error?: string;
};

export default function MessageThreadScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<MessageThreadRouteProp>();
  const { currentUser } = useContext(DeSoIdentityContext);
  const {
    groups: accessGroups,
    isLoading: isLoadingAccessGroups,
    isLoaded: isAccessGroupsLoaded,
  } = useMessagingAccessGroups();

  const [messages, setMessages] = useState<MessageListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composerValue, setComposerValue] = useState("");
  const [isSending, setIsSending] = useState(false);

  const thread = route.params.thread;
  const isGroupChat = route.params.isGroupChat;

  const headerAvatarUri = useMemo(() => {
    if (route.params.avatarUri) {
      return route.params.avatarUri;
    }

    if (isGroupChat) {
      return FALLBACK_GROUP_IMAGE;
    }

    try {
      return buildProfilePictureUrl(route.params.counterpartPublicKey, {
        fallbackImageUrl: FALLBACK_PROFILE_IMAGE,
      });
    } catch (avatarError) {
      console.warn("Failed to build header avatar", avatarError);
      return FALLBACK_PROFILE_IMAGE;
    }
  }, [
    isGroupChat,
    route.params.avatarUri,
    route.params.counterpartPublicKey,
  ]);

  const headerAvatarFallback = useMemo(() => {
    const displayName = route.params.displayName ?? "";
    return displayName.length > 0
      ? displayName.charAt(0).toUpperCase()
      : "#";
  }, [route.params.displayName]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View style={styles.headerTitleContainer}>
          <View style={styles.headerAvatarContainer}>
            {headerAvatarUri ? (
              <Image
                source={{ uri: headerAvatarUri }}
                style={styles.headerAvatarImage}
              />
            ) : (
              <View style={styles.headerAvatarFallback}>
                <Text style={styles.headerAvatarFallbackText}>
                  {headerAvatarFallback}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.headerTitleText} numberOfLines={1}>
            {route.params.displayName}
          </Text>
        </View>
      ),
    });
  }, [
    headerAvatarFallback,
    headerAvatarUri,
    navigation,
    route.params.displayName,
  ]);

  const {
    userAccessGroupKeyName,
    counterpartAccessGroupKeyName,
    groupAccessGroupKeyName,
  } = useMemo(() => {
    const isSender =
      thread.SenderInfo.OwnerPublicKeyBase58Check ===
      currentUser?.PublicKeyBase58Check;

    const inferredUserKey = isSender
      ? thread.SenderInfo.AccessGroupKeyName
      : thread.RecipientInfo.AccessGroupKeyName;
    const inferredCounterpartKey = isSender
      ? thread.RecipientInfo.AccessGroupKeyName
      : thread.SenderInfo.AccessGroupKeyName;

    return {
      userAccessGroupKeyName:
        route.params.userAccessGroupKeyName ?? inferredUserKey ?? "default-key",
      counterpartAccessGroupKeyName:
        route.params.counterpartAccessGroupKeyName ??
        inferredCounterpartKey ??
        "default-key",
      groupAccessGroupKeyName:
        route.params.groupAccessGroupKeyName ??
        thread.RecipientInfo.AccessGroupKeyName ??
        "default-key",
    };
  }, [
    currentUser?.PublicKeyBase58Check,
    route.params.counterpartAccessGroupKeyName,
    route.params.groupAccessGroupKeyName,
    route.params.userAccessGroupKeyName,
    thread,
  ]);

  const startTimestampString = useMemo(() => {
    return (
      thread.MessageInfo.TimestampNanosString ??
      (typeof thread.MessageInfo.TimestampNanos === "number"
        ? thread.MessageInfo.TimestampNanos.toString()
        : Math.trunc(Date.now() * 1_000_000).toString())
    );
  }, [thread.MessageInfo.TimestampNanos, thread.MessageInfo.TimestampNanosString]);

  const fetchMessages = useCallback(
    async (options?: { refreshing?: boolean; shouldAbort?: () => boolean }) => {
      if (!currentUser?.PublicKeyBase58Check) {
        setMessages([]);
        setError("Sign in to view this conversation.");
        return;
      }

      if (isGroupChat && isLoadingAccessGroups && !isAccessGroupsLoaded) {
        return;
      }

      if (options?.shouldAbort?.()) {
        return;
      }

      if (options?.refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        let rawMessages: NewMessageEntryResponse[] = [];
        let profileMap: Record<string, ProfileEntryResponse | null> = {};

        if (isGroupChat) {
          const response = await getPaginatedGroupChatThread({
            UserPublicKeyBase58Check: currentUser.PublicKeyBase58Check,
            AccessGroupKeyName: groupAccessGroupKeyName ?? "default-key",
            StartTimeStampString: startTimestampString,
            MaxMessagesToFetch: MAX_MESSAGES_TO_FETCH,
          });
          rawMessages = response.GroupChatMessages ?? [];
          profileMap = response.PublicKeyToProfileEntryResponse ?? {};
        } else {
          const isSender =
            thread.SenderInfo.OwnerPublicKeyBase58Check ===
            currentUser.PublicKeyBase58Check;

          const response = await getPaginatedDMThread({
            UserGroupOwnerPublicKeyBase58Check:
              currentUser.PublicKeyBase58Check,
            UserGroupKeyName: userAccessGroupKeyName ?? "default-key",
            PartyGroupOwnerPublicKeyBase58Check: isSender
              ? thread.RecipientInfo.OwnerPublicKeyBase58Check
              : thread.SenderInfo.OwnerPublicKeyBase58Check,
            PartyGroupKeyName: counterpartAccessGroupKeyName ?? "default-key",
            StartTimeStampString: startTimestampString,
            MaxMessagesToFetch: MAX_MESSAGES_TO_FETCH,
          });
          rawMessages = response.ThreadMessages ?? [];
          profileMap = response.PublicKeyToProfileEntryResponse ?? {};
        }

        if (options?.shouldAbort?.()) {
          return;
        }

        const decrypted = await Promise.all(
          rawMessages.map(async (message, index) => {
            try {
              return await identity.decryptMessage(message, accessGroups);
            } catch (decryptError) {
              console.warn("Failed to decrypt message", decryptError);
              const fallbackIsSender =
                message.SenderInfo.OwnerPublicKeyBase58Check ===
                currentUser.PublicKeyBase58Check;
              const fallback: DecryptedMessageEntryResponse = {
                ...message,
                DecryptedMessage: "",
                IsSender: fallbackIsSender,
                error: "Unable to decrypt message",
              };
              return fallback;
            }
          })
        );

        decrypted.sort((a, b) => {
          const aTimestamp =
            nanosToMs(a.MessageInfo.TimestampNanosString ?? a.MessageInfo.TimestampNanos) ??
            0;
          const bTimestamp =
            nanosToMs(b.MessageInfo.TimestampNanosString ?? b.MessageInfo.TimestampNanos) ??
            0;
          return aTimestamp - bTimestamp;
        });

        const formatted: MessageListItem[] = decrypted.map((message, index) => {
          const senderPublicKey = message.SenderInfo.OwnerPublicKeyBase58Check;
          const senderProfile = profileMap?.[senderPublicKey] ?? null;
          const senderName =
            senderPublicKey === currentUser.PublicKeyBase58Check
              ? "You"
              : getProfileDisplayName(senderProfile, senderPublicKey);

          const timestamp = nanosToMs(
            message.MessageInfo.TimestampNanosString ??
              message.MessageInfo.TimestampNanos ??
              0
          );

          const rawText = message.DecryptedMessage?.trim?.() ?? "";

          return {
            id:
              message.MessageInfo.TimestampNanosString ??
              `${index}-${senderPublicKey}`,
            text: rawText.length > 0 ? rawText : "",
            timestamp,
            isOwn: !!message.IsSender,
            senderName,
            error:
              rawText.length > 0
                ? undefined
                : message.error?.trim?.() || undefined,
          };
        });

        setMessages(formatted);
        setError(null);
      } catch (threadError) {
        console.warn("Failed to load thread", threadError);
        setError(
          "Unable to load this conversation right now. Pull to refresh to try again."
        );
        setMessages([]);
      } finally {
        if (options?.shouldAbort?.()) {
          return;
        }

        if (options?.refreshing) {
          setIsRefreshing(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [
      accessGroups,
      counterpartAccessGroupKeyName,
      currentUser?.PublicKeyBase58Check,
      groupAccessGroupKeyName,
      isAccessGroupsLoaded,
      isGroupChat,
      isLoadingAccessGroups,
      startTimestampString,
      thread,
      userAccessGroupKeyName,
    ]
  );

  useEffect(() => {
    let isActive = true;

    void fetchMessages({ shouldAbort: () => !isActive });

    return () => {
      isActive = false;
    };
  }, [fetchMessages]);

  const handleRefresh = useCallback(() => {
    void fetchMessages({ refreshing: true });
  }, [fetchMessages]);

  const handleSend = useCallback(async () => {
    const trimmed = composerValue.trim();
    if (!trimmed || !currentUser?.PublicKeyBase58Check) {
      return;
    }

    setIsSending(true);
    try {
      const recipientPublicKey = isGroupChat
        ? thread.RecipientInfo.OwnerPublicKeyBase58Check
        : route.params.counterpartPublicKey;
      const accessGroupName = isGroupChat
        ? groupAccessGroupKeyName ?? "default-key"
        : counterpartAccessGroupKeyName ?? "default-key";

      await sendMessage({
        SenderPublicKeyBase58Check: currentUser.PublicKeyBase58Check,
        RecipientPublicKeyBase58Check: recipientPublicKey,
        Message: trimmed,
        AccessGroup: accessGroupName,
      });

      setComposerValue("");
      await fetchMessages({ refreshing: true });
    } catch (sendError) {
      console.warn("Failed to send message", sendError);
      setError("Unable to send your message. Please try again.");
    } finally {
      setIsSending(false);
    }
  }, [
    composerValue,
    counterpartAccessGroupKeyName,
    currentUser?.PublicKeyBase58Check,
    fetchMessages,
    groupAccessGroupKeyName,
    isGroupChat,
    route.params.counterpartPublicKey,
    thread,
  ]);

  const listEmptyComponent = useMemo(() => {
    if (isLoading && !isRefreshing) {
      return () => (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#000" />
        </View>
      );
    }

    return () => (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No messages yet</Text>
        <Text style={styles.emptySubtitle}>
          Send a message to start the conversation.
        </Text>
      </View>
    );
  }, [isLoading, isRefreshing]);

  const renderMessage: ListRenderItem<MessageListItem> = useCallback(
    ({ item }) => (
      <View
        style={[
          styles.messageRow,
          item.isOwn ? styles.messageRowOwn : styles.messageRowOther,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            item.isOwn ? styles.messageBubbleOwn : styles.messageBubbleOther,
          ]}
        >
          {item.text.length > 0 ? (
            <Text
              style={[
                styles.messageText,
                item.isOwn
                  ? styles.messageTextOwn
                  : styles.messageTextOther,
              ]}
            >
              {item.text}
            </Text>
          ) : (
            <Text
              style={[
                styles.messageErrorText,
                item.isOwn ? styles.messageErrorTextOwn : undefined,
              ]}
            >
              {item.error ?? ""}
            </Text>
          )}
          <Text
            style={[
              styles.messageMeta,
              item.isOwn ? styles.messageMetaOwn : styles.messageMetaOther,
            ]}
          >
            {item.isOwn ? "You" : item.senderName}
            {item.timestamp
              ? ` • ${formatMessageTimestamp(item.timestamp)}`
              : ""}
          </Text>
        </View>
      </View>
    ),
    []
  );

  const errorBanner = useMemo(() => {
    if (!error) {
      return null;
    }

    return (
      <View style={styles.errorBanner}>
        <Text style={styles.errorBannerText}>{error}</Text>
      </View>
    );
  }, [error]);

  const composerDisabled =
    isSending || composerValue.trim().length === 0 || !currentUser;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {errorBanner}
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={listEmptyComponent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#000"
            colors={["#000"]}
          />
        }
        keyboardShouldPersistTaps="handled"
      />
      <View style={styles.composerContainer}>
        <TextInput
          style={styles.composerInput}
          placeholder="Write a message"
          value={composerValue}
          onChangeText={setComposerValue}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, composerDisabled && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={composerDisabled}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 96,
    backgroundColor: "#fff",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#475569",
    textAlign: "center",
  },
  messageRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  messageRowOwn: {
    justifyContent: "flex-end",
  },
  messageRowOther: {
    justifyContent: "flex-start",
  },
  messageBubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 16,
  },
  messageBubbleOwn: {
    backgroundColor: "#2563eb",
    borderTopRightRadius: 4,
  },
  messageBubbleOther: {
    backgroundColor: "#e2e8f0",
    borderTopLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    marginBottom: 4,
  },
  messageTextOwn: {
    color: "#f8fafc",
  },
  messageTextOther: {
    color: "#0f172a",
  },
  messageErrorText: {
    color: "#dc2626",
    fontSize: 14,
    marginBottom: 4,
  },
  messageErrorTextOwn: {
    color: "#fecaca",
  },
  messageMeta: {
    fontSize: 12,
    marginTop: 4,
  },
  messageMetaOwn: {
    color: "#e0f2fe",
  },
  messageMetaOther: {
    color: "#475569",
  },
  errorBanner: {
    backgroundColor: "#fee2e2",
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
  },
  errorBannerText: {
    color: "#b91c1c",
    fontSize: 14,
    textAlign: "center",
  },
  composerContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  composerInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: "#cbd5f5",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginRight: 12,
  },
  sendButton: {
    backgroundColor: "#2563eb",
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  sendButtonDisabled: {
    backgroundColor: "#93c5fd",
  },
  sendButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    maxWidth: 260,
  },
  headerAvatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
    marginRight: 12,
    backgroundColor: "#e2e8f0",
    justifyContent: "center",
    alignItems: "center",
  },
  headerAvatarImage: {
    width: "100%",
    height: "100%",
  },
  headerAvatarFallback: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  headerAvatarFallbackText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
  },
  headerTitleText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0f172a",
  },
});
