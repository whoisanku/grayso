import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
    ChatType,
    DecryptedMessageEntryResponse,
    PublicKeyToProfileEntryResponseMap,
    AccessGroupEntryResponse,
    NewMessageEntryResponse,
} from "deso-protocol";
import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import {
    encryptAndSendNewMessage,
    fetchPaginatedDmThreadMessages,
    fetchPaginatedGroupThreadMessages,
    decryptAccessGroupMessages,
    fetchProfilesBatch,
} from "@/features/messaging/api/conversations";
import {
    MESSAGE_PAGE_SIZE,
    DEFAULT_KEY_MESSAGING_GROUP_NAME,
} from "@/constants/messaging";
import { getDisplayedMessageText, getMessageId, normalizeAndSortMessages } from "../../../utils/messageUtils";
import { DeviceEventEmitter } from "react-native";
import { OUTGOING_MESSAGE_EVENT } from "@/constants/events";
import { StorageService } from "@/lib/storage";
import { getSupabaseClient, isSupabaseConfigured, type MessageBroadcastPayload } from "../../../lib/supabaseClient";

const messageKeys = {
    thread: (conversationId: string) => ["conversation-messages", conversationId] as const,
};

type PageParam = {
    cursor: string | null;
    beforeTimestamp: number | null;
    isInitial?: boolean;
};

type PageData = {
    messages: DecryptedMessageEntryResponse[];
    profiles: PublicKeyToProfileEntryResponseMap;
    accessGroups: AccessGroupEntryResponse[];
    nextCursor: string | null;
    nextTimestamp: number | null;
    hasMore: boolean;
};

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
    initialProfile?: any; // Profile to seed immediately
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
    initialProfile,
}: UseConversationMessagesProps) => {
    const queryClient = useQueryClient();
    const [error, setError] = useState<string | null>(null);
    const [isSendingMessage, setIsSendingMessage] = useState(false);

    const accessGroupsRef = useRef<AccessGroupEntryResponse[]>([]);
    const profileCacheRef = useRef<Map<string, string>>(new Map());
    const hydratedRef = useRef(false);

    const isGroupChat = chatType === ChatType.GROUPCHAT;
    const counterPartyPublicKey = partyGroupOwnerPublicKeyBase58Check ?? threadPublicKey;
    const recipientOwnerKey = recipientInfo?.OwnerPublicKeyBase58Check;

    const mergeMessages = useCallback(
        (
            prev: DecryptedMessageEntryResponse[],
            next: DecryptedMessageEntryResponse[]
        ) => {
            const map = new Map<string, DecryptedMessageEntryResponse>();
            const contentMap = new Map<string, number>(); // Track content+sender to detect duplicates

            const getContentKey = (message: DecryptedMessageEntryResponse) => {
                const content = message.DecryptedMessage?.trim() ?? "";
                const sender = message.SenderInfo?.OwnerPublicKeyBase58Check ?? "";
                return `${sender}:${content}`;
            };

            next.forEach((message) => {
                const timestamp =
                    message.MessageInfo?.TimestampNanosString ??
                    String(message.MessageInfo?.TimestampNanos ?? "");
                const senderKey =
                    message.SenderInfo?.OwnerPublicKeyBase58Check ?? "unknown-sender";
                const uniqueKey = `${timestamp}-${senderKey}`;

                const contentKey = getContentKey(message);
                const msgTimestamp = message.MessageInfo?.TimestampNanos ?? 0;
                const existingTimestamp = contentMap.get(contentKey);

                if (!existingTimestamp || Math.abs(msgTimestamp - existingTimestamp) > 60000 * 1e6) {
                    map.set(uniqueKey, message);
                    contentMap.set(contentKey, msgTimestamp);
                }
            });

            prev.forEach((message) => {
                const timestamp =
                    message.MessageInfo?.TimestampNanosString ??
                    String(message.MessageInfo?.TimestampNanos ?? "");
                const senderKey =
                    message.SenderInfo?.OwnerPublicKeyBase58Check ?? "unknown-sender";
                const uniqueKey = `${timestamp}-${senderKey}`;

                if (map.has(uniqueKey)) return;

                const contentKey = getContentKey(message);
                const msgTimestamp = message.MessageInfo?.TimestampNanos ?? 0;
                const existingTimestamp = contentMap.get(contentKey);

                if (existingTimestamp && Math.abs(msgTimestamp - existingTimestamp) < 60000 * 1e6) {
                    return;
                }

                const isDuplicate = Array.from(map.values()).some((existing) => {
                    const timeDiff = Math.abs(
                        (existing.MessageInfo?.TimestampNanos ?? 0) -
                        (message.MessageInfo?.TimestampNanos ?? 0)
                    );
                    return (
                        existing.DecryptedMessage === message.DecryptedMessage &&
                        existing.SenderInfo?.OwnerPublicKeyBase58Check ===
                        message.SenderInfo?.OwnerPublicKeyBase58Check &&
                        timeDiff < 5000 * 1e6
                    );
                });

                if (!isDuplicate) {
                    map.set(uniqueKey, message);
                    contentMap.set(contentKey, msgTimestamp);
                }
            });

            const sorted = normalizeAndSortMessages(Array.from(map.values()));
            return sorted.reverse();
        },
        []
    );

    const fetchPage = useCallback(
        async ({ cursor, beforeTimestamp, isInitial }: PageParam): Promise<PageData> => {
            setError(null);
            const nowNanos = Date.now() * 1_000_000;
            const paginationTimestamp = beforeTimestamp ?? nowNanos;

            let result:
                | Awaited<ReturnType<typeof fetchPaginatedDmThreadMessages>>
                | Awaited<ReturnType<typeof fetchPaginatedGroupThreadMessages>>;

            if (isGroupChat) {
                const groupOwnerPublicKey =
                    recipientOwnerKey ??
                    partyGroupOwnerPublicKeyBase58Check ??
                    counterPartyPublicKey ??
                    userPublicKey;

                const payload = {
                    UserPublicKeyBase58Check: groupOwnerPublicKey,
                    AccessGroupKeyName: threadAccessGroupKeyName,
                    MaxMessagesToFetch: MESSAGE_PAGE_SIZE,
                    StartTimeStamp: paginationTimestamp,
                    StartTimeStampString: String(paginationTimestamp),
                } as const;

                result = await fetchPaginatedGroupThreadMessages(
                    payload,
                    accessGroupsRef.current,
                    userPublicKey,
                    {
                        afterCursor: cursor,
                        limit: MESSAGE_PAGE_SIZE,
                        recipientAccessGroupOwnerPublicKey: groupOwnerPublicKey,
                    }
                );
            } else {
                const payload = {
                    UserGroupOwnerPublicKeyBase58Check: userPublicKey,
                    UserGroupKeyName: userAccessGroupKeyName,
                    PartyGroupOwnerPublicKeyBase58Check: counterPartyPublicKey,
                    PartyGroupKeyName: threadAccessGroupKeyName,
                    MaxMessagesToFetch: MESSAGE_PAGE_SIZE,
                    StartTimeStamp: paginationTimestamp,
                    StartTimeStampString: String(paginationTimestamp),
                } as const;

                result = await fetchPaginatedDmThreadMessages(
                    payload,
                    accessGroupsRef.current,
                    {
                        afterCursor: cursor,
                        limit: MESSAGE_PAGE_SIZE,
                        fallbackBeforeTimestampNanos: cursor ? paginationTimestamp : undefined,
                    }
                );
            }

            const decryptedMessages = result.decrypted.filter(
                (msg): msg is DecryptedMessageEntryResponse => Boolean(msg)
            );

            accessGroupsRef.current = result.updatedAllAccessGroups;

            const profilesMap: PublicKeyToProfileEntryResponseMap = {
                ...(result.publicKeyToProfileEntryResponseMap ?? {}),
            };

            // Ensure we have profile metadata for every sender/receiver in this page
            const missingKeys = new Set<string>();
            decryptedMessages.forEach((msg) => {
                const sender = msg.SenderInfo?.OwnerPublicKeyBase58Check;
                const recipient = msg.RecipientInfo?.OwnerPublicKeyBase58Check;
                [sender, recipient].forEach((pk) => {
                    if (!pk) return;
                    if (profilesMap[pk]) return;
                    if (profileCacheRef.current.has(pk)) return;
                    missingKeys.add(pk);
                });
            });

            if (missingKeys.size > 0) {
                const fetchedProfiles = await fetchProfilesBatch(Array.from(missingKeys));
                Object.assign(profilesMap, fetchedProfiles);
                Array.from(missingKeys).forEach((pk) => {
                    profileCacheRef.current.set(pk, "fetched");
                });
            }

            const merged = mergeMessages([], decryptedMessages);

            const nonEditMessages = merged.filter(msg => {
                const extraData = msg.MessageInfo?.ExtraData as Record<string, any> | undefined;
                const hasEditedMessageId = extraData?.editedMessageId != null;
                const isEdited = extraData?.edited === "true";
                return !hasEditedMessageId && !isEdited;
            });

            const sortedByOldest = [...nonEditMessages].sort(
                (a, b) => (a.MessageInfo?.TimestampNanos ?? 0) - (b.MessageInfo?.TimestampNanos ?? 0)
            );

            const oldest = sortedByOldest[0]?.MessageInfo?.TimestampNanos ?? null;

            let nextCursor = result.pageInfo?.endCursor ?? null;
            let nextHasMore = Boolean(result.pageInfo?.hasNextPage && nextCursor);

            if (!nextHasMore && decryptedMessages.length === MESSAGE_PAGE_SIZE) {
                nextHasMore = true;
                if (!nextCursor) {
                    nextCursor =
                        decryptedMessages[decryptedMessages.length - 1]?.MessageInfo
                            ?.TimestampNanosString ?? null;
                }
            }

            return {
                messages: merged,
                profiles: profilesMap,
                accessGroups: accessGroupsRef.current,
                nextCursor,
                nextTimestamp: oldest,
                hasMore: nextHasMore,
            };
        },
        [
            counterPartyPublicKey,
            isGroupChat,
            mergeMessages,
            partyGroupOwnerPublicKeyBase58Check,
            recipientOwnerKey,
            threadAccessGroupKeyName,
            userAccessGroupKeyName,
            userPublicKey,
        ]
    );

    const initialPageParam: PageParam = { cursor: null, beforeTimestamp: null, isInitial: true };

    const {
        data,
        isLoading: queryLoading,
        isFetchingNextPage,
        fetchNextPage,
        refetch,
        isRefetching,
    } = useInfiniteQuery<PageData, Error, InfiniteData<PageData, PageParam>, ReturnType<typeof messageKeys.thread>, PageParam>({
        queryKey: messageKeys.thread(conversationId),
        queryFn: ({ pageParam }) =>
            fetchPage(
                (pageParam as PageParam) ?? initialPageParam
            ),
        getNextPageParam: (lastPage) =>
            lastPage.hasMore
                ? {
                    cursor: lastPage.nextCursor,
                    beforeTimestamp: lastPage.nextTimestamp,
                    isInitial: false,
                } as PageParam
                : undefined,
        initialPageParam,
        staleTime: 1000 * 30,
    });

    const profiles = useMemo(() => {
        const baseProfiles = data?.pages?.reduce<PublicKeyToProfileEntryResponseMap>((acc, page) => {
            return { ...acc, ...page.profiles };
        }, {}) ?? {};
        
        // Seed with initialProfile to avoid loading delay
        if (initialProfile && counterPartyPublicKey) {
            return { [counterPartyPublicKey]: initialProfile, ...baseProfiles };
        }
        
        return baseProfiles;
    }, [data?.pages, initialProfile, counterPartyPublicKey]);

    const messages = useMemo(() => {
        if (!data?.pages) return [];
        return data.pages.reduce<DecryptedMessageEntryResponse[]>((acc, page) => {
            return mergeMessages(acc, page.messages);
        }, []);
    }, [data?.pages, mergeMessages]);

    const hasMore = data?.pages?.[data.pages.length - 1]?.hasMore ?? false;
    const isLoading = queryLoading && !isRefetching && !isFetchingNextPage;
    const isRefreshing = isRefetching;

    // Hydrate from local storage once
    useEffect(() => {
        if (hydratedRef.current) return;
        hydratedRef.current = true;

        (async () => {
            const cached = await StorageService.getChatHistory(conversationId);
            if (cached && Array.isArray(cached) && cached.length > 0) {
                const normalized = normalizeAndSortMessages(
                    cached as DecryptedMessageEntryResponse[]
                ).reverse();
                const oldest =
                    normalized[normalized.length - 1]?.MessageInfo?.TimestampNanos ?? null;

                queryClient.setQueryData(messageKeys.thread(conversationId), {
                    pageParams: [{ cursor: null, beforeTimestamp: null, isInitial: true }],
                    pages: [
                        {
                            messages: normalized,
                            profiles: {},
                            accessGroups: [],
                            nextCursor: null,
                            nextTimestamp: oldest,
                            hasMore: true,
                        } as PageData,
                    ],
                });
            }
        })();
    }, [conversationId, queryClient]);

    // Persist messages to local storage
    useEffect(() => {
        if (messages.length > 0) {
            StorageService.saveChatHistory(conversationId, messages);
        }
    }, [conversationId, messages]);

    const setMessagesSafe = useCallback(
        (
            updater:
                | DecryptedMessageEntryResponse[]
                | ((
                    prev: DecryptedMessageEntryResponse[]
                ) => DecryptedMessageEntryResponse[])
        ) => {
            queryClient.setQueryData(messageKeys.thread(conversationId), (oldData: any) => {
                if (!oldData) {
                    const nextMessages =
                        typeof updater === "function"
                            ? updater([])
                            : updater;
                    return {
                        pageParams: [{ cursor: null, beforeTimestamp: null, isInitial: true }],
                        pages: [
                            {
                                messages: nextMessages,
                                profiles: {},
                                accessGroups: accessGroupsRef.current,
                                nextCursor: null,
                                nextTimestamp: nextMessages[nextMessages.length - 1]?.MessageInfo?.TimestampNanos ?? null,
                                hasMore: true,
                            } as PageData,
                        ],
                    };
                }

                const current = oldData.pages.reduce(
                    (acc: DecryptedMessageEntryResponse[], page: PageData) =>
                        mergeMessages(acc, page.messages),
                    []
                );
                const next =
                    typeof updater === "function"
                        ? updater(current)
                        : updater;

                const firstPage: PageData = {
                    ...(oldData.pages[0] as PageData),
                    messages: next,
                    profiles: (oldData.pages[0] as PageData).profiles,
                    accessGroups: accessGroupsRef.current,
                    nextTimestamp:
                        next[next.length - 1]?.MessageInfo?.TimestampNanos ?? null,
                };

                return {
                    ...oldData,
                    pages: [firstPage, ...(oldData.pages.slice(1) as PageData[])],
                };
            });
        },
        [conversationId, mergeMessages, queryClient]
    );

    const loadMessages = useCallback(
        async (initial = false, isPullToRefresh = false) => {
            try {
                if (initial || isPullToRefresh) {
                    await refetch();
                } else if (hasMore) {
                    await fetchNextPage();
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load messages");
            }
        },
        [fetchNextPage, hasMore, refetch]
    );

    const handleComposerMessageSent = useCallback(
        (messageText: string, extraData?: Record<string, any>) => {
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
                    extraData,
                });
                return;
            }
            const optimisticMessage = {
                DecryptedMessage: messageText,
                IsSender: true,
                MessageInfo: {
                    TimestampNanos: timestampNanos,
                    TimestampNanosString: String(timestampNanos),
                    ExtraData: extraData,
                },
                SenderInfo: {
                    OwnerPublicKeyBase58Check: userPublicKey,
                },
                ChatType: chatType,
            } as DecryptedMessageEntryResponse;

            setMessagesSafe((prev) => mergeMessages(prev, [optimisticMessage]));
        },
        [
            chatType,
            conversationId,
            counterPartyPublicKey,
            mergeMessages,
            threadAccessGroupKeyName,
            userAccessGroupKeyName,
            userPublicKey,
        ]
    );

    // Subscribe to Supabase broadcasts for instant message delivery
    useEffect(() => {
        if (!isSupabaseConfigured()) {
            return;
        }

        const supabase = getSupabaseClient();
        const channelName = `messages-${conversationId}`;

        const channel = supabase.channel(channelName, {
            config: {
                broadcast: { self: false },
            },
        });

        channel.on("broadcast", { event: "message" }, async ({ payload }) => {
            const messagePayload = payload as MessageBroadcastPayload;

            if (messagePayload.conversationId !== conversationId) {
                return;
            }

            if (messagePayload.is_typing !== undefined) {
                return;
            }

            const encryptedMessage: NewMessageEntryResponse = {
                ChatType: messagePayload.metadata?.chatType as ChatType || ChatType.DM,
                SenderInfo: {
                    OwnerPublicKeyBase58Check: messagePayload.senderPublicKey || "",
                    AccessGroupPublicKeyBase58Check: messagePayload.SenderAccessGroupPublicKeyBase58Check || "",
                    AccessGroupKeyName: messagePayload.SenderAccessGroupKeyName || "",
                },
                RecipientInfo: {
                    OwnerPublicKeyBase58Check: (messagePayload.recipients && messagePayload.recipients[0]) || "",
                    AccessGroupPublicKeyBase58Check: messagePayload.RecipientAccessGroupPublicKeyBase58Check || "",
                    AccessGroupKeyName: messagePayload.RecipientAccessGroupKeyName || "",
                },
                MessageInfo: {
                    EncryptedText: messagePayload.EncryptedMessageText || "",
                    TimestampNanos: Number(messagePayload.timestampNanos || Date.now() * 1e6),
                    TimestampNanosString: messagePayload.timestampNanos?.toString() || "",
                    ExtraData: messagePayload.ExtraData || {},
                },
            };

            try {
                const [decryptedMessage] = await decryptAccessGroupMessages(
                    [encryptedMessage],
                    accessGroupsRef.current
                );

                if (decryptedMessage) {
                    setMessagesSafe((prev) => mergeMessages(prev, [decryptedMessage]));
                }
            } catch (err) {
                console.error("Failed to decrypt broadcast message:", err);
            }
        });

        channel.subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [
        conversationId,
        mergeMessages,
    ]);

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
        setMessages: setMessagesSafe,
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
        isFetchingNextPage,
    };
};
