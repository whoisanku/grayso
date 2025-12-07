import { useEffect, useState, useCallback, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from '../../../lib/supabaseClient';

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
};

const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const PRESENCE_TIMEOUT = 45000; // 45 seconds - consider offline if no heartbeat

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

        console.log('[usePresence] updateOnlineUsers - raw state:', JSON.stringify(presenceStateRef.current, null, 2));

        Object.entries(presenceStateRef.current).forEach(([key, presences]) => {
            console.log('[usePresence] Key:', key, 'Presences:', JSON.stringify(presences, null, 2));
            presences.forEach((presence: any) => {
                console.log('[usePresence] Processing presence:', JSON.stringify(presence, null, 2));

                // Supabase presence structure: presence is the actual data object
                const publicKey = presence.publicKey || presence.user_id || key;
                const timestamp = presence.timestamp || Date.now();

                // Only consider users online if their last heartbeat was within timeout
                if (now - timestamp < PRESENCE_TIMEOUT) {
                    online.add(publicKey);
                    console.log('[usePresence] Added online user:', publicKey);
                } else {
                    console.log('[usePresence] User timed out:', publicKey, 'age:', now - timestamp);
                }
            });
        });

        const newOnlineUsers = Array.from(online);
        console.log('[usePresence] Final online users:', newOnlineUsers);

        setOnlineUsers(prev => {
            // Deep comparison to prevent unnecessary re-renders
            if (prev.length !== newOnlineUsers.length) return newOnlineUsers;
            const sortedPrev = [...prev].sort();
            const sortedNew = [...newOnlineUsers].sort();
            const hasChanged = sortedPrev.some((user, index) => user !== sortedNew[index]);
            return hasChanged ? newOnlineUsers : prev;
        });
    }, []);

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

        console.log('[usePresence] Subscribing to channel:', channelName);
        console.log('[usePresence] Supabase configured:', isSupabaseConfigured());
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
            console.log('[usePresence] Presence synced:', Object.keys(state).length, 'users');
        });

        // Handle presence join
        channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
            console.log('[usePresence] User joined:', key, newPresences);
            updateOnlineUsers();
        });

        // Handle presence leave
        channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
            console.log('[usePresence] User left:', key, leftPresences);
            updateOnlineUsers();
        });

        // Subscribe to channel
        channel.subscribe(async (status) => {
            console.log('[usePresence] Subscription status:', status);

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
                setError(new Error('Presence channel closed'));
                console.error('[usePresence] CLOSED - Connection was closed');
            }
        });

        // Cleanup
        return () => {
            console.log('[usePresence] Cleaning up channel:', channelName);

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conversationId, userPublicKey, enabled]);

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
    };
}
