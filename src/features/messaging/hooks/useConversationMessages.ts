import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
    ChatType,
    DecryptedMessageEntryResponse,
    PublicKeyToProfileEntryResponseMap,
    AccessGroupEntryResponse,
} from "deso-protocol";
import {
    encryptAndSendNewMessage,
    fetchPaginatedDmThreadMessages,
    fetchPaginatedGroupThreadMessages,
} from "../services/conversations";
import {
    AUTO_LOAD_DELAY_MS,
    MESSAGE_PAGE_SIZE,
    SCROLL_PAGINATION_TRIGGER,
    DEFAULT_KEY_MESSAGING_GROUP_NAME,
} from "../constants/messaging";
import { getDisplayedMessageText, getMessageId, normalizeAndSortMessages } from "../utils/messageUtils";
import { DeviceEventEmitter } from "react-native";
import { OUTGOING_MESSAGE_EVENT } from "../constants/events";
import { StorageService } from "../../../services/storage";

type UseConversationMessagesProps = {
    threadPublicKey: string;
    chatType: ChatType;
    userPublicKey: string;
    threadAccessGroupKeyName?: string;
    userAccessGroupKeyName?: string;
    partyGroupOwnerPublicKeyBase58Check?: string;
    lastTimestampNanos?: number;
    recipientInfo?: any;
    conversationId: string;
};

export const useConversationMessages = ({
    threadPublicKey,
    chatType,
    userPublicKey,
    threadAccessGroupKeyName = DEFAULT_KEY_MESSAGING_GROUP_NAME,
    userAccessGroupKeyName = DEFAULT_KEY_MESSAGING_GROUP_NAME,
    partyGroupOwnerPublicKeyBase58Check,
    lastTimestampNanos,
    recipientInfo,
    conversationId,
}: UseConversationMessagesProps) => {
    // Initialize messages with empty array, load from cache asynchronously
    const [messages, setMessages] = useState<DecryptedMessageEntryResponse[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [profiles, setProfiles] = useState<PublicKeyToProfileEntryResponseMap>({});
    const [isSendingMessage, setIsSendingMessage] = useState(false);

    const accessGroupsRef = useRef<AccessGroupEntryResponse[]>([]);
    const paginationCursorRef = useRef<string | null>(null);
    const hasMoreRef = useRef(true);
    const isLoadingRef = useRef(false);
    const oldestTimestampRef = useRef<number | null>(null);
    const profileCacheRef = useRef<Map<string, string>>(new Map()); // In-memory profile image cache

    const isGroupChat = chatType === ChatType.GROUPCHAT;
    const counterPartyPublicKey = partyGroupOwnerPublicKeyBase58Check ?? threadPublicKey;
    const recipientOwnerKey = recipientInfo?.OwnerPublicKeyBase58Check;

    const mergeMessages = useCallback(
        (
            prev: DecryptedMessageEntryResponse[],
            next: DecryptedMessageEntryResponse[]
        ) => {
            const map = new Map<string, DecryptedMessageEntryResponse>();

            // Add new messages first (source of truth)
            next.forEach((message) => {
                const timestamp =
                    message.MessageInfo?.TimestampNanosString ??
                    String(message.MessageInfo?.TimestampNanos ?? "");
                const senderKey =
                    message.SenderInfo?.OwnerPublicKeyBase58Check ?? "unknown-sender";
                const uniqueKey = `${timestamp}-${senderKey}`;
                map.set(uniqueKey, message);
            });

            // Merge previous messages, checking for duplicates
            prev.forEach((message) => {
                const timestamp =
                    message.MessageInfo?.TimestampNanosString ??
                    String(message.MessageInfo?.TimestampNanos ?? "");
                const senderKey =
                    message.SenderInfo?.OwnerPublicKeyBase58Check ?? "unknown-sender";
                const uniqueKey = `${timestamp}-${senderKey}`;

                if (map.has(uniqueKey)) return;

                // Fuzzy duplicate check for optimistic messages
                const isDuplicate = Array.from(map.values()).some((existing) => {
                    const timeDiff = Math.abs(
                        (existing.MessageInfo?.TimestampNanos ?? 0) -
                        (message.MessageInfo?.TimestampNanos ?? 0)
                    );
                    return (
                        existing.DecryptedMessage === message.DecryptedMessage &&
                        existing.SenderInfo?.OwnerPublicKeyBase58Check ===
                        message.SenderInfo?.OwnerPublicKeyBase58Check &&
                        timeDiff < 5000 * 1e6 // 5 seconds
                    );
                });

                if (!isDuplicate) {
                    map.set(uniqueKey, message);
                }
            });

            return normalizeAndSortMessages(Array.from(map.values()));
        },
        []
    );

    const loadMessages = useCallback(
        async (initial = false, isPullToRefresh = false) => {
            // Prevent concurrent requests with better debouncing
            if (isLoadingRef.current || (!initial && !hasMoreRef.current)) {
                return;
            }

            isLoadingRef.current = true;
            if (initial) {
                if (isPullToRefresh) {
                    setIsRefreshing(true);
                } else {
                    setIsLoading(true);
                }
                paginationCursorRef.current = null;
                hasMoreRef.current = true;
                setHasMore(true);
            } else {
                setIsLoading(true);
            }

            setError(null);

            try {
                let pageInfo: {
                    hasNextPage: boolean;
                    endCursor: string | null;
                } | null = null;
                let result:
                    | Awaited<ReturnType<typeof fetchPaginatedDmThreadMessages>>
                    | Awaited<ReturnType<typeof fetchPaginatedGroupThreadMessages>>;

                // Calculate the correct timestamp to use for pagination
                // If initial load, use current time (latest)
                // If pagination, use the oldest loaded message's timestamp
                const nowMs = Date.now();
                const currentTimestampNanos = nowMs * 1_000_000;

                // For pagination, we want to fetch messages OLDER than our oldest current message
                const paginationTimestamp = !initial && oldestTimestampRef.current
                    ? oldestTimestampRef.current
                    : currentTimestampNanos;

                if (isGroupChat) {
                    const groupOwnerPublicKey =
                        recipientOwnerKey ??
                        partyGroupOwnerPublicKeyBase58Check ??
                        counterPartyPublicKey ??
                        userPublicKey;

                    console.log('🔍 [GROUP CHAT FETCH DEBUG]', {
                        initial,
                        currentTime: new Date().toISOString(),
                        timestampUsed: paginationTimestamp,
                        timestampDate: new Date(paginationTimestamp / 1_000_000).toISOString(),
                        cursor: initial ? null : paginationCursorRef.current,
                        pageSize: MESSAGE_PAGE_SIZE,
                    });

                    const payload = {
                        UserPublicKeyBase58Check: groupOwnerPublicKey,
                        AccessGroupKeyName: threadAccessGroupKeyName,
                        MaxMessagesToFetch: MESSAGE_PAGE_SIZE,
                        StartTimeStamp: paginationTimestamp,
                        StartTimeStampString: String(paginationTimestamp),
                    } as const;

                    const groupResult = await fetchPaginatedGroupThreadMessages(
                        payload,
                        accessGroupsRef.current,
                        userPublicKey,
                        {
                            afterCursor: initial ? null : paginationCursorRef.current,
                            limit: MESSAGE_PAGE_SIZE,
                            recipientAccessGroupOwnerPublicKey: groupOwnerPublicKey,
                        }
                    );

                    console.log('📦 [GROUP CHAT FETCH RESULT]', {
                        messagesCount: groupResult.decrypted.length,
                        firstMessageTime: groupResult.decrypted[0]?.MessageInfo?.TimestampNanos
                            ? new Date(groupResult.decrypted[0].MessageInfo.TimestampNanos / 1_000_000).toISOString()
                            : 'N/A',
                        lastMessageTime: groupResult.decrypted[groupResult.decrypted.length - 1]?.MessageInfo?.TimestampNanos
                            ? new Date(groupResult.decrypted[groupResult.decrypted.length - 1].MessageInfo.TimestampNanos / 1_000_000).toISOString()
                            : 'N/A',
                        hasNextPage: groupResult.pageInfo.hasNextPage,
                        endCursor: groupResult.pageInfo.endCursor,
                    });

                    result = groupResult;
                    pageInfo = groupResult.pageInfo;
                } else {
                    console.log('🔍 [DM FETCH DEBUG]', {
                        initial,
                        currentTime: new Date().toISOString(),
                        timestampUsed: paginationTimestamp,
                        timestampDate: new Date(paginationTimestamp / 1_000_000).toISOString(),
                        cursor: initial ? null : paginationCursorRef.current,
                        pageSize: MESSAGE_PAGE_SIZE,
                    });

                    const payload = {
                        UserGroupOwnerPublicKeyBase58Check: userPublicKey,
                        UserGroupKeyName: userAccessGroupKeyName,
                        PartyGroupOwnerPublicKeyBase58Check: counterPartyPublicKey,
                        PartyGroupKeyName: threadAccessGroupKeyName,
                        MaxMessagesToFetch: MESSAGE_PAGE_SIZE,
                        StartTimeStamp: paginationTimestamp,
                        StartTimeStampString: String(paginationTimestamp),
                    } as const;

                    const dmResult = await fetchPaginatedDmThreadMessages(
                        payload,
                        accessGroupsRef.current,
                        {
                            afterCursor: initial ? null : paginationCursorRef.current,
                            limit: MESSAGE_PAGE_SIZE,
                            fallbackBeforeTimestampNanos: !initial ? paginationTimestamp : undefined,
                        }
                    );

                    console.log('📦 [DM FETCH RESULT]', {
                        messagesCount: dmResult.decrypted.length,
                        firstMessageTime: dmResult.decrypted[0]?.MessageInfo?.TimestampNanos
                            ? new Date(dmResult.decrypted[0].MessageInfo.TimestampNanos / 1_000_000).toISOString()
                            : 'N/A',
                        lastMessageTime: dmResult.decrypted[dmResult.decrypted.length - 1]?.MessageInfo?.TimestampNanos
                            ? new Date(dmResult.decrypted[dmResult.decrypted.length - 1].MessageInfo.TimestampNanos / 1_000_000).toISOString()
                            : 'N/A',
                        hasNextPage: dmResult.pageInfo.hasNextPage,
                        endCursor: dmResult.pageInfo.endCursor,
                    });

                    result = dmResult;
                    pageInfo = dmResult.pageInfo;
                }

                const decryptedMessages = result.decrypted.filter(
                    (msg): msg is DecryptedMessageEntryResponse => Boolean(msg)
                );

                setMessages((prev) => {
                    const nextMessages = initial
                        ? normalizeAndSortMessages([...decryptedMessages])
                        : mergeMessages(prev, decryptedMessages);

                    // Filter out edit messages when calculating oldest timestamp
                    // We need to find the oldest "real" message to use as the cursor for the next fetch
                    const nonEditMessages = nextMessages.filter(msg => {
                        const extraData = msg.MessageInfo?.ExtraData as Record<string, any> | undefined;
                        const hasEditedMessageId = extraData?.editedMessageId != null;
                        const isEdited = extraData?.edited === 'true';
                        return !hasEditedMessageId && !isEdited; // Keep only non-edit messages
                    });

                    // Sort by timestamp descending to ensure we get the oldest one at the end
                    nonEditMessages.sort((a, b) =>
                        (b.MessageInfo?.TimestampNanos ?? 0) - (a.MessageInfo?.TimestampNanos ?? 0)
                    );

                    let oldest =
                        nonEditMessages[nonEditMessages.length - 1]?.MessageInfo
                            ?.TimestampNanos ?? null;

                    // Fallback: If we only have edit messages (unlikely but possible),
                    // we must use the oldest message we have to ensure pagination progresses.
                    if (!oldest && nextMessages.length > 0) {
                        const sortedAll = [...nextMessages].sort((a, b) =>
                            (b.MessageInfo?.TimestampNanos ?? 0) - (a.MessageInfo?.TimestampNanos ?? 0)
                        );
                        oldest = sortedAll[sortedAll.length - 1]?.MessageInfo?.TimestampNanos ?? null;
                    }

                    if (oldest) {
                        oldestTimestampRef.current = oldest;
                    }

                    // Cache messages synchronously to MMKV
                    StorageService.saveChatHistory(conversationId, nextMessages);

                    return nextMessages;
                });

                // Auto-load more if content doesn't fill screen (with longer delay)
                if (initial && decryptedMessages.length === MESSAGE_PAGE_SIZE && hasMoreRef.current) {
                    setTimeout(() => {
                        if (!isLoadingRef.current && hasMoreRef.current) {
                            loadMessages(false);
                        }
                    }, AUTO_LOAD_DELAY_MS * 2); // Double delay for stability
                }

                accessGroupsRef.current = result.updatedAllAccessGroups;

                if (result.publicKeyToProfileEntryResponseMap) {
                    setProfiles((prev) => ({
                        ...prev,
                        ...result.publicKeyToProfileEntryResponseMap,
                    }));
                }

                let nextCursor = pageInfo?.endCursor ?? paginationCursorRef.current;
                let nextHasMore = Boolean(pageInfo?.hasNextPage && nextCursor);

                if (!nextHasMore && decryptedMessages.length === MESSAGE_PAGE_SIZE) {
                    nextHasMore = true;
                    if (!nextCursor) {
                        nextCursor =
                            decryptedMessages[decryptedMessages.length - 1]?.MessageInfo
                                ?.TimestampNanosString ?? null;
                    }
                }

                paginationCursorRef.current = nextCursor ?? null;
                hasMoreRef.current = Boolean(nextHasMore && paginationCursorRef.current);
                setHasMore(hasMoreRef.current);

            } catch (err) {
                setError(
                    err instanceof Error ? err.message : "Failed to load messages"
                );
            } finally {
                isLoadingRef.current = false;
                setIsLoading(false);
                setIsRefreshing(false);
            }
        },
        [
            counterPartyPublicKey,
            isGroupChat,
            lastTimestampNanos,
            partyGroupOwnerPublicKeyBase58Check,
            mergeMessages,
            threadAccessGroupKeyName,
            userAccessGroupKeyName,
            userPublicKey,
            recipientOwnerKey,
        ]
    );

    const handleComposerMessageSent = useCallback(
        (messageText: string) => {
            const timestampNanos = Math.round(Date.now() * 1e6);
            if (messageText.trim() === "🚀") {
                DeviceEventEmitter.emit(OUTGOING_MESSAGE_EVENT, {
                    conversationId,
                    messageText,
                    timestampNanos,
                    chatType,
                    threadPublicKey: counterPartyPublicKey,
                    threadAccessGroupKeyName,
                    userAccessGroupKeyName,
                });
                return;
            }
            const optimisticMessage = {
                DecryptedMessage: messageText,
                IsSender: true,
                MessageInfo: {
                    TimestampNanos: timestampNanos,
                    TimestampNanosString: String(timestampNanos),
                },
                SenderInfo: {
                    OwnerPublicKeyBase58Check: userPublicKey,
                },
                ChatType: chatType,
            } as DecryptedMessageEntryResponse;

            setMessages((prev) => {
                const updated = mergeMessages(prev, [optimisticMessage]);
                // Cache optimistic message immediately
                StorageService.saveChatHistory(conversationId, updated);
                return updated;
            });
        },
        [chatType, mergeMessages, userPublicKey, conversationId, counterPartyPublicKey, threadAccessGroupKeyName, userAccessGroupKeyName]
    );

    useEffect(() => {
        let isMounted = true;

        const bootstrap = async () => {
            setMessages([]);
            setHasMore(true);
            setError(null);
            setIsLoading(true);
            setIsRefreshing(false);

            accessGroupsRef.current = [];
            paginationCursorRef.current = null;
            hasMoreRef.current = true;
            isLoadingRef.current = false;

            // Fetch fresh messages from network immediately
            try {
                await loadMessages(true, false);
            } catch (err) {
                if (isMounted) {
                    setError(
                        err instanceof Error ? err.message : "Failed to load messages"
                    );
                }
            }
        };

        bootstrap();

        return () => {
            isMounted = false;
        };
    }, [
        counterPartyPublicKey,
        userPublicKey,
        chatType,
        threadAccessGroupKeyName,
        conversationId,
    ]);

    // Create a lookup map for fast message retrieval by ID
    const messageIdMap = useMemo(() => {
        const map = new Map<string, DecryptedMessageEntryResponse>();
        messages.forEach((m) => {
            if (m.MessageInfo?.TimestampNanosString) {
                map.set(m.MessageInfo.TimestampNanosString, m);
            }
        });
        return map;
    }, [messages]);

    return {
        messages,
        setMessages,
        isLoading,
        isRefreshing,
        hasMore,
        error,
        profiles,
        isSendingMessage,
        setIsSendingMessage,
        loadMessages,
        handleComposerMessageSent,
        messageIdMap,
        mergeMessages,
        profileCacheRef,
    };
};
