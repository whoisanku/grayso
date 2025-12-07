import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import "react-native-url-polyfill/auto";

type AuthOptions = {
  storage?: typeof AsyncStorage;
  persistSession: boolean;
  autoRefreshToken: boolean;
  detectSessionInUrl: boolean;
};

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const SUPABASE_MESSAGES_CHANNEL =
  process.env.EXPO_PUBLIC_SUPABASE_MESSAGES_CHANNEL ?? "messages";
export const SUPABASE_BROADCAST_EVENT = "message";

let cachedClient: SupabaseClient | null = null;

const baseMessage =
  "Supabase credentials are missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.";

function buildAuthOptions(): AuthOptions {
  if (Platform.OS === "web") {
    return {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    };
  }

  return {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  };
}

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) {
    return cachedClient;
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(baseMessage);
  }

  cachedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: buildAuthOptions(),
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });

  return cachedClient;
}

export type MessageBroadcastPayload = {
  conversationId: string;
  timestampNanos: number;
  recipients?: string[];
  senderPublicKey?: string;
  metadata?: Record<string, unknown>;
  EncryptedMessageText?: string;
  ExtraData?: Record<string, string>;
  SenderAccessGroupPublicKeyBase58Check?: string;
  SenderAccessGroupKeyName?: string;
  RecipientAccessGroupPublicKeyBase58Check?: string;
  RecipientAccessGroupKeyName?: string;
  is_typing?: boolean;
};

export type PresencePayload = {
  publicKey: string;
  timestamp: number;
  conversationId: string;
};

export type EphemeralMessagePayload = {
  id: string;
  senderPublicKey: string;
  encryptedContent: string;
  timestamp: number;
  conversationId: string;
  recipientPublicKey: string;
};


export async function broadcastMessageUpdate(
  payload: MessageBroadcastPayload,
  channelName: string = SUPABASE_MESSAGES_CHANNEL,
  event: string = SUPABASE_BROADCAST_EVENT,
  options: { keepAlive?: boolean } = {}
): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  const supabase = getSupabaseClient();
  const channel = supabase.channel(channelName, {
    config: {
      broadcast: { self: false },
    },
  });

  try {
    // Wrap subscription in a promise to wait for connection
    await new Promise<void>((resolve, reject) => {
      // If already subscribed, resolve immediately
      // @ts-ignore - accessing internal state if available, or just relying on fast subscribe
      if (channel.state === 'joined' || (channel as any)._state === 'joined') {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error("Broadcast subscription timed out"));
      }, 5000);

      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timeout);
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          clearTimeout(timeout);
          reject(new Error(`Broadcast subscription failed: ${status}`));
        }
      });
    });

    console.log(`[Supabase] Subscribed to broadcast channel: ${channelName}`);

    await channel.send({
      type: "broadcast",
      event,
      payload,
    });

    console.log(`[Supabase] Broadcast sent successfully to ${channelName}`);
  } catch (error) {
    console.warn("Supabase broadcast failed", error);
  } finally {
    if (!options.keepAlive) {
      try {
        // Small delay before unsubscribing to ensure message is flushed
        setTimeout(async () => {
          await channel.unsubscribe();
          console.log(`[Supabase] Unsubscribed from channel: ${channelName}`);
        }, 100);
      } catch (unsubscribeError) {
        console.warn("Supabase broadcast unsubscribe error", unsubscribeError);
      }
    } else {
      console.log(`[Supabase] Keeping channel open: ${channelName}`);
    }
  }
}

export const getPresenceChannel = (conversationId: string) => {
  const supabase = getSupabaseClient();
  const channelName = `presence-${conversationId}`;
  let channel = supabase.channel(channelName);
  return channel;
};

export const getBroadcastChannel = (conversationId: string) => {
  const supabase = getSupabaseClient();
  const channelName = `messages-${conversationId}`;
  let channel = supabase.channel(channelName);
  return channel;
};
