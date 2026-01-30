import { useEffect, useState, useCallback, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured, getBroadcastChannel, MessageBroadcastPayload } from '../../../lib/supabaseClient';

export type PresenceState = {
    [key: string]: {
        publicKey: string;
        timestamp: number;
        conversationId: string;
    }[];
};

export type UsePresenceOptions = {
    conversationId: string;
    userPublicKey: string;
    enabled?: boolean;
};

export type UsePresenceReturn = {
    onlineUsers: string[]; // Array of public keys
    isOnline: (publicKey: string) => boolean;
    connectionState: 'connecting' | 'connected' | 'disconnected';
    error: Error | null;
    typingUsers: Record<string, boolean>;
};

const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const PRESENCE_TIMEOUT = 45000; // 45 seconds - consider offline if no heartbeat

const devLog = (...args: unknown[]) => {
    if (process.env.NODE_ENV !== "production") {
         
        console.log(...args);
    }
};

export function usePresence({
    conversationId,
    userPublicKey,
    enabled = true,
}: UsePresenceOptions): UsePresenceReturn {
    const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
    const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
    const [error, setError] = useState<Error | null>(null);

    const channelRef = useRef<RealtimeChannel | null>(null);
    const heartbeatIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const presenceStateRef = useRef<PresenceState>({});

    // Update online users from presence state
    const updateOnlineUsers = useCallback(() => {
        const now = Date.now();
        const online = new Set<string>();

        devLog('[usePresence] updateOnlineUsers - raw state:', JSON.stringify(presenceStateRef.current, null, 2));

        Object.entries(presenceStateRef.current).forEach(([key, presences]) => {
            devLog('[usePresence] Key:', key, 'Presences:', JSON.stringify(presences, null, 2));
            presences.forEach((presence: any) => {
                devLog('[usePresence] Processing presence:', JSON.stringify(presence, null, 2));

                // Supabase presence structure: presence is the actual data object
                const publicKey = presence.publicKey || presence.user_id || key;
                const timestamp = presence.timestamp || Date.now();

                // Only consider users online if their last heartbeat was within timeout
                if (now - timestamp < PRESENCE_TIMEOUT) {
                    online.add(publicKey);
                    devLog('[usePresence] Added online user:', publicKey);
                } else {
                    devLog('[usePresence] User timed out:', publicKey, 'age:', now - timestamp);
                }
            });
        });

        const newOnlineUsers = Array.from(online);
        devLog('[usePresence] Final online users:', newOnlineUsers);

        setOnlineUsers(prev => {
            // Deep comparison to prevent unnecessary re-renders
            if (prev.length !== newOnlineUsers.length) return newOnlineUsers;
            const sortedPrev = [...prev].sort();
            const sortedNew = [...newOnlineUsers].sort();
            const hasChanged = sortedPrev.some((user, index) => user !== sortedNew[index]);
            return hasChanged ? newOnlineUsers : prev;
        });
    }, []);

    const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
    const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    // Listen for typing events
    useEffect(() => {
        if (!userPublicKey || !conversationId) return;

        const channel = getBroadcastChannel(conversationId);

        const handleBroadcast = (payload: any) => {
            const messagePayload = payload.payload as MessageBroadcastPayload;

            // Handle typing events
            if (messagePayload.senderPublicKey && messagePayload.is_typing !== undefined) {
                const senderKey = messagePayload.senderPublicKey;
                const isTyping = messagePayload.is_typing;

                // Don't show typing indicator for self
                if (senderKey === userPublicKey) return;

                setTypingUsers(prev => ({
                    ...prev,
                    [senderKey]: isTyping
                }));

                // Clear existing timeout for this user
                if (typingTimeoutsRef.current[senderKey]) {
                    clearTimeout(typingTimeoutsRef.current[senderKey]);
                }

                // If typing started, set a timeout to auto-clear it (fallback)
                if (isTyping) {
                    typingTimeoutsRef.current[senderKey] = setTimeout(() => {
                        setTypingUsers(prev => ({
                            ...prev,
                            [senderKey]: false
                        }));
                    }, 5000); // Auto-clear after 5 seconds of no updates
                }
            }
        };

        channel.on('broadcast', { event: 'typing' }, handleBroadcast);

        // Cleanup timeouts on unmount
        return () => {
            Object.values(typingTimeoutsRef.current).forEach(timeout => clearTimeout(timeout));
        };
    }, [conversationId, userPublicKey]);

    // Broadcast presence
    const broadcastPresence = useCallback(async () => {
        if (!channelRef.current) return;

        try {
            await channelRef.current.track({
                publicKey: userPublicKey,
                timestamp: Date.now(),
                conversationId,
            });
        } catch (err) {
            console.error('[usePresence] Failed to broadcast presence:', err);
        }
    }, [userPublicKey, conversationId]);

    useEffect(() => {
        if (!enabled || !isSupabaseConfigured()) {
            setConnectionState('disconnected');
            return;
        }

        const supabase = getSupabaseClient();
        const channelName = `presence:${conversationId}`;

        devLog('[usePresence] Subscribing to channel:', channelName);
        devLog('[usePresence] Supabase configured:', isSupabaseConfigured());
        setConnectionState('connecting');

        const channel = supabase.channel(channelName, {
            config: {
                presence: {
                    // Don't specify a key - let Supabase generate unique keys
                    // This allows multiple users to be tracked separately
                },
            },
        });

        channelRef.current = channel;

        // Handle presence sync
        channel.on('presence', { event: 'sync' }, () => {
            const state = channel.presenceState() as PresenceState;
            presenceStateRef.current = state;
            updateOnlineUsers();
            devLog('[usePresence] Presence synced:', Object.keys(state).length, 'users');
        });

        // Handle presence join
        channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
            devLog('[usePresence] User joined:', key, newPresences);
            updateOnlineUsers();
        });

        // Handle presence leave
        channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
            devLog('[usePresence] User left:', key, leftPresences);
            updateOnlineUsers();
        });

        // Subscribe to channel
        channel.subscribe(async (status) => {
            devLog('[usePresence] Subscription status:', status);

            if (status === 'SUBSCRIBED') {
                setConnectionState('connected');
                setError(null);

                // Initial presence broadcast
                await broadcastPresence();

                // Set up heartbeat
                heartbeatIntervalRef.current = setInterval(() => {
                    broadcastPresence();
                    updateOnlineUsers(); // Clean up stale presence
                }, HEARTBEAT_INTERVAL);
            } else if (status === 'CHANNEL_ERROR') {
                setConnectionState('disconnected');
                setError(new Error('Failed to connect to presence channel'));
                console.error('[usePresence] CHANNEL_ERROR - Check Supabase credentials and Realtime settings');
            } else if (status === 'TIMED_OUT') {
                setConnectionState('disconnected');
                setError(new Error('Presence channel connection timed out'));
                console.error('[usePresence] TIMED_OUT');
            } else if (status === 'CLOSED') {
                setConnectionState('disconnected');
                // CLOSED is a normal state when unsubscribing or disconnected
                devLog('[usePresence] CLOSED - Connection was closed');
            }
        });

        // Cleanup
        return () => {
            devLog('[usePresence] Cleaning up channel:', channelName);

            if (heartbeatIntervalRef.current) {
                clearInterval(heartbeatIntervalRef.current);
                heartbeatIntervalRef.current = null;
            }

            if (channelRef.current) {
                channelRef.current.unsubscribe();
                channelRef.current = null;
            }

            setConnectionState('disconnected');
            setOnlineUsers([]);
            presenceStateRef.current = {};
        };
    }, [conversationId, userPublicKey, enabled, updateOnlineUsers, broadcastPresence]);

    const isOnline = useCallback(
        (publicKey: string) => {
            return onlineUsers.includes(publicKey);
        },
        [onlineUsers]
    );

    return {
        onlineUsers,
        isOnline,
        connectionState,
        error,
        typingUsers,
    };
}
