import { useContext, useCallback, useEffect } from "react";
import { DeSoIdentityContext } from "react-deso-protocol";
import { useQuery } from "@tanstack/react-query";
import { fetchConversations, getConversationsQueryKey } from "../../state/queries/messages/list";
import { identity } from "deso-protocol";
import {
  getSupabaseClient,
  isSupabaseConfigured,
  SUPABASE_MESSAGES_FILTER_COLUMN,
  SUPABASE_MESSAGES_TABLE,
  SUPABASE_REALTIME_SCHEMA,
} from "../../lib/supabaseClient";

export const useConversations = () => {
  const { currentUser } = useContext(DeSoIdentityContext);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: getConversationsQueryKey(currentUser?.PublicKeyBase58Check),
    queryFn: async () => {
        try {
             return await fetchConversations(currentUser!.PublicKeyBase58Check);
        } catch (e: any) {
             const message: string = e?.message ?? "";
            if (message.includes("Cannot decrypt messages")) {
                console.warn("Unable to decrypt conversations for current user", {
                    publicKey: currentUser?.PublicKeyBase58Check,
                    error: e,
                });
                try {
                    await identity.logout();
                } catch (logoutError) {
                    console.warn("Failed to logout after decryption error", logoutError);
                }
            }
            throw e;
        }
    },
    enabled: !!currentUser?.PublicKeyBase58Check,
    staleTime: 1000 * 30, // 30 seconds
  });

  useEffect(() => {
    const userPublicKey = currentUser?.PublicKeyBase58Check;
    const supabaseEnabled = isSupabaseConfigured();
    const schema = SUPABASE_REALTIME_SCHEMA?.trim();
    const table = SUPABASE_MESSAGES_TABLE?.trim();

    if (!supabaseEnabled || !userPublicKey || !schema || !table) {
      return;
    }

    const supabase = getSupabaseClient();
    const channelIdentifier = `messages:${userPublicKey}`;
    const filterColumn = SUPABASE_MESSAGES_FILTER_COLUMN?.trim();

    const channel = supabase
      .channel(channelIdentifier)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema,
          table,
          filter: filterColumn ? `${filterColumn}=eq.${userPublicKey}` : undefined,
        },
        () => {
          void refetch();
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.warn("Supabase realtime subscription error", err);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("Supabase realtime subscription status", status);
        }
      });

    return () => {
      void channel.unsubscribe();
    };
  }, [currentUser?.PublicKeyBase58Check, refetch]);

  return {
    conversations: data?.conversations ?? {},
    profiles: data?.profiles ?? {},
    groupMembers: data?.groupMembers ?? {},
    isLoading,
    error: isError ? (error as Error).message : null,
    reload: refetch,
  };
};
