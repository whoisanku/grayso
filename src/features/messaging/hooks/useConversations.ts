import { useContext, useEffect, useRef } from "react";
import { DeSoIdentityContext } from "react-deso-protocol";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchConversations, getConversationsQueryKey } from "@/state/queries/messages/list";
import { identity } from "deso-protocol";
import {
  getSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/supabaseClient";
import { Platform } from "react-native";
import { StorageService } from "@/lib/storage";

export const useConversations = () => {
  const { currentUser } = useContext(DeSoIdentityContext);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();

  type ConversationsResponse = Awaited<ReturnType<typeof fetchConversations>>;

  // Hydrate cached conversations immediately for fast paint
  useEffect(() => {
    const userPk = currentUser?.PublicKeyBase58Check;
    if (!userPk) return;
    (async () => {
      const cached = await StorageService.getConversations(userPk);
      if (cached) {
        queryClient.setQueryData(getConversationsQueryKey(userPk), cached);
      }
    })();
  }, [currentUser?.PublicKeyBase58Check, queryClient]);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<ConversationsResponse>({
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
    staleTime: Infinity, // rely on manual/realtime updates instead of auto refetch
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Persist conversations to storage when updated
  useEffect(() => {
    const userPk = currentUser?.PublicKeyBase58Check;
    if (!userPk || !data) return;
    void StorageService.saveConversations(userPk, data);
  }, [currentUser?.PublicKeyBase58Check, data]);

  useEffect(() => {
    const userPublicKey = currentUser?.PublicKeyBase58Check;
    const supabaseEnabled = isSupabaseConfigured();

    if (!supabaseEnabled || !userPublicKey) {
      return;
    }

    const supabase = getSupabaseClient();
    const channelIdentifier = `messages:${userPublicKey}`;

    const channel = supabase
      .channel(channelIdentifier)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        () => {
          // Debounce refetches to avoid flooding when multiple inserts arrive
          if (debounceRef.current) {
            clearTimeout(debounceRef.current);
          }
          debounceRef.current = setTimeout(() => {
            void refetch();
          }, Platform.OS === "web" ? 150 : 75);
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
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      void channel.unsubscribe();
    };
  }, [currentUser?.PublicKeyBase58Check, refetch]);

  return {
    conversations: data?.conversations ?? {},
    spamConversations: data?.spamConversations ?? {},
    profiles: data?.profiles ?? {},
    groupMembers: data?.groupMembers ?? {},
    groupExtraData: data?.groupExtraData ?? {},
    isLoading,
    isFetching,
    error: isError ? (error as Error).message : null,
    reload: refetch,
  };
};
