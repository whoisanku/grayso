import { useEffect, useState, useCallback, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { identity } from 'deso-protocol';
import { getSupabaseClient, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';

export type EphemeralMessage = {
    id: string;
    senderPublicKey: string;
    decryptedContent: string;
    timestamp: number;
    conversationId: string;
    type: 'ephemeral';
};

export type EphemeralMessagePayload = {
    id: string;
    senderPublicKey: string;
    encryptedContent: string;
    timestamp: number;
    conversationId: string;
    recipientPublicKey: string;
};

export type UseEphemeralMessagesOptions = {
    conversationId: string;
    userPublicKey: string;
    recipientPublicKey: string;
    enabled?: boolean;
    onMessageReceived?: (message: EphemeralMessage) => void;
    messageLifetime?: number; // milliseconds before auto-remove
};

export type UseEphemeralMessagesReturn = {
    messages: EphemeralMessage[];
    sendMessage: (content: string) => Promise<void>;
    clearMessages: () => void;
    connectionState: 'connecting' | 'connected' | 'disconnected';
    error: Error | null;
    isSending: boolean;
};

const DEFAULT_MESSAGE_LIFETIME = 30000; // 30 seconds

const devLog = (...args: unknown[]) => {
    if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.log(...args);
    }
};

export function useEphemeralMessages({
    conversationId,
    userPublicKey,
    recipientPublicKey,
    enabled = true,
    onMessageReceived,
    messageLifetime = DEFAULT_MESSAGE_LIFETIME,
}: UseEphemeralMessagesOptions): UseEphemeralMessagesReturn {
    const [messages, setMessages] = useState<EphemeralMessage[]>([]);
    const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
    const [error, setError] = useState<Error | null>(null);
    const [isSending, setIsSending] = useState(false);

    const channelRef = useRef<RealtimeChannel | null>(null);
    const receivedMessageIdsRef = useRef<Set<string>>(new Set());
    const messageTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    // Auto-remove message after lifetime
    const scheduleMessageRemoval = useCallback((messageId: string) => {
        const timeout = setTimeout(() => {
            setMessages((prev) => prev.filter((m) => m.id !== messageId));
            messageTimeoutsRef.current.delete(messageId);
            receivedMessageIdsRef.current.delete(messageId);
        }, messageLifetime);

        messageTimeoutsRef.current.set(messageId, timeout);
    }, [messageLifetime]);

    // Clear all messages
    const clearMessages = useCallback(() => {
        // Clear all timeouts
        messageTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
        messageTimeoutsRef.current.clear();
        receivedMessageIdsRef.current.clear();
        setMessages([]);
    }, []);

    // Send ephemeral message
    const sendMessage = useCallback(async (content: string) => {
        if (!channelRef.current || !content.trim()) {
            throw new Error('Cannot send message: channel not ready or empty content');
        }

        setIsSending(true);
        setError(null);

        try {
            // Encrypt message content
            const encryptedContent = await identity.encryptMessage(
                recipientPublicKey,
                content
            );

            const payload: EphemeralMessagePayload = {
                id: uuidv4(),
                senderPublicKey: userPublicKey,
                encryptedContent,
                timestamp: Date.now(),
                conversationId,
                recipientPublicKey,
            };

            devLog('[useEphemeralMessages] Sending message:', payload.id);

            // Broadcast message
            await channelRef.current.send({
                type: 'broadcast',
                event: 'ephemeral_message',
                payload,
            });

            // Add own message to local state (optimistic update)
            const ownMessage: EphemeralMessage = {
                id: payload.id,
                senderPublicKey: userPublicKey,
                decryptedContent: content,
                timestamp: payload.timestamp,
                conversationId,
                type: 'ephemeral',
            };

            receivedMessageIdsRef.current.add(payload.id);
            setMessages((prev) => [...prev, ownMessage]);
            scheduleMessageRemoval(payload.id);

        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to send ephemeral message');
            setError(error);
            console.error('[useEphemeralMessages] Send error:', error);
            throw error;
        } finally {
            setIsSending(false);
        }
    }, [conversationId, userPublicKey, recipientPublicKey, scheduleMessageRemoval]);

    useEffect(() => {
        if (!enabled || !isSupabaseConfigured()) {
            setConnectionState('disconnected');
            return;
        }

        const supabase = getSupabaseClient();
        const channelName = `ephemeral:${conversationId}`;

        devLog('[useEphemeralMessages] Subscribing to channel:', channelName);
        setConnectionState('connecting');

        const channel = supabase.channel(channelName, {
            config: {
                broadcast: { self: false }, // Don't receive own messages via broadcast
            },
        });

        channelRef.current = channel;

        // Handle incoming ephemeral messages
        channel.on('broadcast', { event: 'ephemeral_message' }, async ({ payload }) => {
            const messagePayload = payload as EphemeralMessagePayload;

            // Deduplication check
            if (receivedMessageIdsRef.current.has(messagePayload.id)) {
                devLog('[useEphemeralMessages] Duplicate message ignored:', messagePayload.id);
                return;
            }

            // Only process messages for this conversation
            if (messagePayload.conversationId !== conversationId) {
                return;
            }

            // Only process messages intended for this user
            if (messagePayload.recipientPublicKey !== userPublicKey) {
                return;
            }

            devLog('[useEphemeralMessages] Received message:', messagePayload.id);

            try {
                // Decrypt message content
                const decryptedMessage = await identity.decryptMessage(
                    {
                        MessageInfo: {
                            EncryptedText: messagePayload.encryptedContent,
                            TimestampNanos: messagePayload.timestamp * 1e6,
                            TimestampNanosString: String(messagePayload.timestamp * 1e6),
                        },
                        SenderInfo: {
                            OwnerPublicKeyBase58Check: messagePayload.senderPublicKey,
                        },
                    } as any,
                    [] // No access groups needed for DM encryption
                );

                const ephemeralMessage: EphemeralMessage = {
                    id: messagePayload.id,
                    senderPublicKey: messagePayload.senderPublicKey,
                    decryptedContent: decryptedMessage.DecryptedMessage || '',
                    timestamp: messagePayload.timestamp,
                    conversationId: messagePayload.conversationId,
                    type: 'ephemeral',
                };

                receivedMessageIdsRef.current.add(messagePayload.id);
                setMessages((prev) => [...prev, ephemeralMessage]);
                scheduleMessageRemoval(messagePayload.id);

                // Notify callback
                onMessageReceived?.(ephemeralMessage);

            } catch (err) {
                console.error('[useEphemeralMessages] Failed to decrypt message:', err);
            }
        });

        // Subscribe to channel
        channel.subscribe((status) => {
            devLog('[useEphemeralMessages] Subscription status:', status);

            if (status === 'SUBSCRIBED') {
                setConnectionState('connected');
                setError(null);
            } else if (status === 'CHANNEL_ERROR') {
                setConnectionState('disconnected');
                setError(new Error('Failed to connect to ephemeral message channel'));
                console.error('[useEphemeralMessages] CHANNEL_ERROR - Check Supabase credentials');
            } else if (status === 'TIMED_OUT') {
                setConnectionState('disconnected');
                setError(new Error('Ephemeral message channel connection timed out'));
                console.error('[useEphemeralMessages] TIMED_OUT');
            } else if (status === 'CLOSED') {
                setConnectionState('disconnected');
                setError(new Error('Ephemeral message channel closed'));
                console.error('[useEphemeralMessages] CLOSED - Connection was closed. Check Supabase URL and key');
            }
        });

        // Cleanup
        return () => {
            devLog('[useEphemeralMessages] Cleaning up channel:', channelName);

            // Clear all message timeouts
            messageTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
            messageTimeoutsRef.current.clear();

            if (channelRef.current) {
                channelRef.current.unsubscribe();
                channelRef.current = null;
            }

            setConnectionState('disconnected');
            setMessages([]);
            receivedMessageIdsRef.current.clear();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conversationId, userPublicKey, enabled, messageLifetime]);

    return {
        messages,
        sendMessage,
        clearMessages,
        connectionState,
        error,
        isSending,
    };
}
